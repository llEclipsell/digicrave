from fastapi import APIRouter, Depends, Header, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
import uuid
from app.core.config import settings
from app.core.database import get_db
from app.api.v1.dependencies import (
    get_valid_restaurant, get_current_customer
)
from app.models.restaurant import Restaurant
from app.models.order import Order
from app.models.transaction import Transaction
from app.schemas.payment import (
    CreateOrderRequest, CreateOrderResponse,
    RazorpayWebhookPayload
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
    token_data: dict = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint Module 2: POST /order/create
    Requires: Customer JWT + X-Restaurant-ID + X-Idempotency-Key
    """
    customer_id = uuid.UUID(token_data["sub"])

    result = await payment_service.create_order(
        restaurant_id=restaurant.id,
        customer_id=customer_id,
        table_id=request.table_id,
        items_input=request.items,
        payment_method=request.payment_method,
        idempotency_key=x_idempotency_key,
        db=db,
    )
    return CreateOrderResponse(**result)


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
    if receipt:
        order_result = await db.execute(
            select(Order).where(Order.id == uuid.UUID(receipt))
        )
        order = order_result.scalar_one_or_none()

        if order:
            order.payment_status = "paid_digital"

            # --- Create Transaction Record ---
            transaction = Transaction(
                id=uuid.uuid4(),
                order_id=order.id,
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

            # Blueprint: Emit WebSocket to Kitchen + POS
            await manager.emit_to_role(
                restaurant_id=str(order.restaurant_id),
                role="kitchen",
                event="new_order",
                data={
                    "order_id": str(order.id),
                    "source": order.source,
                    "table_id": str(order.table_id) if order.table_id else None,
                    "amount": gross_amount,
                }
            )

            # Emit to Cashier/POS
            await manager.emit_to_role(
                restaurant_id=str(order.restaurant_id),
                role="cashier",
                event="new_order",
                data={
                    "order_id": str(order.id),
                    "payment_status": "paid_digital",
                    "amount": gross_amount,
                }
            )            

    return {"status": "success"}