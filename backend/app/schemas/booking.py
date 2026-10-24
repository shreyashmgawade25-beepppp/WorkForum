
from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BookingCreate(BaseModel):
    worker_service_id: UUID
    description: str = Field(min_length=5, max_length=2000)
    scheduled_for: datetime | None = None


class BookingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    customer_id: UUID
    worker_id: UUID
    worker_service_id: UUID
    description: str
    scheduled_for: datetime | None
    agreed_price: Decimal
    status: str
    created_at: datetime


class BookingStatusUpdate(BaseModel):
    status: Literal["accepted", "rejected", "completed"]
