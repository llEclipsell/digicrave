from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.api.v1.dependencies import get_restaurant_id
from app.services import auth as auth_service
from app.services.otp import generate_otp, store_otp
from app.core.security import create_access_token, decode_refresh_token
from app.schemas.auth import (
    StaffSignupRequest, StaffSignupResponse,
    StaffLoginRequest, StaffLoginResponse,
    OTPSendRequest, OTPSendResponse,
    OTPVerifyRequest, OTPVerifyResponse,
    RefreshTokenRequest, RefreshTokenResponse,
)
import uuid

router = APIRouter()


@router.post("/auth/signup", response_model=StaffSignupResponse, status_code=201)
async def owner_signup(
    data: StaffSignupRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint Module 0: POST /auth/signup
    No X-Restaurant-ID needed — creates the restaurant itself
    """
    return await auth_service.signup_owner(data, db)


@router.post("/auth/login", response_model=StaffLoginResponse)
async def staff_login(
    data: StaffLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Blueprint Module 0: POST /auth/login"""
    return await auth_service.login_staff(data, db)


@router.post("/auth/otp/send", response_model=OTPSendResponse)
async def send_otp(
    data: OTPSendRequest,
    restaurant_id: uuid.UUID = Depends(get_restaurant_id),
):
    """
    Blueprint Rate Limit: 3 per 10 mins
    OTP stored in Redis with 5 min TTL
    Sent via Celery background task
    """
    from app.services.otp import generate_otp, store_otp, check_rate_limit
    from app.tasks.notifications import send_otp_whatsapp
    from fastapi import HTTPException

    # Rate limit check
    if not check_rate_limit(data.phone, str(restaurant_id)):
        raise HTTPException(
            status_code=429,
            detail="Too many OTP requests. Try again in 10 minutes."
        )

    otp = generate_otp()
    store_otp(data.phone, otp, str(restaurant_id))

    # Fire Celery task (non-blocking)
    # In dev: prints to console since MSG91 key not set
    if settings.MSG91_AUTH_KEY:
        send_otp_whatsapp.delay(data.phone, otp)
    else:
        print(f"[DEV OTP] Phone: {data.phone} | OTP: {otp}")

    return OTPSendResponse(message="OTP sent successfully")


@router.post("/auth/otp/verify", response_model=OTPVerifyResponse)
async def verify_otp(
    data: OTPVerifyRequest,
    request: Request,
    restaurant_id: uuid.UUID = Depends(get_restaurant_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint Module 0: POST /auth/otp/verify
    Creates/fetches customer, records DPDP consent
    """
    client_ip = request.client.host
    result = await auth_service.verify_customer_otp(
        phone=data.phone,
        data=data,
        restaurant_id=restaurant_id,
        db=db,
        request_ip=client_ip,
    )
    return OTPVerifyResponse(**result)


@router.post("/auth/refresh", response_model=RefreshTokenResponse)
async def refresh_access_token(
    data: RefreshTokenRequest,
):
    """
    POST /auth/refresh
    Accepts a valid refresh token, returns a new access token.
    Called by the frontend's axios interceptor on 401 responses.
    """
    payload = decode_refresh_token(data.refresh_token)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired refresh token"
        )

    # Issue new access token with same claims
    new_access_token = create_access_token({
        "sub": payload["sub"],
        "role": payload["role"],
        "restaurant_id": payload["restaurant_id"],
    })

    return RefreshTokenResponse(access_token=new_access_token)