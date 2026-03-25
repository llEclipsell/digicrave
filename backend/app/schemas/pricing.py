from pydantic import BaseModel, UUID4, field_validator
from decimal import Decimal
from typing import List


class CartItemSchema(BaseModel):
    menu_item_id: UUID4
    quantity: int

    @field_validator("quantity")
    @classmethod
    def quantity_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("Quantity must be at least 1")
        return v


class LineItemResponse(BaseModel):
    menu_item_id: str
    name: str
    quantity: int
    price_offline: Decimal
    qr_discount_percent: Decimal
    discounted_unit_price: Decimal
    line_total: Decimal


class BillBreakdownResponse(BaseModel):
    line_items: List[LineItemResponse]
    subtotal_offline: Decimal
    subtotal_qr_discounted: Decimal
    gst_amount: Decimal
    platform_fee: Decimal
    gateway_fee: Decimal
    total_qr_price: Decimal
    total_offline_price: Decimal
    customer_savings: Decimal
    pricing_shield_passed: bool


class CartValidateRequest(BaseModel):
    items: List[CartItemSchema]


class CartValidateResponse(BaseModel):
    available: bool
    unavailable_items: List[str]


class CalculateBillRequest(BaseModel):
    items: List[CartItemSchema]
    table_id: UUID4


class CalculateBillResponse(BaseModel):
    bill: BillBreakdownResponse
    final_total: Decimal