from pydantic import BaseModel, UUID4
from decimal import Decimal
from typing import List, Optional
from app.schemas.pricing import CartItemSchema


class CreateOrderRequest(BaseModel):
    items: List[CartItemSchema]
    table_id: Optional[str] = None
    payment_method: str  # "upi" or "cash"
    idempotency_key: str
    special_instructions: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    marketing_opt_in: Optional[bool] = None


class CreateOrderResponse(BaseModel):
    order_id: str
    razorpay_order_id: Optional[str]  # None for cash orders
    payment_method: str
    final_amount: Decimal
    message: str


class RazorpayWebhookPayload(BaseModel):
    event: str
    payload: dict


class RazorpayOrderRequest(BaseModel):
    order_id: Optional[str] = None
    order_ids: Optional[List[str]] = None

class RazorpayOrderResponse(BaseModel):
    keyId: str
    amount: int
    currency: str
    razorpayOrderId: str


class BillSummary(BaseModel):
    subtotal: Decimal
    gst: Decimal
    platform_fee: Decimal
    gateway_fee: Decimal
    total: Decimal
    customer_savings: Decimal