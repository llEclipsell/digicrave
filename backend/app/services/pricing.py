from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass
from typing import List
from fastapi import HTTPException
from app.core.config import settings


@dataclass
class CartItemInput:
    menu_item_id: str
    quantity: int
    price_offline: Decimal
    qr_discount_percent: Decimal
    name: str
    is_available: bool


@dataclass
class LineItem:
    menu_item_id: str
    name: str
    quantity: int
    price_offline: Decimal
    qr_discount_percent: Decimal
    discounted_unit_price: Decimal
    line_total: Decimal


@dataclass
class BillBreakdown:
    line_items: List[LineItem]
    subtotal_offline: Decimal        # What it would cost offline
    subtotal_qr_discounted: Decimal  # After QR discount
    gst_amount: Decimal              # GST on discounted amount
    platform_fee: Decimal            # Exactly ₹3.00 (your profit)
    gateway_fee: Decimal             # 2% Razorpay cut
    total_qr_price: Decimal          # What customer pays
    total_offline_price: Decimal     # Offline comparison
    customer_savings: Decimal        # How much customer saved
    pricing_shield_passed: bool      # Blueprint Golden Rule 1


def calculate_bill(
    items: List[CartItemInput],
    gst_percent: Decimal = Decimal("5.00")  # Default 5% GST, overridable per restaurant
) -> BillBreakdown:
    """
    Blueprint Pricing Engine — Golden Rule 1 (The Pricing Shield):
    Total_QR_Price must ALWAYS be < Total_Offline_Price

    Formula:
    1. discounted_price = offline_price * (1 - discount_percent/100)
    2. subtotal = sum of all line totals
    3. gst = subtotal * gst_percent / 100
    4. platform_fee = ₹3.00 (flat, always)
    5. gateway_fee = (subtotal + gst) * 2%
    6. final_total = subtotal + gst + platform_fee + gateway_fee
    """

    # --- Step 1: Validate all items are available ---
    for item in items:
        if not item.is_available:
            raise HTTPException(
                status_code=400,
                detail=f"'{item.name}' is currently out of stock"
            )

    # --- Step 2: Calculate line items ---
    line_items = []
    subtotal_offline = Decimal("0")
    subtotal_qr_discounted = Decimal("0")

    for item in items:
        qty = Decimal(str(item.quantity))

        # Offline price for this line
        offline_line = (item.price_offline * qty).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        # QR discounted unit price
        discount_multiplier = Decimal("1") - (item.qr_discount_percent / Decimal("100"))
        discounted_unit = (item.price_offline * discount_multiplier).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        discounted_line = (discounted_unit * qty).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        subtotal_offline += offline_line
        subtotal_qr_discounted += discounted_line

        line_items.append(LineItem(
            menu_item_id=item.menu_item_id,
            name=item.name,
            quantity=item.quantity,
            price_offline=item.price_offline,
            qr_discount_percent=item.qr_discount_percent,
            discounted_unit_price=discounted_unit,
            line_total=discounted_line,
        ))

    # --- Step 3: GST on discounted subtotal ---
    gst_amount = (subtotal_qr_discounted * gst_percent / Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    # --- Step 4: Platform fee (Blueprint: exactly ₹3.00) ---
    platform_fee = Decimal(str(settings.PLATFORM_FEE))

    # --- Step 5: Gateway fee (Blueprint: 2% on subtotal + GST) ---
    gateway_fee = (
        (subtotal_qr_discounted + gst_amount) *
        Decimal(str(settings.GATEWAY_FEE_PERCENT))
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # --- Step 6: Final QR total ---
    total_qr_price = (
        subtotal_qr_discounted + gst_amount + platform_fee + gateway_fee
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    total_offline_price = subtotal_offline.quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    # --- Step 7: Blueprint Golden Rule 1 — Pricing Shield ---
    pricing_shield_passed = total_qr_price < total_offline_price

    if not pricing_shield_passed:
        # Auto-adjust: force QR price to be ₹1 less than offline
        # Blueprint: "Auto-adjust discount to ensure customer wins"
        adjustment = total_qr_price - total_offline_price + Decimal("1.00")
        subtotal_qr_discounted = (subtotal_qr_discounted - adjustment).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        gst_amount = (subtotal_qr_discounted * gst_percent / Decimal("100")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        gateway_fee = (
            (subtotal_qr_discounted + gst_amount) *
            Decimal(str(settings.GATEWAY_FEE_PERCENT))
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total_qr_price = (
            subtotal_qr_discounted + gst_amount + platform_fee + gateway_fee
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        pricing_shield_passed = True  # Now enforced

    customer_savings = (total_offline_price - total_qr_price).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    return BillBreakdown(
        line_items=line_items,
        subtotal_offline=total_offline_price,
        subtotal_qr_discounted=subtotal_qr_discounted,
        gst_amount=gst_amount,
        platform_fee=platform_fee,
        gateway_fee=gateway_fee,
        total_qr_price=total_qr_price,
        total_offline_price=total_offline_price,
        customer_savings=customer_savings,
        pricing_shield_passed=pricing_shield_passed,
    )