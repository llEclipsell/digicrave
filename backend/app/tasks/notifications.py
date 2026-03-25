from app.core.celery_app import celery_app
from app.core.config import settings
import httpx


@celery_app.task(
    name="app.tasks.notifications.send_otp_whatsapp",
    queue="critical",
    bind=True,
    max_retries=3,
    default_retry_delay=10,
)
def send_otp_whatsapp(self, phone: str, otp: str):
    """
    Blueprint Phase 5: Send OTP via MSG91
    Retries 3 times if fails
    """
    try:
        # MSG91 API call
        response = httpx.post(
            "https://api.msg91.com/api/v5/otp",
            json={
                "template_id": "your_template_id",
                "mobile": phone,
                "authkey": settings.MSG91_AUTH_KEY,
                "otp": otp,
            },
            timeout=10.0
        )
        response.raise_for_status()
        print(f"[MSG91] OTP sent to {phone}")
        return {"status": "sent", "phone": phone}

    except Exception as exc:
        print(f"[MSG91] Failed for {phone}: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(
    name="app.tasks.notifications.send_order_ready_whatsapp",
    queue="critical",
    bind=True,
    max_retries=3,
    default_retry_delay=10,
)
def send_order_ready_whatsapp(phone: str, order_id: str, table_number: str):
    """
    Blueprint: Notify customer when order is READY
    Triggered from PATCH /staff/orders/{id}/status
    """
    try:
        response = httpx.post(
            "https://api.msg91.com/api/v5/flow",
            json={
                "authkey": settings.MSG91_AUTH_KEY,
                "mobiles": phone,
                "order_id": order_id,
                "table": table_number,
            },
            timeout=10.0
        )
        response.raise_for_status()
        return {"status": "sent"}
    except Exception as exc:
        print(f"[MSG91] Order ready notification failed: {exc}")