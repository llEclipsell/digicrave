import uuid
from decimal import Decimal
from sqlalchemy import String, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin
from sqlalchemy import Boolean
from decimal import Decimal

class Restaurant(Base, TimestampMixin):
    """Blueprint Module 1: Multi-Tenant Foundation"""
    __tablename__ = "restaurants"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    address: Mapped[str] = mapped_column(String(500), nullable=True)
    gst_number: Mapped[str] = mapped_column(String(20), nullable=True)
    razorpay_account_id: Mapped[str] = mapped_column(String(100), nullable=True)
    whatsapp_credit_balance: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)

    # Relationships
    tables = relationship("Table", back_populates="restaurant")
    menu_items = relationship("MenuItem", back_populates="restaurant")
    orders = relationship("Order", back_populates="restaurant")


class Table(Base, TimestampMixin):
    """Blueprint Module 1 — Table 2"""
    __tablename__ = "tables"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id"), nullable=False)
    table_number: Mapped[str] = mapped_column(String(20), nullable=False)
    qr_token_secret: Mapped[str] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(
        String(30), default="empty"
        # ENUM: empty | seated | waiting_for_food
    )

    restaurant = relationship("Restaurant", back_populates="tables")
    orders = relationship("Order", back_populates="table")

class RestaurantSettings(Base, TimestampMixin):
    """
    Blueprint Module 9: Per-restaurant GST and discount settings
    """
    __tablename__ = "restaurant_settings"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("restaurants.id"), unique=True, nullable=False
    )
    gst_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=5.00)
    global_qr_discount_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0.00)
    aggregator_paused: Mapped[bool] = mapped_column(Boolean, default=False)