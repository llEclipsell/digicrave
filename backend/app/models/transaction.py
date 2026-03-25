import uuid
from decimal import Decimal
from sqlalchemy import String, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin

class Transaction(Base, TimestampMixin):
    """
    Blueprint Module 4: Financial Math Engine
    - platform_fee: exactly ₹3.00 (YOUR profit)
    - gateway_fee: Razorpay's 2% cut
    - net_to_restaurant: what owner actually receives
    - razorpay_transfer_id: proof of split payment
    """
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id"), nullable=False)
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    platform_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=3.00)
    gateway_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    net_to_restaurant: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    razorpay_payment_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    razorpay_transfer_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    order = relationship("Order", back_populates="transaction")