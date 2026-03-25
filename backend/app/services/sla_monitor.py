import asyncio
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy import select
from app.models.order import Order
from app.core.database import AsyncSessionLocal
from app.core.websocket import manager


async def check_sla_violations():
    """
    Blueprint Rule 3 (KDS Priority):
    If order not READY within 5 mins of deadline →
    Emit WebSocket Critical Alert (Red flashing + loud beep)
    to Cashier
    """
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)

        # Find orders approaching deadline (within 5 mins)
        result = await db.execute(
            select(Order).where(
                Order.kitchen_status.notin_(["ready", "served"]),
                Order.preparation_deadline != None,
                Order.deleted_at == None,
            )
        )
        orders = result.scalars().all()

        for order in orders:
            if not order.preparation_deadline:
                continue

            deadline = order.preparation_deadline
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)

            time_to_deadline = (deadline - now).total_seconds()

            # Within 5 minutes of deadline — Critical Alert
            if 0 < time_to_deadline <= 300:
                print(f"[SLA ALERT] Order {order.id} — {int(time_to_deadline)}s to deadline!")
                await manager.emit_to_role(
                    restaurant_id=str(order.restaurant_id),
                    role="cashier",
                    event="sla_critical_alert",
                    data={
                        "order_id": str(order.id),
                        "aggregator_order_id": order.aggregator_order_id,
                        "seconds_remaining": int(time_to_deadline),
                        "alert_type": "critical",
                        "message": "⚠️ Order approaching SLA deadline!",
                        "action": "red_flash",  # Frontend uses this to flash red
                    }
                )

            # Deadline PASSED — Penalty Alert
            elif time_to_deadline <= 0:
                await manager.emit_to_role(
                    restaurant_id=str(order.restaurant_id),
                    role="cashier",
                    event="sla_breached",
                    data={
                        "order_id": str(order.id),
                        "aggregator_order_id": order.aggregator_order_id,
                        "message": "🚨 SLA BREACHED! Platform penalty risk!",
                        "action": "loud_beep",
                    }
                )


async def start_sla_monitor():
    """
    Runs every 60 seconds in background
    Checks all active aggregator orders
    """
    while True:
        try:
            await check_sla_violations()
        except Exception as e:
            print(f"[SLA Monitor Error] {e}")
        await asyncio.sleep(60)  # Check every 60 seconds