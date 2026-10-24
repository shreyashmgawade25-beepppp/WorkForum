
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class WorkerProfileCreate(BaseModel):
    bio: str | None = Field(default=None, max_length=2000)
    city: str = Field(default="Mumbai", min_length=2, max_length=100)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @field_validator("city")
    @classmethod
    def normalize_city(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("City cannot be empty.")
        return value


class WorkerProfileUpdate(BaseModel):
    bio: str | None = Field(default=None, max_length=2000)
    city: str | None = Field(default=None, min_length=2, max_length=100)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    is_available: bool | None = None

    @field_validator("city")
    @classmethod
    def normalize_city(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("City cannot be empty.")
        return value


class WorkerProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    full_name: str
    bio: str | None
    city: str
    latitude: float | None
    longitude: float | None
    is_available: bool
    verification_status: str
    average_rating: float
    completed_jobs: int
    created_at: datetime
