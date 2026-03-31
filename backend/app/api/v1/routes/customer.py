from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
import uuid

from app.core.database import get_db
from app.api.v1.dependencies import get_current_customer, get_valid_restaurant
from app.models.customer import Customer, RestaurantCustomer
from app.models.restaurant import Restaurant

router = APIRouter()


@router.delete("/customer/my-data")
async def delete_my_data(
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint DPDP Compliance: DELETE /customer/my-data
    Anonymizes phone + name (Soft delete)
    Right to be forgotten under DPDP Act
    """
    customer_id = uuid.UUID(token_data["sub"])

    result = await db.execute(
        select(Customer).where(Customer.id == customer_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Anonymize PII — Blueprint: Soft delete
    customer.phone_encrypted = "ANONYMIZED"
    customer.phone_hash = f"deleted_{customer_id}"
    customer.name_encrypted = None
    customer.consent_timestamp = None
    customer.consent_ip = None
    customer.deleted_at = datetime.now(timezone.utc)

    # Remove marketing opt-in
    rc_result = await db.execute(
        select(RestaurantCustomer).where(
            RestaurantCustomer.customer_id == customer_id,
            RestaurantCustomer.restaurant_id == restaurant.id,
        )
    )
    rc = rc_result.scalar_one_or_none()
    if rc:
        rc.marketing_opt_in = False

    await db.commit()
    return {"message": "Your data has been anonymized as per DPDP Act"}

@router.get("/orders/{order_id}")
async def get_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Blueprint Module 3: GET /orders/{id}
    Hydrates order details, line items, and handles pricing so frontend UI matches precisely.
    Returns exactly what the frontend `Order` interface expects.
    """
    from sqlalchemy.orm import joinedload
    from app.models.order import Order, OrderItem
    from app.models.menu import MenuItem
    
    result = await db.execute(
        select(Order).options(
            joinedload(Order.items).joinedload(OrderItem.menu_item)
        ).where(Order.id == order_id)
    )
    order = result.unique().scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Reconstruct bill logic
    subtotal = float(sum(i.historical_price_at_order * i.quantity for i in order.items))
    gst = subtotal * 0.05
    platform_fee = 3.00
    gateway_fee = subtotal * 0.02
    total = subtotal + gst + platform_fee + gateway_fee
    
    # Map to frontend expected camelCase dictionary
    return {
        "data": {
            "id": str(order.id),
            "orderNumber": str(order.id).split("-")[0].upper(),
            "restaurantId": str(order.restaurant_id),
            "tableId": str(order.table_id) if order.table_id else None,
            "tableLabel": "TBD", # We won't fetch table for now to save query depth
            "source": order.source,
            "orderType": "dine_in",
            "kitchenStatus": order.kitchen_status,
            "paymentStatus": order.payment_status,
            "subtotal": subtotal,
            "gst": gst,
            "platformFee": platform_fee,
            "gatewayFee": gateway_fee,
            "total": total,
            "savings": 0.0,
            "specialInstructions": "",
            "customerName": None,
            "customerPhone": None,
            "idempotencyKey": order.idempotency_key,
            "createdAt": order.created_at.isoformat(),
            "updatedAt": order.updated_at.isoformat(),
            "aggregatorOrderId": order.aggregator_order_id,
            "aggregatorSlaDeadline": order.preparation_deadline.isoformat() if order.preparation_deadline else None,
            "items": [
                {
                    "id": str(i.id),
                    "menuItemId": str(i.menu_item_id),
                    "name": i.menu_item.name,
                    "quantity": i.quantity,
                    "unitPrice": float(i.historical_price_at_order),
                    "totalPrice": float(i.historical_price_at_order) * i.quantity,
                    "specialNote": i.notes or "",
                    "dietType": i.menu_item.diet_type if hasattr(i.menu_item, "diet_type") else "veg"
                }
                for i in order.items
            ]
        },
        "success": True,
        "message": "Order fetched"
    }


@router.get("/session/orders")
async def get_session_orders(
    table_id: str = None,
    order_ids: str = None,
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy.orm import joinedload
    from app.models.order import Order, OrderItem
    
    query = select(Order).options(
        joinedload(Order.items).joinedload(OrderItem.menu_item)
    )

    if order_ids:
        oid_list = [uuid.UUID(oid.strip()) for oid in order_ids.split(",") if oid.strip()]
        query = query.where(Order.id.in_(oid_list))
    elif table_id:
        query = query.where(Order.table_id == uuid.UUID(table_id))
    else:
        return {"data": [], "success": True, "message": "No session criteria"}

    # Order by newest first
    query = query.order_by(Order.created_at.desc())
    result = await db.execute(query)
    orders = result.unique().scalars().all()
    
    response_orders = []
    for order in orders:
        subtotal = float(sum(i.historical_price_at_order * i.quantity for i in order.items))
        gst = subtotal * 0.05
        platform_fee = 3.00
        gateway_fee = subtotal * 0.02
        total = subtotal + gst + platform_fee + gateway_fee
        
        response_orders.append({
            "id": str(order.id),
            "orderNumber": str(order.id).split("-")[0].upper(),
            "restaurantId": str(order.restaurant_id),
            "tableId": str(order.table_id) if order.table_id else None,
            "source": order.source,
            "kitchenStatus": order.kitchen_status,
            "paymentStatus": order.payment_status,
            "total": total,
            "createdAt": order.created_at.isoformat(),
            "items": [
                {
                    "id": str(i.id),
                    "name": i.menu_item.name,
                    "quantity": i.quantity,
                    "totalPrice": float(i.historical_price_at_order) * i.quantity,
                }
                for i in order.items
            ]
        })
        
    return {"data": response_orders, "success": True, "message": "Session orders fetched"}


@router.get("/session/bill")
async def get_session_bill(
    table_id: str = None,
    order_ids: str = None,
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy.orm import joinedload
    from app.models.order import Order, OrderItem
    
    query = select(Order).options(
        joinedload(Order.items).joinedload(OrderItem.menu_item)
    ).where(Order.payment_status == "pending")

    if order_ids:
        oid_list = [uuid.UUID(oid.strip()) for oid in order_ids.split(",") if oid.strip()]
        query = query.where(Order.id.in_(oid_list))
    elif table_id:
        query = query.where(Order.table_id == uuid.UUID(table_id))
    else:
        raise HTTPException(status_code=400, detail="Must provide table_id or order_ids")

    result = await db.execute(query)
    orders = result.unique().scalars().all()
    
    if not orders:
        return {
            "data": {
                "orders": [], "items": [], 
                "subtotal": 0, "gst": 0, "platformFee": 0, "gatewayFee": 0, "total": 0
            }, 
            "success": True, 
            "message": "No pending orders to bill"
        }

    combined_items = []
    subtotal = 0.0
    
    for order in orders:
        for item in order.items:
            combined_items.append({
                "id": str(item.id),
                "orderId": str(order.id),
                "menuItemId": str(item.menu_item_id),
                "name": item.menu_item.name,
                "quantity": item.quantity,
                "unitPrice": float(item.historical_price_at_order),
                "totalPrice": float(item.historical_price_at_order) * item.quantity,
                "specialNote": item.notes or "",
            })
            subtotal += float(item.historical_price_at_order) * item.quantity

    gst = subtotal * 0.05
    platform_fee = 3.00 if subtotal > 0 else 0.0
    gateway_fee = subtotal * 0.02
    total = subtotal + gst + platform_fee + gateway_fee

    return {
        "data": {
            "orderIds": [str(o.id) for o in orders],
            "items": combined_items,
            "subtotal": subtotal,
            "gst": gst,
            "platformFee": platform_fee,
            "gatewayFee": gateway_fee,
            "total": total
        },
        "success": True,
        "message": "Cumulative session bill generated"
    }