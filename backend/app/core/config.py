from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """
    Application settings loaded from .env file.
    All environment variables are mapped to class attributes.
    """

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://your_user:your_password@localhost/koremobile_db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_DB_SESSIONS: int = 0
    REDIS_DB_OTP: int = 1
    REDIS_DB_PRODUCTS: int = 2
    REDIS_DB_SEARCH: int = 3
    REDIS_DB_CART: int = 4
    REDIS_DB_ORDERS: int = 5
    REDIS_DB_SETTINGS: int = 6
    REDIS_DB_REVIEWS: int = 7
    REDIS_DB_RATELIMIT: int = 8
    REDIS_DB_EMAIL: int = 9
    REDIS_DB_PINCODE: int = 10      # ← pincode serviceability cache

    # Security
    SECRET_KEY: str = ""
    ADMIN_SECRET_KEY: str = ""
    ENCRYPTION_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 24
    ADMIN_TOKEN_EXPIRE_HOURS: int = 12

    # Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    OWNER_EMAIL: str = ""

    # SMS (Twilio)
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    # Payment (Cashfree)
    CASHFREE_APP_ID: str = ""
    CASHFREE_SECRET_KEY: str = ""
    CASHFREE_ENV: str = "sandbox"

    # ── iThinkLogistics ───────────────────────────────────────────────────────
    ITL_ACCESS_TOKEN: str = ""
    ITL_SECRET_KEY: str = ""
    ITL_PICKUP_ADDRESS_ID: int = 0      # from ITL dashboard → Warehouses
    ITL_RETURN_ADDRESS_ID: int = 0      # usually same as pickup
    ITL_PICKUP_PINCODE: str = ""  # your warehouse/shop pincode for rate check
    # Staging:    https://pre-alpha.ithinklogistics.com
    # Production: https://my.ithinklogistics.com
    ITL_BASE_URL: str = "https://pre-alpha.ithinklogistics.com"
    # ─────────────────────────────────────────────────────────────────────────

    # Image Upload (Cloudinary — unused; local disk storage is used instead)
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # CORS & URLs
    SITE_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://127.0.0.1:8000"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    FRONTEND_URL: str = "http://localhost:5173"

    @property
    def origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    @property
    def SMTP_USERNAME(self) -> str:
        return self.SMTP_USER

    @property
    def SMTP_FROM(self) -> str:
        return self.OWNER_EMAIL or self.SMTP_USER

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()