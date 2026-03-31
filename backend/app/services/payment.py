import uuid
import hmac
import hashlib
import razorpay
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.core.config import settings
from app.models.order import Order, OrderItem
from app.models.menu import MenuItem
from app.models.billing import RestaurantBilling
from app.models.transaction import Transaction
from app.services.pricing import calculate_bill, CartItemInput
from app.services.idempotency import get_cached_response, cache_response


def get_razorpay_client():
    return razorpay.Client(
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
    )


async def check_billing_lock(restaurant_id: uuid.UUID, db: AsyncSession):
    """
    Blueprint: POS Debt Lock
    If unpaid_manual_fees > ₹1000 → return 402
    """
    result = await db.execute(
        select(RestaurantBilling).where(
            RestaurantBilling.restaurant_id == restaurant_id
        )
    )
    billing = result.scalar_one_or_none()
    if billing and billing.unpaid_manual_fees > 1000:
        raise HTTPException(
            status_code=402,
            detail={
                "message": "Billing overdue. Please settle your platform fees.",
                "unpaid_amount": float(billing.unpaid_manual_fees),
                "action": "Visit Admin Dashboard to pay now."
            }
        )


async def create_order(
    restaurant_id: uuid.UUID,
    customer_id: uuid.UUID | None,
    table_id: uuid.UUID | None,
    items_input: list,
    payment_method: str,
    idempotency_key: str,
    db: AsyncSession,
) -> dict:
    """
    Blueprint Module 2: POST /order/create
    - Digital (UPI): Creates Razorpay order with ₹3 split
    - Cash: Creates order as PENDING, adds ₹3 to platform debt
    """

    # --- Idempotency Check ---
    cached = get_cached_response(idempotency_key)
    if cached:
        return cached

    # --- Billing Lock Check ---
    await check_billing_lock(restaurant_id, db)

    # --- Fetch menu items ---
    item_ids = [item.menu_item_id for item in items_input]
    result = await db.execute(
        select(MenuItem).where(
            MenuItem.id.in_(item_ids),
            MenuItem.restaurant_id == restaurant_id,
            MenuItem.deleted_at == None
        )
    )
    db_items = {item.id: item for item in result.scalars().all()}

    # --- Build cart inputs ---
    cart_inputs = []
    for cart_item in items_input:
        item_id = uuid.UUID(str(cart_item.menu_item_id))
        db_item = db_items.get(item_id)
        if not db_item:
            raise HTTPException(
                status_code=404,
                detail=f"Item {cart_item.menu_item_id} not found"
            )
        cart_inputs.append(CartItemInput(
            menu_item_id=str(cart_item.menu_item_id),
            quantity=cart_item.quantity,
            price_offline=db_item.price_offline,
            qr_discount_percent=db_item.qr_discount_percent,
            name=db_item.name,
            is_available=db_item.is_available,
        ))

    # --- Run Pricing Engine ---
    bill = calculate_bill(cart_inputs)

    # --- Create Order in DB ---
    order = Order(
        id=uuid.uuid4(),
        restaurant_id=restaurant_id,
        table_id=table_id,
        customer_id=customer_id,
        source="qr_scan",
        kitchen_status="received",
        payment_status="pending",
        idempotency_key=idempotency_key,
    )
    db.add(order)
    await db.flush()

    # --- Create Order Items (with historical price locked) ---
    for cart_item in items_input:
        item_id = uuid.UUID(str(cart_item.menu_item_id))
        db_item = db_items[item_id]

        # Find matching line item from bill
        line = next(
            li for li in bill.line_items
            if li.menu_item_id == str(cart_item.menu_item_id)
        )
        order_item = OrderItem(
            id=uuid.uuid4(),
            order_id=order.id,
            menu_item_id=item_id,
            quantity=cart_item.quantity,
            # Blueprint: Lock price at time of order
            historical_price_at_order=line.discounted_unit_price,
        )
        db.add(order_item)

    # --- Path A: Digital Payment (UPI) ---
    if payment_method == "upi":
        response = await _create_razorpay_order(
            order=order,
            bill=bill,
            restaurant_id=restaurant_id,
            db=db,
        )

    # --- Path B: Cash Payment ---
    else:
        response = await _create_cash_order(
            order=order,
            bill=bill,
            restaurant_id=restaurant_id,
            db=db,
        )

    await db.commit()

    # Cache response for idempotency
    cache_response(idempotency_key, response)
    return response


async def _create_razorpay_order(
    order: Order,
    bill,
    restaurant_id: uuid.UUID,
    db: AsyncSession,
    session_order_ids: list[str] = None
) -> dict:
    """
    Blueprint Golden Rule 2: Payment Split
    ₹3 → Platform Account
    (Net - ₹3) → Restaurant Account
    """
    client = get_razorpay_client()

    # Razorpay amounts are in paise (multiply by 100)
    total_paise = int(bill.total_qr_price * 100)
    platform_fee_paise = int(bill.platform_fee * 100)  # ₹3 = 300 paise
    restaurant_amount_paise = total_paise - platform_fee_paise - int(bill.gateway_fee * 100)

    try:
        payload = {
            "amount": total_paise,
            "currency": "INR",
            "receipt": str(order.id),
            "transfers": [
                {
                    # ₹3 to YOUR platform account
                    "account": settings.RAZORPAY_PLATFORM_ACCOUNT_ID,
                    "amount": platform_fee_paise,
                    "currency": "INR",
                    "notes": {
                        "order_id": str(order.id),
                        "type": "platform_fee"
                    }
                },
                {
                    # Rest to Restaurant account
                    "account": "restaurant_razorpay_account_id",  # From restaurants table
                    "amount": restaurant_amount_paise,
                    "currency": "INR",
                    "notes": {
                        "order_id": str(order.id),
                        "type": "restaurant_settlement"
                    }
                }
            ]
        }
        
        if session_order_ids:
            payload["notes"] = {
                "session_orders": ",".join(session_order_ids)[:250] # Razorpay notes limit 254 chars
            }
            
        rzp_order = client.order.create(payload)

        # Update order with Razorpay order ID
        order.payment_status = "pending"

        return {
            "order_id": str(order.id),
            "razorpay_order_id": rzp_order["id"],
            "payment_method": "upi",
            "final_amount": float(bill.total_qr_price),
            "message": "Razorpay order created. Proceed to payment."
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Razorpay order creation failed: {str(e)}"
        )


async def _create_cash_order(
    order: Order,
    bill,
    restaurant_id: uuid.UUID,
    db: AsyncSession,
) -> dict:
    """
    Blueprint: Cash orders add ₹3 to platform debt
    No Razorpay involved — debt settled monthly
    """
    order.payment_status = "pending"

    # Add ₹3 to restaurant's platform debt
    result = await db.execute(
        select(RestaurantBilling).where(
            RestaurantBilling.restaurant_id == restaurant_id
        )
    )
    billing = result.scalar_one_or_none()
    if billing:
        billing.unpaid_manual_fees += Decimal(str(settings.PLATFORM_FEE))
    else:
        billing = RestaurantBilling(
            id=uuid.uuid4(),
            restaurant_id=restaurant_id,
            unpaid_manual_fees=Decimal(str(settings.PLATFORM_FEE)),
        )
        db.add(billing)

    return {
        "order_id": str(order.id),
        "razorpay_order_id": None,
        "payment_method": "cash",
        "final_amount": float(bill.total_qr_price),
        "message": "Order placed. Pay at counter."
    }


def verify_razorpay_signature(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
) -> bool:
    """
    Blueprint: Verify HMAC signature from Razorpay webhook
    Prevents fake webhook attacks
    """
    import hmac as hmac_lib
    import hashlib
    message = f"{razorpay_order_id}|{razorpay_payment_id}"
    expected = hmac_lib.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac_lib.compare_digest(expected, razorpay_signature)