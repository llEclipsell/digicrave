import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.core.security import (
    hash_password, verify_password,
    encrypt_field, decrypt_field,
    create_access_token
)
from app.models.staff import Staff
from app.models.restaurant import Restaurant
from app.models.customer import Customer, RestaurantCustomer
from app.models.billing import RestaurantBilling
from app.schemas.auth import (
    StaffSignupRequest, StaffLoginRequest,
    OTPVerifyRequest
)


async def signup_owner(
    data: StaffSignupRequest,
    db: AsyncSession
) -> dict:
    """
    Blueprint Module 0: POST /auth/signup
    Creates Restaurant + Owner Staff in one transaction
    """
    # Check slug is unique
    result = await db.execute(
        select(Restaurant).where(Restaurant.slug == data.restaurant_slug)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Restaurant slug already taken")

    # Check email is unique
    result = await db.execute(
        select(Staff).where(Staff.email == data.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create Restaurant
    restaurant = Restaurant(
        id=uuid.uuid4(),
        name=data.restaurant_name,
        slug=data.restaurant_slug,
        whatsapp_credit_balance=0,
    )
    db.add(restaurant)
    await db.flush()  # Get restaurant.id before committing

    # Create RestaurantBilling record
    billing = RestaurantBilling(
        id=uuid.uuid4(),
        restaurant_id=restaurant.id,
        unpaid_manual_fees=0,
    )
    db.add(billing)

    # Create Owner Staff
    staff = Staff(
        id=uuid.uuid4(),
        restaurant_id=restaurant.id,
        name=data.name,
        email=data.email,
        role="owner",
        hashed_password=hash_password(data.password),
    )
    db.add(staff)
    await db.commit()

    # Generate JWT
    token = create_access_token({
        "sub": str(staff.id),
        "role": "owner",
        "restaurant_id": str(restaurant.id),
    })

    return {
        "user_id": str(staff.id),
        "restaurant_id": str(restaurant.id),
        "token": token,
        "message": "Restaurant created successfully"
    }


async def login_staff(
    data: StaffLoginRequest,
    db: AsyncSession
) -> dict:
    """
    Blueprint Module 0: POST /auth/login
    Verifies credentials, issues JWT with role scope
    """
    result = await db.execute(
        select(Staff).where(
            Staff.email == data.email,
            Staff.deleted_at == None
        )
    )
    staff = result.scalar_one_or_none()

    if not staff or not verify_password(data.password, staff.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    token = create_access_token({
        "sub": str(staff.id),
        "role": staff.role,
        "restaurant_id": str(staff.restaurant_id),
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": staff.role,
        "restaurant_id": str(staff.restaurant_id),
        "name": staff.name,
    }


async def verify_customer_otp(
    phone: str,
    data: OTPVerifyRequest,
    restaurant_id: uuid.UUID,
    db: AsyncSession,
    request_ip: str = None,
) -> dict:
    """
    Blueprint Module 0: POST /auth/otp/verify
    - Creates or fetches customer
    - AES-256 encrypts phone + name
    - Records marketing consent with IP + timestamp (DPDP)
    - Issues Customer JWT
    """
    from app.services.otp import verify_otp

    # Verify OTP
    if not verify_otp(phone, data.otp, str(restaurant_id)):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    # Encrypt phone for DB lookup
    encrypted_phone = encrypt_field(phone)

    # Try to find existing customer
    # Note: We search all customers then decrypt to match
    # (AES-GCM produces different ciphertext each time due to random nonce)
    # So we store a searchable hash alongside encrypted data
    import hashlib
    phone_hash = hashlib.sha256(phone.encode()).hexdigest()

    result = await db.execute(
        select(Customer).where(Customer.phone_hash == phone_hash)
    )
    customer = result.scalar_one_or_none()
    is_new = False

    if not customer:
        is_new = True
        customer = Customer(
            id=uuid.uuid4(),
            phone_encrypted=encrypted_phone,
            phone_hash=phone_hash,
            name_encrypted=encrypt_field(data.name) if data.name else None,
            consent_timestamp=datetime.now(timezone.utc) if data.marketing_opt_in else None,
            consent_ip=request_ip if data.marketing_opt_in else None,
        )
        db.add(customer)
        await db.flush()

    # Create or update RestaurantCustomer link
    result = await db.execute(
        select(RestaurantCustomer).where(
            RestaurantCustomer.restaurant_id == restaurant_id,
            RestaurantCustomer.customer_id == customer.id,
        )
    )
    rc = result.scalar_one_or_none()

    if not rc:
        rc = RestaurantCustomer(
            id=uuid.uuid4(),
            restaurant_id=restaurant_id,
            customer_id=customer.id,
            marketing_opt_in=data.marketing_opt_in or False,
            visit_count=1,
            last_visit_date=datetime.now(timezone.utc),
        )
        db.add(rc)
    else:
        rc.visit_count += 1
        rc.last_visit_date = datetime.now(timezone.utc)
        if data.marketing_opt_in:
            rc.marketing_opt_in = True

    await db.commit()

    # Issue Customer JWT
    token = create_access_token({
        "sub": str(customer.id),
        "role": "customer",
        "restaurant_id": str(restaurant_id),
    })

    name = None
    if customer.name_encrypted:
        name = decrypt_field(customer.name_encrypted)

    return {
        "customer_token": token,
        "name": name,
        "is_new_customer": is_new,
        "message": "Login successful"
    }