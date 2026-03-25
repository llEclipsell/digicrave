import uuid
from sqlalchemy import String, Boolean, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin
from decimal import Decimal
from sqlalchemy import Numeric

class Customer(Base, TimestampMixin):
    """
    Blueprint Module 5: CRM
    - phone_encrypted: AES-256 (DPDP Act compliance)
    - name_encrypted: AES-256
    - consent_timestamp + consent_ip: audit log for marketing opt-in
    """
    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    phone_encrypted: Mapped[str] = mapped_column(String(500), nullable=False)
    phone_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    name_encrypted: Mapped[str | None] = mapped_column(String(500), nullable=True)
    consent_timestamp: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    consent_ip: Mapped[str | None] = mapped_column(String(50), nullable=True)

    restaurant_links = relationship("RestaurantCustomer", back_populates="customer")



class RestaurantCustomer(Base, TimestampMixin):
    """
    Blueprint: The Relationship Bridge
    - marketing_opt_in: REQUIRED for MSG91 blasts (Golden Rule 4)
    """
    __tablename__ = "restaurant_customers"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id"), nullable=False)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id"), nullable=False)
    marketing_opt_in: Mapped[bool] = mapped_column(Boolean, default=False)
    visit_count: Mapped[int] = mapped_column(Integer, default=0)
    last_visit_date: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)

    customer = relationship("Customer", back_populates="restaurant_links")

class MarketingCampaign(Base, TimestampMixin):
    """Blueprint Module 8: Campaign history"""
    __tablename__ = "marketing_campaigns"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("restaurants.id"), nullable=False
    )
    template_id: Mapped[str] = mapped_column(String(100), nullable=False)
    recipients_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="queued")
    # ENUM: queued | sent | failed
    cost_deducted: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)