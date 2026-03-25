from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    AES_ENCRYPTION_KEY: str
    REDIS_URL: str
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_PLATFORM_ACCOUNT_ID: str = ""
    MSG91_AUTH_KEY: str = ""
    PLATFORM_FEE: float = 3.00
    GATEWAY_FEE_PERCENT: float = 0.02

    class Config:
        env_file = ".env"

settings = Settings()