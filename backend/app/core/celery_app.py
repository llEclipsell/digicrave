from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "digicrave",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.notifications",
        "app.tasks.marketing",
    ]
)

celery_app.conf.update(
    # Blueprint: Two queues — Critical and Default
    task_queues={
        "critical": {"exchange": "critical", "routing_key": "critical"},
        "default": {"exchange": "default", "routing_key": "default"},
    },
    task_default_queue="default",
    task_default_exchange="default",
    task_default_routing_key="default",

    # Task routing — which queue each task goes to
    task_routes={
        "app.tasks.notifications.*": {"queue": "critical"},
        "app.tasks.marketing.*": {"queue": "default"},
    },

    # Result expiry
    result_expires=3600,

    # Timezone
    timezone="Asia/Kolkata",
    enable_utc=True,

    worker_pool="solo",
    worker_concurrency=1,
)