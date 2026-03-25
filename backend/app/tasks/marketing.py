from app.core.celery_app import celery_app
from app.core.config import settings
import httpx


@celery_app.task(
    name="app.tasks.marketing.send_whatsapp_blast",
    queue="default",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def send_whatsapp_blast(self, phone_list: list, template_id: str, restaurant_id: str):
    """
    Blueprint Module 5: Marketing Campaign Manager
    Golden Rule 4: Only sent to marketing_opt_in == True customers
    (Filtering happens in the API layer before this task is called)
    """
    results = []
    for phone in phone_list:
        try:
            response = httpx.post(
                "https://api.msg91.com/api/v5/flow",
                json={
                    "authkey": settings.MSG91_AUTH_KEY,
                    "mobiles": phone,
                    "template_id": template_id,
                },
                timeout=10.0
            )
            results.append({"phone": phone, "status": "sent"})
        except Exception as e:
            results.append({"phone": phone, "status": "failed", "error": str(e)})

    return {
        "restaurant_id": restaurant_id,
        "total": len(phone_list),
        "results": results,
    }


@celery_app.task(
    name="app.tasks.marketing.sync_menu_to_aggregators",
    queue="default",
)
def sync_menu_to_aggregators(restaurant_id: str):
    """
    Blueprint Module 6: UrbanPiper Menu Sync
    Placeholder — will be implemented post-deployment
    """
    print(f"[PLACEHOLDER] Menu sync queued for restaurant: {restaurant_id}")
    return {"status": "queued", "restaurant_id": restaurant_id}