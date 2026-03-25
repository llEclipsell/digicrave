from fastapi import Header, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.restaurant import Restaurant
import uuid
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import decode_access_token

security = HTTPBearer()

async def get_restaurant_id(
    x_restaurant_id: str = Header(..., alias="X-Restaurant-ID")
) -> uuid.UUID:
    """
    Blueprint: Multi-Tenant Header Middleware
    Every request must pass X-Restaurant-ID header.
    """
    try:
        return uuid.UUID(x_restaurant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid X-Restaurant-ID format")


async def get_valid_restaurant(
    restaurant_id: uuid.UUID = Depends(get_restaurant_id),
    db: AsyncSession = Depends(get_db)
) -> Restaurant:
    """Validates restaurant actually exists in DB"""
    result = await db.execute(
        select(Restaurant).where(
            Restaurant.id == restaurant_id,
            Restaurant.deleted_at == None
        )
    )
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return restaurant

async def get_current_staff(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    restaurant_id: uuid.UUID = Depends(get_restaurant_id),
) -> dict:
    """
    Dependency for Staff/Owner protected routes.
    Validates JWT and ensures staff belongs to the restaurant.
    """
    token_data = decode_access_token(credentials.credentials)
    if not token_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if token_data.get("role") == "customer":
        raise HTTPException(status_code=403, detail="Staff access required")

    if token_data.get("restaurant_id") != str(restaurant_id):
        raise HTTPException(status_code=403, detail="Access denied for this restaurant")

    return token_data

async def get_current_owner(
    token_data: dict = Depends(get_current_staff),
) -> dict:
    """Only owners can access admin routes"""
    if token_data.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")
    return token_data


async def get_current_customer(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    restaurant_id: uuid.UUID = Depends(get_restaurant_id),
) -> dict:
    """Dependency for Customer protected routes"""
    token_data = decode_access_token(credentials.credentials)
    if not token_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if token_data.get("role") != "customer":
        raise HTTPException(status_code=403, detail="Customer access required")

    return token_data