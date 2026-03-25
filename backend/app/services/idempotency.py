import redis
import json
from app.core.config import settings

redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

IDEMPOTENCY_TTL = 86400  # 24 hours (Blueprint spec)


def get_cached_response(idempotency_key: str) -> dict | None:
    """
    Blueprint: X-Idempotency-Key tracking
    If duplicate request arrives within 24hrs, return cached response
    """
    key = f"idempotency:{idempotency_key}"
    cached = redis_client.get(key)
    if cached:
        return json.loads(cached)
    return None


def cache_response(idempotency_key: str, response: dict):
    """Cache response for 24 hours"""
    key = f"idempotency:{idempotency_key}"
    redis_client.setex(key, IDEMPOTENCY_TTL, json.dumps(response))


def is_duplicate(idempotency_key: str) -> bool:
    key = f"idempotency:{idempotency_key}"
    return redis_client.exists(key) > 0