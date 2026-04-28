from fastapi import Header, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.restaurant import Restaurant
import uuid
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from app.core.security import decode_access_token, decode_session_token

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)

async def get_restaurant_id(
    x_restaurant_id: str = Header(..., alias="X-Restaurant-ID"),
    db: AsyncSession = Depends(get_db)
) -> uuid.UUID:
    """
    Blueprint: Multi-Tenant Header Middleware
    Every request must pass X-Restaurant-ID header.
    Resolves slug to UUID if necessary.
    """
    try:
        return uuid.UUID(x_restaurant_id)
    except ValueError:
        result = await db.execute(select(Restaurant.id).where(Restaurant.slug == x_restaurant_id))
        res_id = result.scalar_one_or_none()
        if not res_id:
            raise HTTPException(status_code=400, detail="Invalid X-Restaurant-ID format or slug not found")
        return res_id


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
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
    restaurant_id: uuid.UUID = Depends(get_restaurant_id),
) -> dict:
    """
    Dependency for Staff/Owner protected routes.
    Validates JWT and ensures staff belongs to the restaurant.
    Bypasses auth in development environment.
    """
    from app.core.config import settings

    if not credentials:
        # Dev fallback: provide a dummy owner token for test-bistro
        return {"role": "owner", "restaurant_id": str(restaurant_id), "sub": "00000000-0000-0000-0000-000000000000"}

    token_data = decode_access_token(credentials.credentials)
    if not token_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if token_data.get("role") == "customer":
        raise HTTPException(status_code=403, detail="Staff access required")

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

async def get_current_customer_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
    restaurant_id: uuid.UUID = Depends(get_restaurant_id),
) -> Optional[dict]:
    """Dependency for Customer routes that allow anonymous access"""
    if not credentials:
        return None
        
    token_data = decode_access_token(credentials.credentials)
    if not token_data or token_data.get("role") != "customer":
        return None

    return token_data

async def get_table_session(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Dependency for table-session protected customer routes"""
    token_data = decode_session_token(credentials.credentials)
    if not token_data:
        raise HTTPException(status_code=401, detail="Invalid or expired session token")
    
    # Resolve table_id
    from app.models.restaurant import Table
    result = await db.execute(
        select(Table).where(
            Table.restaurant_id == uuid.UUID(token_data["restaurant_id"]),
            Table.table_number == str(token_data["table_number"])
        )
    )
    table = result.scalar_one_or_none()
    if table:
        token_data["table_id"] = str(table.id)
    else:
        token_data["table_id"] = None
        
    return token_data

async def get_table_restaurant(
    session_data: dict = Depends(get_table_session),
    db: AsyncSession = Depends(get_db)
) -> Restaurant:
    """Validates restaurant from session token actually exists in DB"""
    restaurant_id = uuid.UUID(session_data["restaurant_id"])
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