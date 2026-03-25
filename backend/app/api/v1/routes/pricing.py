from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from decimal import Decimal
from typing import List
import uuid

from app.core.database import get_db
from app.api.v1.dependencies import get_restaurant_id, get_valid_restaurant
from app.models.menu import MenuItem
from app.models.restaurant import Restaurant
from app.schemas.pricing import (
    CartValidateRequest, CartValidateResponse,
    CalculateBillRequest, CalculateBillResponse,
    BillBreakdownResponse, LineItemResponse
)
from app.services.pricing import calculate_bill, CartItemInput

router = APIRouter()


@router.post("/cart/validate", response_model=CartValidateResponse)
async def validate_cart(
    request: CartValidateRequest,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint Module 1: POST /cart/validate
    Checks item availability and stock status.
    Anonymous access — no auth required.
    """
    item_ids = [item.menu_item_id for item in request.items]

    result = await db.execute(
        select(MenuItem).where(
            MenuItem.id.in_(item_ids),
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.deleted_at == None
        )
    )
    db_items = result.scalars().all()

    # Check all items belong to this restaurant
    found_ids = {item.id for item in db_items}
    requested_ids = {uuid.UUID(str(item.menu_item_id)) for item in request.items}

    unavailable = []
    for item in db_items:
        if not item.is_available:
            unavailable.append(item.name)

    # Check for items not found at all
    missing_ids = requested_ids - found_ids
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"{len(missing_ids)} item(s) not found in this restaurant's menu"
        )

    return CartValidateResponse(
        available=len(unavailable) == 0,
        unavailable_items=unavailable
    )


@router.post("/order/calculate-bill", response_model=CalculateBillResponse)
async def calculate_bill_endpoint(
    request: CalculateBillRequest,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint Module 2: POST /order/calculate-bill
    The Math:
    1. Base Price - Discount
    2. Add GST
    3. Add ₹3 Platform Fee
    4. Add 2% Gateway Fee
    5. Pricing Shield: QR Total must < Offline Total
    """
    item_ids = [item.menu_item_id for item in request.items]

    result = await db.execute(
        select(MenuItem).where(
            MenuItem.id.in_(item_ids),
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.deleted_at == None
        )
    )
    db_items = {item.id: item for item in result.scalars().all()}

    # Build CartItemInput list for pricing engine
    cart_inputs = []
    for cart_item in request.items:
        item_id = uuid.UUID(str(cart_item.menu_item_id))
        db_item = db_items.get(item_id)

        if not db_item:
            raise HTTPException(
                status_code=404,
                detail=f"Item {cart_item.menu_item_id} not found"
            )

        cart_inputs.append(CartItemInput(
            menu_item_id=str(cart_item.menu_item_id),
            quantity=cart_item.quantity,
            price_offline=db_item.price_offline,
            qr_discount_percent=db_item.qr_discount_percent,
            name=db_item.name,
            is_available=db_item.is_available,
        ))

    # Run pricing engine
    bill = calculate_bill(cart_inputs)

    return CalculateBillResponse(
        bill=BillBreakdownResponse(
            line_items=[
                LineItemResponse(
                    menu_item_id=li.menu_item_id,
                    name=li.name,
                    quantity=li.quantity,
                    price_offline=li.price_offline,
                    qr_discount_percent=li.qr_discount_percent,
                    discounted_unit_price=li.discounted_unit_price,
                    line_total=li.line_total,
                )
                for li in bill.line_items
            ],
            subtotal_offline=bill.subtotal_offline,
            subtotal_qr_discounted=bill.subtotal_qr_discounted,
            gst_amount=bill.gst_amount,
            platform_fee=bill.platform_fee,
            gateway_fee=bill.gateway_fee,
            total_qr_price=bill.total_qr_price,
            total_offline_price=bill.total_offline_price,
            customer_savings=bill.customer_savings,
            pricing_shield_passed=bill.pricing_shield_passed,
        ),
        final_total=bill.total_qr_price,
    )