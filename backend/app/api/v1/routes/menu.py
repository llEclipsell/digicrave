from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid

from app.core.database import get_db
from app.api.v1.dependencies import get_valid_restaurant
from app.models.menu import MenuItem, Category, ItemCrossSell
from app.models.restaurant import Restaurant
from pydantic import BaseModel
from decimal import Decimal
from typing import Optional

router = APIRouter()

class MenuItemUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_offline: Optional[Decimal] = None
    qr_discount_percent: Optional[Decimal] = None
    is_available: Optional[bool] = None

# --- Schemas ---
class CategoryResponse(BaseModel):
    id: uuid.UUID
    name: str

    model_config = {"from_attributes": True}


class MenuItemResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    price_offline: Decimal
    qr_discount_percent: Decimal
    is_available: bool
    image_url: Optional[str]
    category_id: uuid.UUID

    model_config = {"from_attributes": True}


class MenuItemDetailResponse(BaseModel):
    item: MenuItemResponse
    upsells: List[MenuItemResponse]


class MenuResponse(BaseModel):
    categories: List[CategoryResponse]
    items: List[MenuItemResponse]




@router.get("/menu/item/{item_id}", response_model=MenuItemDetailResponse)
async def get_menu_item(
    item_id: uuid.UUID,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint Module 1: GET /menu/item/{id}
    Returns item details + upsell recommendations (AOV Multiplier)
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
        raise HTTPException(status_code=404, detail="Item not found")

    # Fetch cross-sell recommendations
    cross_result = await db.execute(
        select(ItemCrossSell).where(
            ItemCrossSell.base_item_id == item_id
        )
    )
    cross_sells = cross_result.scalars().all()

    upsell_items = []
    for cs in cross_sells:
        upsell_result = await db.execute(
            select(MenuItem).where(
                MenuItem.id == cs.suggested_item_id,
                MenuItem.is_available == True,
                MenuItem.deleted_at == None
            )
        )
        upsell = upsell_result.scalar_one_or_none()
        if upsell:
            upsell_items.append(MenuItemResponse.model_validate(upsell))

    return MenuItemDetailResponse(
        item=MenuItemResponse.model_validate(item),
        upsells=upsell_items,
    )

# ─── New: List categories for X-Restaurant-ID ──────────────────────
@router.get("/menu/categories")
async def list_categories(
    restaurant: Restaurant = Depends(get_valid_restaurant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(
            Category.restaurant_id == restaurant.id,
            Category.deleted_at == None
        ).order_by(Category.name)
    )
    cats = result.scalars().all()
    return {
        "data": [{"id": str(c.id), "name": c.name, "restaurantId": str(c.restaurant_id), "sortOrder": 0, "imageUrl": None} for c in cats],
        "success": True,
        "message": "Categories fetched"
    }


# ─── New: List menu items for X-Restaurant-ID ──────────────────────
@router.get("/menu/items")
async def list_menu_items(
    category_id: Optional[str] = None,
    limit: int = 100,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    db: AsyncSession = Depends(get_db),
):
    import uuid as _uuid
    query = select(MenuItem, Category).join(
        Category, MenuItem.category_id == Category.id
    ).where(
        MenuItem.restaurant_id == restaurant.id,
        MenuItem.deleted_at == None
    )
    if category_id:
        query = query.where(MenuItem.category_id == _uuid.UUID(category_id))

    result = await db.execute(query.limit(limit))
    rows = result.all()

    items = []
    for item, cat in rows:
        items.append({
            "id": str(item.id),
            "restaurantId": str(item.restaurant_id),
            "categoryId": str(item.category_id),
            "categoryName": cat.name,
            "name": item.name,
            "description": item.description or "",
            "priceOffline": float(item.price_offline),
            "qrDiscountPercent": float(item.qr_discount_percent),
            "imageUrl": item.image_url,
            "dietType": "veg",
            "isPopular": False,
            "isRecommended": False,
            "isAvailable": item.is_available,
            "preparationTimeMinutes": 0,
            "tags": [],
            "crossSells": [],
            "aggregatorMappingId": item.aggregator_mapping_id,
        })

    return {
        "data": {"items": items, "totalCount": len(items), "hasMore": False, "nextCursor": None},
        "success": True,
        "message": "Menu items fetched"
    }


# ─── New: Toggle availability (alias used by admin useToggleItemAvailability) ──
@router.patch("/menu/items/{item_id}")
async def patch_menu_item(
    item_id: uuid.UUID,
    request: MenuItemUpdateRequest,
    restaurant: Restaurant = Depends(get_valid_restaurant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MenuItem).where(
            MenuItem.id == item_id,
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.deleted_at == None
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

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
        from app.core.websocket import manager as ws_manager
        await ws_manager.emit_to_all(
            restaurant_id=str(restaurant.id),
            event="menu.item_toggled",
            data={"itemId": str(item_id), "isAvailable": request.is_available}
        )

    await db.commit()
    return {"data": {"id": str(item_id), "isAvailable": item.is_available}, "success": True, "message": "Item updated"}

# --- Routes ---
@router.get("/menu/{slug}", response_model=MenuResponse)
async def get_menu_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint Module 1: GET /menu/{slug}
    Anonymous access — customers browse before login.
    Returns all active categories + available items.
    """
    # Find restaurant by slug
    result = await db.execute(
        select(Restaurant).where(
            Restaurant.slug == slug,
            Restaurant.deleted_at == None
        )
    )
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    # Fetch categories
    cat_result = await db.execute(
        select(Category).where(
            Category.restaurant_id == restaurant.id,
            Category.deleted_at == None
        )
    )
    categories = cat_result.scalars().all()

    # Fetch available menu items only
    items_result = await db.execute(
        select(MenuItem).where(
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.is_available == True,
            MenuItem.deleted_at == None
        )
    )
    items = items_result.scalars().all()

    return MenuResponse(
        categories=[CategoryResponse.model_validate(c) for c in categories],
        items=[MenuItemResponse.model_validate(i) for i in items],
    )
