import random
import string
import redis
from app.core.config import settings

# Redis client
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

OTP_TTL_SECONDS = 300  # 5 minutes (Blueprint spec)
OTP_RATE_LIMIT = 3     # Max 3 OTPs per 10 minutes (Blueprint spec)
OTP_RATE_WINDOW = 600  # 10 minutes in seconds


def generate_otp() -> str:
    return ''.join(random.choices(string.digits, k=6))


def check_rate_limit(phone: str, restaurant_id: str) -> bool:
    """
    Blueprint: Rate Limit 3 per 10 mins per phone
    Returns True if allowed, False if rate limited
    """
    rate_key = f"otp_rate:{phone}:{restaurant_id}"
    count = redis_client.get(rate_key)

    if count and int(count) >= OTP_RATE_LIMIT:
        return False

    pipe = redis_client.pipeline()
    pipe.incr(rate_key)
    pipe.expire(rate_key, OTP_RATE_WINDOW)
    pipe.execute()
    return True


def store_otp(phone: str, otp: str, restaurant_id: str):
    """Store OTP in Redis with 5 min TTL"""
    key = f"otp:{phone}:{restaurant_id}"
    redis_client.setex(key, OTP_TTL_SECONDS, otp)


def verify_otp(phone: str, otp: str, restaurant_id: str) -> bool:
    """Verify OTP and delete after use (one-time use)"""
    key = f"otp:{phone}:{restaurant_id}"
    stored = redis_client.get(key)
    if stored and stored == otp:
        redis_client.delete(key)  # One-time use
        return True
    return False