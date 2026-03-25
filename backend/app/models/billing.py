import uuid
from decimal import Decimal
from sqlalchemy import String, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.models.base import TimestampMixin

class RestaurantBilling(Base, TimestampMixin):
    """
    Blueprint: Tracks ₹3 debt for Cash/Manual orders
    If unpaid_manual_fees > ₹1000, POS locks (402 Payment Required)
    """
    __tablename__ = "restaurant_billing"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id"), unique=True, nullable=False)
    unpaid_manual_fees: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)


class SaasSettlement(Base, TimestampMixin):
    """Blueprint: Records when owner pays their platform debt"""
    __tablename__ = "saas_settlements"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id"), nullable=False)
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    fee_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # ENUM: PLATFORM_DEBT | WHATSAPP_CREDITS
    razorpay_payment_id: Mapped[str | None] = mapped_column(String(100), nullable=True)