import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # Security
    JWT_SECRET_KEY: str = "super_secure_random_hex_string_32_bytes_long_change_in_production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours for dev; reduce in production
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # App Settings
    PROJECT_NAME: str = "DO IT SERVICES Operations Platform"

    # Environment file configuration
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        extra="ignore"
    )


settings = Settings()
