import uuid
from decimal import Decimal
from sqlalchemy import String, Text, Numeric, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin

class Category(Base, TimestampMixin):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    items = relationship("MenuItem", back_populates="category")


class MenuItem(Base, TimestampMixin):
    """
    Blueprint Module 2: Catalog
    - price_offline: base printed price
    - qr_discount_percent: discount for QR orders
    - is_available: Out of Stock toggle
    """
    __tablename__ = "menu_items"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id"), nullable=False)
    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("categories.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    price_offline: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    qr_discount_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    aggregator_mapping_id: Mapped[str] = mapped_column(String(100), nullable=True)
    image_url: Mapped[str] = mapped_column(String(500), nullable=True)

    category = relationship("Category", back_populates="items")
    restaurant = relationship("Restaurant", back_populates="menu_items")


class ItemCrossSell(Base, TimestampMixin):
    """Blueprint: AOV Multiplier — 'Pairs perfectly with...'"""
    __tablename__ = "item_cross_sells"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    base_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("menu_items.id"), nullable=False)
    suggested_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("menu_items.id"), nullable=False)