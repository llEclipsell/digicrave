import uuid
from decimal import Decimal
from sqlalchemy import String, Integer, Numeric, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin

class Order(Base, TimestampMixin):
    """
    Blueprint Module 3: Omnichannel Orders
    - source: qr_scan | pos_manual | zomato | swiggy
    - kitchen_status: received | preparing | ready | served
    - payment_status: pending | paid_digital | paid_cash | payment_pending
    - idempotency_key: prevents duplicate orders
    - preparation_deadline: for aggregator SLA timer
    """
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id"), nullable=False)
    table_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tables.id"), nullable=True)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customers.id"), nullable=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    kitchen_status: Mapped[str] = mapped_column(String(20), default="received")
    payment_status: Mapped[str] = mapped_column(String(20), default="pending")
    aggregator_order_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    preparation_deadline: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)

    restaurant = relationship("Restaurant", back_populates="orders")
    items = relationship("OrderItem", back_populates="order")
    transaction = relationship("Transaction", back_populates="order", uselist=False)


class OrderItem(Base, TimestampMixin):
    """
    Blueprint: historical_price_at_order
    Locks price at time of order — if owner changes price tomorrow,
    this order stays at what customer actually paid.
    """
    __tablename__ = "order_items"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id"), nullable=False)
    menu_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("menu_items.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    historical_price_at_order: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)

    order = relationship("Order", back_populates="items")
    menu_item = relationship("MenuItem")