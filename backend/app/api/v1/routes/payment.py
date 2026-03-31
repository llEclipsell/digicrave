from fastapi import APIRouter, Depends, Header, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
import uuid
from app.core.config import settings
from app.core.database import get_db
from app.api.v1.dependencies import (
    get_valid_restaurant, get_current_customer, get_current_customer_optional
)
from app.models.restaurant import Restaurant
from app.models.order import Order
from app.models.transaction import Transaction
from app.schemas.payment import (
    CreateOrderRequest, CreateOrderResponse,
    RazorpayWebhookPayload, RazorpayOrderRequest, RazorpayOrderResponse
)
from app.services import payment as payment_service
from app.services.idempotency import is_duplicate, cache_response
from app.core.websocket import manager

router = APIRouter()


@router.post("/order/create", response_model=CreateOrderResponse, status_code=201)
async def create_order(
    request: CreateOrderRequest,
    x_idempotency_key: str = Header(..., alias="X-Idempotency-Key"),
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict | None = Depends(get_current_customer_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint Module 2: POST /order/create
    Requires: X-Restaurant-ID + X-Idempotency-Key. Customer JWT is optional for guests.
    """
    customer_id = uuid.UUID(token_data["sub"]) if token_data else None
    
    final_table_id = None
    if request.table_id:
        try:
            final_table_id = uuid.UUID(request.table_id)
        except ValueError:
            # It's a table number string like "1"
            from app.models.restaurant import Table
            table_result = await db.execute(
                select(Table).where(
                    Table.restaurant_id == restaurant.id,
                    Table.table_number == str(request.table_id)
                )
            )
            table_obj = table_result.scalar_one_or_none()
            if table_obj:
                final_table_id = table_obj.id

    result = await payment_service.create_order(
        restaurant_id=restaurant.id,
        customer_id=customer_id,
        table_id=final_table_id,
        items_input=request.items,
        payment_method=request.payment_method,
        idempotency_key=x_idempotency_key,
        db=db,
    )

    # Blueprint: Emit instantly to KDS and POS
    await manager.emit_to_role(
        restaurant_id=str(restaurant.id),
        role="kitchen",
        event="order.new",
        data={
            "order_id": result["order_id"],
            "source": "qr_scan",
            "table_id": str(final_table_id) if final_table_id else None,
            "amount": result["final_amount"],
        }
    )
    await manager.emit_to_role(
        restaurant_id=str(restaurant.id),
        role="cashier",
        event="order.new",
        data={
            "order_id": result["order_id"],
            "payment_status": "pending" if request.payment_method == "cash" else "digital_pending",
            "amount": result["final_amount"],
        }
    )

    return CreateOrderResponse(**result)


@router.post("/payments/razorpay/order", status_code=201)
async def generate_razorpay_for_existing_order(
    request: RazorpayOrderRequest,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict | None = Depends(get_current_customer_optional),
    db: AsyncSession = Depends(get_db),
):
    from app.models.menu import MenuItem
    from app.models.order import OrderItem
    
    order_id_uuids = []
    if request.order_ids:
        order_id_uuids = [uuid.UUID(oid) for oid in request.order_ids]
    elif request.order_id:
        order_id_uuids = [uuid.UUID(request.order_id)]
    else:
        raise HTTPException(status_code=400, detail="Must provide order_id or order_ids")

    result = await db.execute(
        select(Order).where(
            Order.id.in_(order_id_uuids),
            Order.restaurant_id == restaurant.id,
            Order.deleted_at == None
        )
    )
    orders = result.scalars().all()
    if not orders:
        raise HTTPException(status_code=404, detail="Orders not found")

    for o in orders:
        if o.payment_status in ["paid_digital", "paid_cash"]:
            raise HTTPException(status_code=400, detail="One or more orders are already paid")

    items_result = await db.execute(
        select(OrderItem, MenuItem).join(
            MenuItem, OrderItem.menu_item_id == MenuItem.id
        ).where(OrderItem.order_id.in_(order_id_uuids))
    )
    rows = items_result.all()

    from app.services.pricing import calculate_bill, CartItemInput
    cart_inputs = []
    for order_item, menu_item in rows:
        cart_inputs.append(CartItemInput(
            menu_item_id=str(menu_item.id),
            quantity=order_item.quantity,
            price_offline=menu_item.price_offline,
            qr_discount_percent=menu_item.qr_discount_percent,
            name=menu_item.name,
            is_available=menu_item.is_available,
        ))

    bill = calculate_bill(cart_inputs)

    # Use existing internal method on the first order, but pass session_orders list
    response = await payment_service._create_razorpay_order(
        order=orders[0],
        bill=bill,
        restaurant_id=restaurant.id,
        db=db,
        session_order_ids=[str(o.id) for o in orders]
    )
    await db.commit()
    
    # Map to expected frontend RazorpayOrderResponse
    return {
        "data": {
            "keyId": settings.RAZORPAY_KEY_ID,
            "amount": int(bill.total_qr_price * 100),
            "currency": "INR",
            "razorpayOrderId": response["razorpay_order_id"],
        },
        "success": True,
        "message": "Razorpay order created"
    }



@router.post("/order/webhook/razorpay")
async def razorpay_webhook(
    request_body: dict,
    background_tasks: BackgroundTasks,
    x_razorpay_signature: str = Header(..., alias="X-Razorpay-Signature"),
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint Module 2: POST /order/webhook/razorpay
    1. Verify HMAC Signature
    2. Idempotency check on payment_id
    3. Update order to PAID
    4. Create Transaction record
    5. Emit WebSocket to Kitchen/POS (Phase 7)
    """
    event = request_body.get("event")

    if event != "payment.captured":
        return {"status": "ignored"}

    payment_entity = request_body.get("payload", {}).get("payment", {}).get("entity", {})
    razorpay_payment_id = payment_entity.get("id")
    razorpay_order_id = payment_entity.get("order_id")
    razorpay_signature = x_razorpay_signature

    # --- Verify Signature (Blueprint: Prevent fake webhooks) ---
    if not payment_service.verify_razorpay_signature(
        razorpay_order_id, razorpay_payment_id, razorpay_signature
    ):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    # --- Idempotency: Prevent double processing ---
    if is_duplicate(f"rzp_webhook:{razorpay_payment_id}"):
        return {"status": "already_processed"}

    # --- Find Order by Razorpay Order ID ---
    # (In production, store rzp_order_id on Order model)
    amount = payment_entity.get("amount", 0)
    gross_amount = amount / 100  # Convert paise to rupees

    platform_fee = float(settings.PLATFORM_FEE)
    gateway_fee = round(gross_amount * float(settings.GATEWAY_FEE_PERCENT), 2)
    net_to_restaurant = round(gross_amount - platform_fee - gateway_fee, 2)

    # --- Update Order Status ---
    # Find order by receipt (we set receipt=order_id when creating)
    receipt = payment_entity.get("receipt")
    
    # Check if this was a multi-order session
    notes = payment_entity.get("notes", {})
    session_orders_str = notes.get("session_orders")
    
    order_uuids = []
    if session_orders_str:
        order_uuids = [uuid.UUID(oid.strip()) for oid in session_orders_str.split(",") if oid.strip()]
    elif receipt:
        order_uuids = [uuid.UUID(receipt)]
        
    if not order_uuids:
        return {"status": "no_orders_found"}

    orders_result = await db.execute(
        select(Order).where(Order.id.in_(order_uuids))
    )
    orders = orders_result.scalars().all()

    if orders:
        for order in orders:
            order.payment_status = "paid_digital"

        # --- Create Transaction Record (Link to primary order) ---
        primary_order = orders[0]
        transaction = Transaction(
            id=uuid.uuid4(),
            order_id=primary_order.id,
            gross_amount=gross_amount,
            platform_fee=platform_fee,
            gateway_fee=gateway_fee,
            net_to_restaurant=net_to_restaurant,
            razorpay_payment_id=razorpay_payment_id,
            razorpay_transfer_id=payment_entity.get("transfer_id"),
        )
        db.add(transaction)
        await db.commit()

        # Cache to prevent duplicate webhook
        cache_response(
            f"rzp_webhook:{razorpay_payment_id}",
            {"status": "processed"}
        )

        # Blueprint: Emit WebSocket to Cashier + Customer that payment is done
        for order in orders:
            await manager.emit_to_role(
                restaurant_id=str(order.restaurant_id),
                role="kitchen",
                event="order.payment_received",
                data={"orderId": str(order.id)}
            )

            # Emit to Cashier/POS
            await manager.emit_to_role(
                restaurant_id=str(order.restaurant_id),
                role="cashier",
                event="order.payment_received",
                data={"orderId": str(order.id)}
            )

    return {"status": "success"}