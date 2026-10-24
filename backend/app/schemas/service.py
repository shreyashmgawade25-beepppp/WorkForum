
import uuid

from pydantic import BaseModel, ConfigDict, Field


class ServiceResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    category: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class ServiceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = None
    category: str = Field(min_length=2, max_length=100)


class ServiceSeedItem(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = None
    category: str = Field(min_length=2, max_length=100)
