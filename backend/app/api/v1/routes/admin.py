from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import List, Optional
from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime, timezone
import uuid
from app.core.websocket import manager
from app.core.database import get_db
from app.api.v1.dependencies import (
    get_valid_restaurant, get_current_owner
)
from app.models.restaurant import Restaurant, Table
from app.models.staff import Staff
from app.models.menu import MenuItem, Category, ItemCrossSell
from app.models.order import Order
from app.models.transaction import Transaction
from app.models.customer import Customer, RestaurantCustomer
from app.models.billing import RestaurantBilling, SaasSettlement
from app.core.security import hash_password, decrypt_field
from app.models.restaurant import RestaurantSettings
from app.models.customer import MarketingCampaign
from app.models.billing import RestaurantBilling, SaasSettlement
from fastapi import UploadFile, File
from sqlalchemy import select, func, and_

router = APIRouter()


# --- Schemas ---
class StaffCreateRequest(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    role: str  # cashier | chef | waiter
    password: str


class StaffResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: Optional[str]
    role: str

    model_config = {"from_attributes": True}


class TableCreateRequest(BaseModel):
    table_number: str


class TableResponse(BaseModel):
    id: uuid.UUID
    table_number: str
    status: str
    qr_link: str

    model_config = {"from_attributes": True}


class CategoryCreateRequest(BaseModel):
    name: str


class MenuItemUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_offline: Optional[Decimal] = None
    qr_discount_percent: Optional[Decimal] = None
    is_available: Optional[bool] = None


class RecommendationRequest(BaseModel):
    base_item_id: uuid.UUID
    suggested_item_id: uuid.UUID


class DashboardResponse(BaseModel):
    total_orders: int
    gross_revenue: Decimal
    net_revenue: Decimal
    platform_fees_paid: Decimal
    source_breakdown: dict


class SettingsUpdateRequest(BaseModel):
    gst_percent: Optional[Decimal] = None
    qr_discount_percent: Optional[Decimal] = None


class MarketingBlastRequest(BaseModel):
    template_id: str
    audience_filter: Optional[dict] = None


class CustomerResponse(BaseModel):
    id: uuid.UUID
    phone: str
    name: Optional[str]
    visit_count: int
    marketing_opt_in: bool


# --- Staff Management ---
@router.get("/admin/staff", response_model=List[StaffResponse])
async def list_staff(
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Staff).where(
            Staff.restaurant_id == restaurant.id,
            Staff.deleted_at == None
        )
    )
    return [StaffResponse.model_validate(s) for s in result.scalars().all()]


@router.post("/admin/staff", status_code=201)
async def add_staff(
    request: StaffCreateRequest,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
):
    valid_roles = ["cashier", "chef", "waiter"]
    if request.role not in valid_roles:
        raise HTTPException(
            status_code=400,
            detail=f"Role must be one of: {valid_roles}"
        )

    staff = Staff(
        id=uuid.uuid4(),
        restaurant_id=restaurant.id,
        name=request.name,
        phone=request.phone,
        email=request.email,
        role=request.role,
        hashed_password=hash_password(request.password),
    )
    db.add(staff)
    await db.commit()
    return {"staff_id": str(staff.id), "message": "Staff added successfully"}


@router.delete("/admin/staff/{staff_id}", status_code=204)
async def remove_staff(
    staff_id: uuid.UUID,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Staff).where(
            Staff.id == staff_id,
            Staff.restaurant_id == restaurant.id,
            Staff.deleted_at == None
        )
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    # Soft delete
    staff.deleted_at = datetime.now(timezone.utc)
    await db.commit()


# --- Table Management ---
@router.post("/admin/tables", status_code=201, response_model=TableResponse)
async def create_table(
    request: TableCreateRequest,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint Module 6: Create table + generate QR token
    """
    import secrets
    from app.core.config import settings

    qr_secret = secrets.token_urlsafe(32)
    table = Table(
        id=uuid.uuid4(),
        restaurant_id=restaurant.id,
        table_number=request.table_number,
        qr_token_secret=qr_secret,
        status="empty",
    )
    db.add(table)
    await db.commit()

    # QR link contains signed token
    qr_link = f"https://digicrave.app/menu/{restaurant.slug}?table={table.id}&token={qr_secret}"

    return TableResponse(
        id=table.id,
        table_number=table.table_number,
        status=table.status,
        qr_link=qr_link,
    )


# --- Menu Management ---
@router.post("/admin/categories", status_code=201)
async def create_category(
    request: CategoryCreateRequest,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
):
    category = Category(
        id=uuid.uuid4(),
        restaurant_id=restaurant.id,
        name=request.name,
    )
    db.add(category)
    await db.commit()
    return {"category_id": str(category.id), "name": category.name}


@router.delete("/admin/categories/{category_id}")
async def delete_category(
    category_id: uuid.UUID,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(
            Category.id == category_id,
            Category.restaurant_id == restaurant.id,
            Category.deleted_at == None
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    category.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Category deleted"}


@router.put("/admin/menu/item/{item_id}")
async def update_menu_item(
    item_id: uuid.UUID,
    request: MenuItemUpdateRequest,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint: If Out of Stock → WebSocket to QR menus instantly
    """
    result = await db.execute(
        select(MenuItem).where(
            MenuItem.id == item_id,
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.deleted_at == None
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    if request.name is not None:
        item.name = request.name
    if request.description is not None:
        item.description = request.description
    if request.price_offline is not None:
        item.price_offline = request.price_offline
    if request.qr_discount_percent is not None:
        item.qr_discount_percent = request.qr_discount_percent
    if request.is_available is not None:
        item.is_available = request.is_available
        # Blueprint: WebSocket emit — Phase 8
        if request.is_available is not None:
            item.is_available = request.is_available
            await manager.emit_to_all(
                restaurant_id=str(restaurant.id),
                event="menu_item_updated",
                data={
                    "item_id": str(item_id),
                    "is_available": request.is_available,
                    "name": item.name,
                }
            )

    await db.commit()
    return {"message": "Menu item updated", "item_id": str(item_id)}


@router.post("/admin/menu/recommendations", status_code=201)
async def create_recommendation(
    request: RecommendationRequest,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
):
    """Blueprint Module 7: AOV Multiplier mapping"""
    cross_sell = ItemCrossSell(
        id=uuid.uuid4(),
        base_item_id=request.base_item_id,
        suggested_item_id=request.suggested_item_id,
    )
    db.add(cross_sell)
    await db.commit()
    return {"map_id": str(cross_sell.id), "message": "Recommendation mapped"}


# --- Dashboard & Analytics ---
@router.get("/admin/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint Module 5: Financial Analytics
    - Gross Revenue
    - Net Settlement
    - Source Breakdown
    """
    # Total orders
    orders_result = await db.execute(
        select(func.count(Order.id)).where(
            Order.restaurant_id == restaurant.id,
            Order.deleted_at == None
        )
    )
    total_orders = orders_result.scalar() or 0

    # Financial totals from transactions
    tx_result = await db.execute(
        select(
            func.sum(Transaction.gross_amount),
            func.sum(Transaction.net_to_restaurant),
            func.sum(Transaction.platform_fee),
        ).join(Order, Transaction.order_id == Order.id).where(
            Order.restaurant_id == restaurant.id
        )
    )
    row = tx_result.one()
    gross = row[0] or Decimal("0")
    net = row[1] or Decimal("0")
    platform = row[2] or Decimal("0")

    # Source breakdown
    source_result = await db.execute(
        select(Order.source, func.count(Order.id)).where(
            Order.restaurant_id == restaurant.id,
            Order.deleted_at == None
        ).group_by(Order.source)
    )
    source_breakdown = {row[0]: row[1] for row in source_result.all()}

    return DashboardResponse(
        total_orders=total_orders,
        gross_revenue=gross,
        net_revenue=net,
        platform_fees_paid=platform,
        source_breakdown=source_breakdown,
    )


# --- CRM ---
@router.get("/admin/customers")
async def list_customers(
    limit: int = 20,
    offset: int = 0,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint Module 8: Offset-based pagination for CRM
    Only opted-in customers — Golden Rule 4
    """
    from app.schemas.pagination import make_paginated_response

    limit = min(limit, 100)

    # Total count
    count_result = await db.execute(
        select(func.count(RestaurantCustomer.id)).where(
            RestaurantCustomer.restaurant_id == restaurant.id,
            RestaurantCustomer.marketing_opt_in == True,
        )
    )
    total_count = count_result.scalar() or 0

    result = await db.execute(
        select(RestaurantCustomer, Customer).join(
            Customer, RestaurantCustomer.customer_id == Customer.id
        ).where(
            RestaurantCustomer.restaurant_id == restaurant.id,
            RestaurantCustomer.marketing_opt_in == True,
        ).limit(limit).offset(offset)
    )
    rows = result.all()

    customers = []
    for rc, customer in rows:
        phone = decrypt_field(customer.phone_encrypted)
        name = decrypt_field(customer.name_encrypted) if customer.name_encrypted else None
        customers.append({
            "id": str(customer.id),
            "phone": phone,
            "name": name,
            "visit_count": rc.visit_count,
            "marketing_opt_in": rc.marketing_opt_in,
        })

    return make_paginated_response(
        items=customers,
        total_count=total_count,
        limit=limit,
        offset=offset,
    )


# --- Marketing ---
@router.post("/admin/marketing/blast")
async def send_marketing_blast(
    request: MarketingBlastRequest,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint Module 5: WhatsApp Campaign
    1. Check wallet balance
    2. Filter opted-in customers
    3. Queue Celery task
    """
    from app.tasks.marketing import send_whatsapp_blast
    from app.core.security import decrypt_field

    # Check wallet balance
    if restaurant.whatsapp_credit_balance <= 0:
        raise HTTPException(
            status_code=402,
            detail="Insufficient WhatsApp credits. Please recharge wallet."
        )

    # Fetch opted-in customers
    result = await db.execute(
        select(RestaurantCustomer, Customer).join(
            Customer, RestaurantCustomer.customer_id == Customer.id
        ).where(
            RestaurantCustomer.restaurant_id == restaurant.id,
            RestaurantCustomer.marketing_opt_in == True,
        )
    )
    rows = result.all()
    phone_list = [decrypt_field(c.phone_encrypted) for _, c in rows]

    if not phone_list:
        raise HTTPException(status_code=400, detail="No opted-in customers found")


    # Record campaign in DB
    campaign = MarketingCampaign(
        id=uuid.uuid4(),
        restaurant_id=restaurant.id,
        template_id=request.template_id,
        recipients_count=len(phone_list),
        status="queued",
        cost_deducted=Decimal(str(len(phone_list) * 0.50)),  # ₹0.50 per message
    )
    db.add(campaign)

    # Deduct from wallet
    restaurant.whatsapp_credit_balance -= campaign.cost_deducted
    await db.commit()

    # Queue background task
    send_whatsapp_blast.delay(
        phone_list=phone_list,
        template_id=request.template_id,
        restaurant_id=str(restaurant.id),
    )

    return {
        "message": "Campaign queued",
        "recipients": len(phone_list),
        "cost_deducted": float(campaign.cost_deducted),
        "remaining_balance": float(restaurant.whatsapp_credit_balance),
    }



@router.post("/admin/wallet/recharge")
async def recharge_wallet(
    amount: Decimal,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
):
    """Blueprint: Create Razorpay session for wallet recharge"""
    import razorpay
    from app.core.config import settings

    client = razorpay.Client(
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
    )
    order = client.order.create({
        "amount": int(amount * 100),
        "currency": "INR",
        "notes": {
            "type": "wallet_recharge",
            "restaurant_id": str(restaurant.id),
        }
    })
    return {"rzp_session": order["id"], "amount": float(amount)}


# --- Settings ---
@router.patch("/admin/settings")
async def update_settings(
    request: SettingsUpdateRequest,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
):
    """Blueprint Module 9: Update GST/discount settings"""
    # These would be stored in a restaurant_settings table
    # For now updating restaurant record
    await db.commit()
    return {"message": "Settings updated", "settings": request.model_dump(exclude_none=True)}


# --- Aggregator ---
@router.get("/admin/aggregator/status")
async def aggregator_status(
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
):
    """
    Blueprint Module 9: Check Swiggy/Zomato connection
    UrbanPiper integration — placeholder until post-deployment
    """
    return {
        "swiggy": False,
        "zomato": False,
        "urbanpiper": "not_configured",
        "message": "Aggregator integration coming post-deployment"
    }


@router.post("/admin/aggregator/toggle-all")
async def toggle_aggregators(
    action: str,  # "ON" or "OFF"
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
):
    """Blueprint: Master switch for all delivery apps"""
    if action not in ["ON", "OFF"]:
        raise HTTPException(status_code=400, detail="Action must be ON or OFF")

    # Placeholder — UrbanPiper post-deployment
    print(f"[AGGREGATOR] {action} for restaurant {restaurant.id}")
    return {"status": "offline" if action == "OFF" else "online"}

# --- Marketing History ---
@router.get("/admin/marketing/history")
async def marketing_history(
    limit: int = 20,
    offset: int = 0,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
):
    from app.schemas.pagination import make_paginated_response

    limit = min(limit, 100)

    count_result = await db.execute(
        select(func.count(MarketingCampaign.id)).where(
            MarketingCampaign.restaurant_id == restaurant.id
        )
    )
    total_count = count_result.scalar() or 0

    result = await db.execute(
        select(MarketingCampaign).where(
            MarketingCampaign.restaurant_id == restaurant.id
        ).order_by(MarketingCampaign.created_at.desc())
        .limit(limit).offset(offset)
    )
    campaigns = result.scalars().all()

    items = [
        {
            "id": str(c.id),
            "template_id": c.template_id,
            "recipients_count": c.recipients_count,
            "status": c.status,
            "cost_deducted": float(c.cost_deducted),
            "created_at": str(c.created_at),
        }
        for c in campaigns
    ]

    return make_paginated_response(
        items=items,
        total_count=total_count,
        limit=limit,
        offset=offset,
    )


# --- Wallet Transactions ---
@router.get("/admin/wallet/transactions")
async def wallet_transactions(
    limit: int = 20,
    offset: int = 0,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
):
    """Blueprint Module 8: WhatsApp wallet recharge history"""
    result = await db.execute(
        select(SaasSettlement).where(
            SaasSettlement.restaurant_id == restaurant.id
        ).order_by(SaasSettlement.created_at.desc())
        .limit(limit).offset(offset)
    )
    settlements = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "amount_paid": float(s.amount_paid),
            "fee_type": s.fee_type,
            "razorpay_payment_id": s.razorpay_payment_id,
            "created_at": str(s.created_at),
        }
        for s in settlements
    ]


# --- Billing Settlement ---
@router.post("/admin/billing/settle")
async def settle_billing(
    amount: Decimal,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint: POST /admin/billing/settle
    Owner pays platform debt via Razorpay
    """
    import razorpay
    from app.core.config import settings

    # Check current debt
    result = await db.execute(
        select(RestaurantBilling).where(
            RestaurantBilling.restaurant_id == restaurant.id
        )
    )
    billing = result.scalar_one_or_none()
    if not billing or billing.unpaid_manual_fees <= 0:
        raise HTTPException(status_code=400, detail="No outstanding fees")

    client = razorpay.Client(
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
    )
    order = client.order.create({
        "amount": int(amount * 100),
        "currency": "INR",
        "notes": {
            "type": "platform_debt_settlement",
            "restaurant_id": str(restaurant.id),
        }
    })
    return {
        "rzp_order_id": order["id"],
        "amount": float(amount),
        "current_debt": float(billing.unpaid_manual_fees),
        "message": "Complete payment to unlock POS"
    }


# --- Billing Settlement Webhook ---
@router.post("/admin/billing/webhook")
async def billing_settlement_webhook(
    request_body: dict,
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint: Upon payment.captured
    Deduct from unpaid_manual_fees
    Insert into saas_settlements
    Send WebSocket to POS to unlock
    """
    from app.core.websocket import manager

    event = request_body.get("event")
    if event != "payment.captured":
        return {"status": "ignored"}

    payment = request_body.get("payload", {}).get("payment", {}).get("entity", {})
    notes = payment.get("notes", {})
    restaurant_id = notes.get("restaurant_id")
    fee_type = notes.get("type", "PLATFORM_DEBT")

    if not restaurant_id:
        return {"status": "ignored"}

    amount = payment.get("amount", 0) / 100
    rid = uuid.UUID(restaurant_id)

    # Deduct from billing
    result = await db.execute(
        select(RestaurantBilling).where(
            RestaurantBilling.restaurant_id == rid
        )
    )
    billing = result.scalar_one_or_none()
    if billing:
        billing.unpaid_manual_fees = max(
            Decimal("0"),
            billing.unpaid_manual_fees - Decimal(str(amount))
        )

    # Record settlement
    settlement = SaasSettlement(
        id=uuid.uuid4(),
        restaurant_id=rid,
        amount_paid=Decimal(str(amount)),
        fee_type="PLATFORM_DEBT",
        razorpay_payment_id=payment.get("id"),
    )
    db.add(settlement)
    await db.commit()

    # Unlock POS via WebSocket
    await manager.emit_to_role(
        restaurant_id=restaurant_id,
        role="cashier",
        event="billing_unlocked",
        data={
            "message": "Platform fees settled. POS unlocked!",
            "amount_paid": amount,
        }
    )

    return {"status": "success"}


# --- Update Settings ---
@router.patch("/admin/settings")
async def update_settings(
    request: SettingsUpdateRequest,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
):
    """Blueprint Module 9: Update GST + discount per restaurant"""
    result = await db.execute(
        select(RestaurantSettings).where(
            RestaurantSettings.restaurant_id == restaurant.id
        )
    )
    settings_obj = result.scalar_one_or_none()

    if not settings_obj:
        settings_obj = RestaurantSettings(
            id=uuid.uuid4(),
            restaurant_id=restaurant.id,
        )
        db.add(settings_obj)

    if request.gst_percent is not None:
        settings_obj.gst_percent = request.gst_percent
    if request.qr_discount_percent is not None:
        settings_obj.global_qr_discount_percent = request.qr_discount_percent

    await db.commit()
    return {
        "message": "Settings updated",
        "gst_percent": float(settings_obj.gst_percent),
        "qr_discount_percent": float(settings_obj.global_qr_discount_percent),
    }


# --- Aggregator Toggle ---
@router.post("/admin/aggregator/toggle-all")
async def toggle_aggregators(
    action: str,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
):
    """Blueprint Module 9: Master switch for delivery apps"""
    if action not in ["ON", "OFF"]:
        raise HTTPException(status_code=400, detail="Action must be ON or OFF")

    result = await db.execute(
        select(RestaurantSettings).where(
            RestaurantSettings.restaurant_id == restaurant.id
        )
    )
    settings_obj = result.scalar_one_or_none()

    if not settings_obj:
        settings_obj = RestaurantSettings(
            id=uuid.uuid4(),
            restaurant_id=restaurant.id,
            aggregator_paused=(action == "OFF"),
        )
        db.add(settings_obj)
    else:
        settings_obj.aggregator_paused = (action == "OFF")

    await db.commit()
    return {
        "status": "offline" if action == "OFF" else "online",
        "message": f"All aggregators turned {action}"
    }

@router.post("/admin/menu/upload-image")
async def upload_menu_image(
    file: UploadFile = File(...),
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
):
    """
    Blueprint Module 7: Image Upload
    Security:
    1. 5MB size limit
    2. MIME type validation
    3. UUID filename (prevents directory traversal)
    Stores locally for now — S3 post-deployment
    """
    import magic
    import shutil
    import os

    # Size check — 5MB
    MAX_SIZE = 5 * 1024 * 1024
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 5MB.")

    # MIME validation using python-magic
    mime_type = magic.from_buffer(contents, mime=True)
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if mime_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {mime_type}. Only JPEG/PNG/WebP allowed."
        )

    # UUID filename — prevents directory traversal
    ext = mime_type.split("/")[1]
    filename = f"{uuid.uuid4()}.{ext}"

    # Save locally for now
    upload_dir = "uploads/menu_images"
    os.makedirs(upload_dir, exist_ok=True)
    filepath = f"{upload_dir}/{filename}"

    with open(filepath, "wb") as f:
        f.write(contents)

    # In production: upload to S3/Cloudinary and return URL
    image_url = f"http://localhost:8000/uploads/{filename}"

    return {"image_url": image_url}

@router.get("/admin/tables/export")
async def export_qr_codes(
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint Module 6: Export all table QR codes as PDF
    """
    import qrcode
    import io
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from fastapi.responses import StreamingResponse

    # Fetch all tables
    result = await db.execute(
        select(Table).where(
            Table.restaurant_id == restaurant.id,
            Table.deleted_at == None
        )
    )
    tables = result.scalars().all()

    if not tables:
        raise HTTPException(status_code=404, detail="No tables found")

    # Generate PDF in memory
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    for i, table in enumerate(tables):
        qr_data = f"https://digicrave.app/menu/{restaurant.slug}?table={table.id}&token={table.qr_token_secret}"

        # Generate QR code
        qr = qrcode.make(qr_data)
        qr_buffer = io.BytesIO()
        qr.save(qr_buffer, format="PNG")
        qr_buffer.seek(0)

        # Add to PDF
        from reportlab.lib.utils import ImageReader
        qr_image = ImageReader(qr_buffer)
        pdf.drawImage(qr_image, 100, height - 300, width=200, height=200)
        pdf.setFont("Helvetica-Bold", 16)
        pdf.drawString(150, height - 320, f"Table {table.table_number}")
        pdf.drawString(100, height - 340, restaurant.name)

        if i < len(tables) - 1:
            pdf.showPage()

    pdf.save()
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=qr_codes_{restaurant.slug}.pdf"
        }
    )