from typing import Optional
import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    MASTER_DATABASE_URL: str = "postgresql://doit_admin:securepassword@localhost:5432/crediiflow_master"
    DATABASE_URL: Optional[str] = None
    DB_USER: str = "doit_admin"
    DB_PASSWORD: str = "securepassword"
    DB_HOST: str = "localhost"
    DB_PORT: str = "5432"
    TEST_TENANT_ID: Optional[str] = None


    ENVIRONMENT: str = "production"
    JWT_SECRET_KEY: str = "dev-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours for dev; reduce in production
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173,https://do-it-services.vercel.app,https://do-it-services-sujeet-kansals-projects.vercel.app,https://app.crediiflow.in,https://do-it-services.crediiflow.in"

    # App Settings
    PROJECT_NAME: str = "CrediiFlow Operations Platform"

    # Cloudflare R2 configurations
    R2_ACCESS_KEY_ID: Optional[str] = None
    R2_SECRET_ACCESS_KEY: Optional[str] = None
    R2_ENDPOINT_URL: Optional[str] = None
    R2_BUCKET_NAME: Optional[str] = None
    R2_PUBLIC_URL: Optional[str] = None # Public domain/URL mapped to R2 bucket (e.g. static.crediiflow.in or R2 public dev URL)

    # Environment file configuration
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        extra="ignore"
    )


settings = Settings()

