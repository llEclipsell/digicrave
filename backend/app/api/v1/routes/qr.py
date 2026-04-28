from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import create_qr_token, decode_qr_token, create_session_token
from app.api.v1.dependencies import get_current_staff

router = APIRouter()

class GenerateQRRequest(BaseModel):
    restaurant_id: uuid.UUID
    table_number: int

class VerifyQRResponse(BaseModel):
    restaurant_id: str
    table_number: int
    session_token: str

@router.post("/qr/generate")
async def generate_qr_token(
    request: GenerateQRRequest,
    staff_user: dict = Depends(get_current_staff)
):
    """
    Generate a 24-hour QR token for a specific table.
    Requires staff/admin authentication.
    """
    token = create_qr_token(str(request.restaurant_id), request.table_number)
    qr_url = f"http://localhost:3000/menu?qr={token}"
    return {
        "success": True,
        "data": {
            "token": token,
            "qr_url": qr_url
        }
    }

@router.get("/qr/verify", response_model=VerifyQRResponse)
async def verify_qr_token(token: str):
    """
    Verify a QR token and return a short-lived (2hr) session token.
    Public endpoint accessed by customers when scanning QR.
    """
    payload = decode_qr_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired QR token")
    
    restaurant_id = payload.get("restaurant_id")
    table_number = payload.get("table_number")
    
    if not restaurant_id or not table_number:
        raise HTTPException(status_code=401, detail="Invalid QR payload")
        
    session_token = create_session_token(restaurant_id, table_number)
    
    return VerifyQRResponse(
        restaurant_id=restaurant_id,
        table_number=table_number,
        session_token=session_token
    )
