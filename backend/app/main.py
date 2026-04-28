from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from contextlib import asynccontextmanager
import asyncio

from app.core.config import settings
from app.core.database import get_db
from app.api.v1.routes import (
    pricing, auth, payment,
    menu, staff, admin, customer,
    websocket, qr
)
from app.services.sla_monitor import start_sla_monitor
from fastapi.middleware.cors import CORSMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Blueprint: Start SLA monitor on app startup
    Runs as background task checking every 60 seconds
    """
    # Start SLA monitor background task
    sla_task = asyncio.create_task(start_sla_monitor())
    print("[DigiCrave] SLA Monitor started ✅")
    yield
    # Cleanup on shutdown
    sla_task.cancel()
    print("[DigiCrave] SLA Monitor stopped")


app = FastAPI(
    title="DigiCrave",
    description="Multi-Tenant Omnichannel Restaurant SaaS",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",    # Next.js dev
        "http://localhost:5173",    # Vite dev
        "https://digicrave.app",    # Production (add later)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pricing.router, prefix="/api/v1", tags=["Pricing & Cart"])
app.include_router(auth.router, prefix="/api/v1", tags=["Authentication"])
app.include_router(payment.router, prefix="/api/v1", tags=["Payments"])
app.include_router(menu.router, prefix="/api/v1", tags=["Menu"])
app.include_router(staff.router, prefix="/api/v1", tags=["Staff & Kitchen"])
app.include_router(admin.router, prefix="/api/v1", tags=["Admin"])
app.include_router(customer.router, prefix="/api/v1", tags=["Customer"])
app.include_router(websocket.router, prefix="/api/v1", tags=["WebSockets"])
app.include_router(qr.router, prefix="/api/v1", tags=["QR"])


@app.get("/api/v1/health")
async def health(db: AsyncSession = Depends(get_db)):
    """
    Blueprint: Full health check
    Checks DB + Redis + Celery workers
    """
    import redis as redis_lib
    from sqlalchemy import text

    checks = {}

    # DB check
    try:
        await db.execute(text("SELECT 1"))
        checks["db"] = "up"
    except Exception:
        checks["db"] = "down"

    # Redis check
    try:
        r = redis_lib.from_url(settings.REDIS_URL)
        r.ping()
        checks["redis"] = "up"
    except Exception:
        checks["redis"] = "down"

    # Celery check
    try:
        from app.core.celery_app import celery_app
        inspect = celery_app.control.inspect(timeout=2)
        active = inspect.active()
        checks["workers"] = "up" if active else "no_workers"
    except Exception:
        checks["workers"] = "unknown"

    checks["aggregators"] = "not_configured"
    checks["sla_monitor"] = "running"

    overall = (
        "healthy"
        if checks["db"] == "up" and checks["redis"] == "up"
        else "degraded"
    )

    return {
        "status": overall,
        "version": "1.0.0",
        "checks": checks,
    }