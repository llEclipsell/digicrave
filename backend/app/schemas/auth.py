from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
import re


# --- Staff/Owner Schemas ---
class StaffSignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    restaurant_name: str
    restaurant_slug: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("restaurant_slug")
    @classmethod
    def slug_format(cls, v):
        if not re.match(r'^[a-z0-9-]+$', v):
            raise ValueError("Slug must be lowercase letters, numbers, hyphens only")
        return v


class StaffLoginRequest(BaseModel):
    email: EmailStr
    password: str


class StaffLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    restaurant_id: str
    name: str


class StaffSignupResponse(BaseModel):
    user_id: str
    restaurant_id: str
    token: str
    message: str


# --- Customer OTP Schemas ---
class OTPSendRequest(BaseModel):
    phone: str

    @field_validator("phone")
    @classmethod
    def phone_format(cls, v):
        # Remove spaces/dashes
        cleaned = re.sub(r'[\s\-]', '', v)
        if not re.match(r'^\+?[0-9]{10,13}$', cleaned):
            raise ValueError("Invalid phone number format")
        return cleaned


class OTPSendResponse(BaseModel):
    message: str


class OTPVerifyRequest(BaseModel):
    phone: str
    otp: str
    marketing_opt_in: Optional[bool] = False
    name: Optional[str] = None
    consent_ip: Optional[str] = None

    @field_validator("otp")
    @classmethod
    def otp_format(cls, v):
        if not re.match(r'^\d{6}$', v):
            raise ValueError("OTP must be 6 digits")
        return v


class OTPVerifyResponse(BaseModel):
    customer_token: str
    name: Optional[str]
    is_new_customer: bool
    message: str


# --- JWT Token Data ---
class TokenData(BaseModel):
    sub: str           # user_id or customer_id
    role: str          # owner | cashier | chef | waiter | customer
    restaurant_id: str