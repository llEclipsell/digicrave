from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.models.order import Order, OrderItem
from app.models.menu import MenuItem


DEFAULT_AGGREGATOR_SLA_MINUTES = 20  # Blueprint default


async def create_aggregator_order(
    restaurant_id: uuid.UUID,
    aggregator_order_id: str,
    source: str,  # "zomato" or "swiggy"
    items: list,
    sla_minutes: int = DEFAULT_AGGREGATOR_SLA_MINUTES,
    db: AsyncSession = None,
) -> Order:
    """
    Blueprint Module 4: Aggregator webhook order creation
    Sets preparation_deadline = now() + sla_minutes
    """
    now = datetime.now(timezone.utc)
    deadline = now + timedelta(minutes=sla_minutes)

    order = Order(
        id=uuid.uuid4(),
        restaurant_id=restaurant_id,
        source=source,
        kitchen_status="received",
        payment_status="paid_digital",  # Aggregators pre-collect payment
        aggregator_order_id=aggregator_order_id,
        idempotency_key=f"{source}_{aggregator_order_id}",
        preparation_deadline=deadline,  # Blueprint Rule 3
    )
    db.add(order)
    await db.flush()

    for item_data in items:
        item_result = await db.execute(
            select(MenuItem).where(
                MenuItem.aggregator_mapping_id == str(item_data.get("aggregator_item_id")),
                MenuItem.restaurant_id == restaurant_id,
            )
        )
        menu_item = item_result.scalar_one_or_none()
        if menu_item:
            order_item = OrderItem(
                id=uuid.uuid4(),
                order_id=order.id,
                menu_item_id=menu_item.id,
                quantity=item_data.get("quantity", 1),
                historical_price_at_order=menu_item.price_offline,
            )
            db.add(order_item)

    await db.commit()
    return order