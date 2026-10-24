
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "WorkForum API"
    app_version: str = "0.1.0"
    environment: str = "development"

    database_url: str = (
        "postgresql+asyncpg://workforum:workforum_dev_only_change_me"
        "@localhost:5432/workforum"
    )

    redis_url: str = "redis://localhost:6379/0"

    jwt_secret_key: str = "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    frontend_origin: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
