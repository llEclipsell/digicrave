from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
import uuid

from app.core.database import get_db
from app.api.v1.dependencies import get_current_customer, get_valid_restaurant
from app.models.customer import Customer, RestaurantCustomer
from app.models.restaurant import Restaurant

router = APIRouter()


@router.delete("/customer/my-data")
async def delete_my_data(
    restaurant: Restaurant = Depends(get_valid_restaurant),
    token_data: dict = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    """
    Blueprint DPDP Compliance: DELETE /customer/my-data
    Anonymizes phone + name (Soft delete)
    Right to be forgotten under DPDP Act
    """
    customer_id = uuid.UUID(token_data["sub"])

    result = await db.execute(
        select(Customer).where(Customer.id == customer_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Anonymize PII — Blueprint: Soft delete
    customer.phone_encrypted = "ANONYMIZED"
    customer.phone_hash = f"deleted_{customer_id}"
    customer.name_encrypted = None
    customer.consent_timestamp = None
    customer.consent_ip = None
    customer.deleted_at = datetime.now(timezone.utc)

    # Remove marketing opt-in
    rc_result = await db.execute(
        select(RestaurantCustomer).where(
            RestaurantCustomer.customer_id == customer_id,
            RestaurantCustomer.restaurant_id == restaurant.id,
        )
    )
    rc = rc_result.scalar_one_or_none()
    if rc:
        rc.marketing_opt_in = False

    await db.commit()
    return {"message": "Your data has been anonymized as per DPDP Act"}