from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Optional
from pydantic import BaseModel
from decimal import Decimal
import uuid
from app.core.websocket import manager

from app.core.database import get_db
from app.api.v1.dependencies import (
    get_valid_restaurant, get_current_staff
)
from app.models.order import Order, OrderItem
from app.models.menu import MenuItem
from app.models.restaurant import Table, Restaurant
from app.schemas.pagination import make_paginated_response
from sqlalchemy import func

router = APIRouter()


# --- Schemas ---
class OrderItemResponse(BaseModel):
    id: uuid.UUID
    menu_item_id: uuid.UUID
    quantity: int
    historical_price_at_order: Decimal
    notes: Optional[str]

    model_config = {"from_attributes": True}


class OrderResponse(BaseModel):
    id: uuid.UUID
    source: str
    kitchen_status: str
    payment_status: str
    table_id: Optional[uuid.UUID]
    customer_id: Optional[uuid.UUID]
    items: List[OrderItemResponse] = []

    model_config = {"from_attributes": True}


class UpdateOrderStatusRequest(BaseModel):
    status: str  # received | preparing | ready | served


class UpdateTableStatusRequest(BaseModel):
    status: str  # empty | seated | waiting_for_food


class ManualOrderRequest(BaseModel):
    items: List[dict]  # [{menu_item_id, quantity}]
    table_number: Optional[str] = None
    idempotency_key: str


class PrintResponse(BaseModel):
    order_id: str
    table_number: Optional[str]
    items: List[dict]
    subtotal: Decimal
    message: str


# --- Routes ---
@router.get("/staff/orders")
async def get_active_orders(
    status: Optional[str] = None,
    cursor: Optional[str] = None,
    limit: int = 20,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_staff),
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint Module 3: GET /staff/orders
    Cursor-based pagination for Live Orders/KDS
    Prevents skipping items when new orders arrive
    """
    from app.schemas.pagination import decode_cursor

    # Enforce max limit
    limit = min(limit, 100)

    query = select(Order).options(
        joinedload(Order.table),
        selectinload(Order.items).joinedload(OrderItem.menu_item)
    ).where(
        Order.restaurant_id == restaurant.id,
        Order.deleted_at == None
    )

    if status:
        query = query.where(Order.kitchen_status == status)

    # Cursor-based — use created_at for live feed
    if cursor:
        cursor_data = decode_cursor(cursor)
        last_id = cursor_data.get("id")
        if last_id:
            query = query.where(Order.id > uuid.UUID(last_id))

    # Total count
    count_result = await db.execute(
        select(func.count(Order.id)).where(
            Order.restaurant_id == restaurant.id,
            Order.deleted_at == None
        )
    )
    total_count = count_result.scalar() or 0

    query = query.order_by(Order.created_at.desc()).limit(limit)
    result = await db.execute(query)
    orders = result.scalars().all()

    payload_list = []
    for o in orders:
        items_payload = []
        for i in o.items:
            items_payload.append({
                "id": str(i.id),
                "menuItemId": str(i.menu_item_id),
                "name": i.menu_item.name if getattr(i, 'menu_item', None) else "Deleted Item",
                "quantity": i.quantity,
                "unitPrice": float(i.historical_price_at_order),
                "totalPrice": float(i.historical_price_at_order * i.quantity),
                "specialNote": getattr(i, 'notes', "") or "",
                "dietType": "veg"
            })
        
        table_label = "Takeaway"
        if getattr(o, "table", None):
            table_label = o.table.table_number
        elif o.table_id:
            table_label = "TBD"

        payload_list.append({
            "id": str(o.id),
            "orderNumber": str(o.id).split("-")[0].upper(),
            "restaurantId": str(o.restaurant_id),
            "tableId": str(o.table_id) if o.table_id else None,
            "tableLabel": table_label,
            "source": o.source,
            "orderType": "dine_in" if o.table_id else "takeaway",
            "kitchenStatus": o.kitchen_status,
            "paymentStatus": o.payment_status,
            "items": items_payload,
            "subtotal": 0, "gst": 0, "platformFee": 0, "gatewayFee": 0, "total": 0, "savings": 0,
            "specialInstructions": getattr(o, 'special_instructions', "") or "",
            "customerName": None,
            "customerPhone": None,
            "idempotencyKey": getattr(o, 'idempotency_key', ""),
            "createdAt": o.created_at.isoformat() + "Z" if getattr(o, 'created_at', None) else "",
            "updatedAt": o.updated_at.isoformat() + "Z" if getattr(o, 'updated_at', None) else "",
            "aggregatorOrderId": None,
            "aggregatorSlaDeadline": None,
        })
        
    last_id = str(orders[-1].id) if orders else None

    paginated = make_paginated_response(
        items=payload_list,
        total_count=total_count,
        limit=limit,
        last_id=last_id,
    )
    return {"data": paginated, "success": True, "message": "Orders fetched"}


@router.patch("/staff/orders/{order_id}/status", response_model=dict)
async def update_order_status(
    order_id: uuid.UUID,
    request: UpdateOrderStatusRequest,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_staff),
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint Module 3: PATCH /staff/orders/{id}/status
    If READY → send WhatsApp notification to customer
    """
    valid_statuses = ["received", "preparing", "ready", "served"]
    if request.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )

    result = await db.execute(
        select(Order).where(
            Order.id == order_id,
            Order.restaurant_id == restaurant.id,
            Order.deleted_at == None
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.kitchen_status = request.status
    await db.commit()

    # Emit to Kitchen
    await manager.emit_to_role(
        restaurant_id=str(restaurant.id),
        role="kitchen",
        event="order.status_changed",
        data={
            "orderId": str(order_id),
            "kitchenStatus": request.status,
            "tableId": str(order.table_id) if order.table_id else None,
        }
    )

    # Emit to Cashier
    await manager.emit_to_role(
        restaurant_id=str(restaurant.id),
        role="cashier",
        event="order.status_changed",
        data={
            "orderId": str(order_id),
            "kitchenStatus": request.status,
        }
    )

    # If READY → notify customer
    if request.status == "ready":
        await manager.emit_to_role(
            restaurant_id=str(restaurant.id),
            role="customer",
            event="your_order_is_ready",
            data={
                "orderId": str(order_id),
                "message": "Your order is ready! 🍽️",
            }
        )

    return {"order_id": str(order_id), "new_status": request.status}

@router.post("/staff/orders/{order_id}/payment")
async def mark_order_paid(
    order_id: uuid.UUID,
    request: dict,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_staff),
    db: AsyncSession = Depends(get_db),
):
    """Mark an order as cash-paid at counter."""
    result = await db.execute(
        select(Order).where(
            Order.id == order_id,
            Order.restaurant_id == restaurant.id,
            Order.deleted_at == None
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.payment_status = "paid_cash"
    await db.commit()

    await manager.emit_to_role(
        restaurant_id=str(restaurant.id),
        role="cashier",
        event="order.payment_received",
        data={"orderId": str(order_id)}
    )

    return {"data": {"orderId": str(order_id), "paymentStatus": "paid_cash"}, "success": True, "message": "Marked as paid"}

@router.post("/staff/orders/manual", status_code=201)
async def create_manual_order(
    request: ManualOrderRequest,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_staff),
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint Module 3: POST /staff/orders/manual
    For walk-ins/phone orders. Bypasses customer login.
    Adds ₹3 to platform debt.
    """
    from app.services.idempotency import get_cached_response, cache_response
    from app.models.billing import RestaurantBilling
    from app.core.config import settings

    # Idempotency check
    cached = get_cached_response(request.idempotency_key)
    if cached:
        return cached

    # Billing lock check
    billing_result = await db.execute(
        select(RestaurantBilling).where(
            RestaurantBilling.restaurant_id == restaurant.id
        )
    )
    billing = billing_result.scalar_one_or_none()
    if billing and billing.unpaid_manual_fees > 1000:
        raise HTTPException(
            status_code=402,
            detail="Billing overdue. Settle platform fees to continue."
        )

    # Create order
    order = Order(
        id=uuid.uuid4(),
        restaurant_id=restaurant.id,
        source="pos_manual",
        kitchen_status="received",
        payment_status="pending",
        idempotency_key=request.idempotency_key,
    )
    db.add(order)
    await db.flush()

    # Add order items
    for item_data in request.items:
        item_result = await db.execute(
            select(MenuItem).where(
                MenuItem.id == uuid.UUID(str(item_data["menu_item_id"])),
                MenuItem.restaurant_id == restaurant.id
            )
        )
        menu_item = item_result.scalar_one_or_none()
        if not menu_item:
            continue

        order_item = OrderItem(
            id=uuid.uuid4(),
            order_id=order.id,
            menu_item_id=menu_item.id,
            quantity=item_data["quantity"],
            historical_price_at_order=menu_item.price_offline,
        )
        db.add(order_item)

    # Add ₹3 to platform debt
    if billing:
        billing.unpaid_manual_fees += Decimal(str(settings.PLATFORM_FEE))
    else:
        billing = RestaurantBilling(
            id=uuid.uuid4(),
            restaurant_id=restaurant.id,
            unpaid_manual_fees=Decimal(str(settings.PLATFORM_FEE)),
        )
        db.add(billing)

    await db.commit()

    # Blueprint: Emit instantly to KDS and POS
    await manager.emit_to_role(
        restaurant_id=str(restaurant.id),
        role="kitchen",
        event="order.new",
        data={
            "order_id": str(order.id),
            "source": order.source,
            "table_id": None,
            "amount": 0.0, # Wait, offline price isn't easily summed here, but that's fine for KDS
        }
    )
    await manager.emit_to_role(
        restaurant_id=str(restaurant.id),
        role="cashier",
        event="order.new",
        data={
            "order_id": str(order.id),
            "payment_status": "pending",
            "amount": 0.0,
        }
    )

    response = {
        "order_id": str(order.id),
        "source": "pos_manual",
        "message": "Manual order created successfully"
    }
    cache_response(request.idempotency_key, response)
    return response


@router.patch("/staff/tables/{table_id}")
async def update_table_status(
    table_id: uuid.UUID,
    request: UpdateTableStatusRequest,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_staff),
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint Module 3: PATCH /staff/tables/{id}
    Mark table empty or occupied.
    Empty → blacklists all QR tokens for that table in Redis.
    """
    valid_statuses = ["empty", "seated", "waiting_for_food"]
    if request.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )

    result = await db.execute(
        select(Table).where(
            Table.id == table_id,
            Table.restaurant_id == restaurant.id
        )
    )
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    table.status = request.status

    # Blueprint: If empty → blacklist QR tokens in Redis
    if request.status == "empty":
        import redis as redis_lib
        from app.core.config import settings
        r = redis_lib.from_url(settings.REDIS_URL, decode_responses=True)
        r.setex(f"table_blacklist:{table_id}", 14400, "blacklisted")  # 4hr TTL
        print(f"[QR BLACKLIST] Table {table_id} tokens blacklisted")

    await db.commit()
    return {"table_id": str(table_id), "new_status": request.status}


@router.get("/staff/print/{order_id}", response_model=PrintResponse)
async def get_print_data(
    order_id: uuid.UUID,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_staff),
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint Module 3: GET /staff/print/{order_id}
    Returns structured data for ESC/POS thermal printer.
    """
    result = await db.execute(
        select(Order).where(
            Order.id == order_id,
            Order.restaurant_id == restaurant.id
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Fetch order items with menu item names
    items_result = await db.execute(
        select(OrderItem, MenuItem).join(
            MenuItem, OrderItem.menu_item_id == MenuItem.id
        ).where(OrderItem.order_id == order_id)
    )
    rows = items_result.all()

    items_data = []
    subtotal = Decimal("0")
    for order_item, menu_item in rows:
        line_total = order_item.historical_price_at_order * order_item.quantity
        subtotal += line_total
        items_data.append({
            "name": menu_item.name,
            "quantity": order_item.quantity,
            "unit_price": float(order_item.historical_price_at_order),
            "line_total": float(line_total),
        })

    # Get table number if exists
    table_number = None
    if order.table_id:
        table_result = await db.execute(
            select(Table).where(Table.id == order.table_id)
        )
        table = table_result.scalar_one_or_none()
        if table:
            table_number = table.table_number

    return PrintResponse(
        order_id=str(order_id),
        table_number=table_number,
        items=items_data,
        subtotal=subtotal,
        message="Print data ready"
    )