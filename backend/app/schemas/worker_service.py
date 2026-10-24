
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WorkerServiceCreate(BaseModel):
    service_id: UUID
    base_price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    estimated_duration_minutes: int = Field(default=60, ge=5, le=1440)


class WorkerServiceUpdate(BaseModel):
    base_price: Decimal | None = Field(
        default=None, gt=0, max_digits=10, decimal_places=2
    )
    estimated_duration_minutes: int | None = Field(
        default=None, ge=5, le=1440
    )
    is_active: bool | None = None


class WorkerServiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    worker_id: UUID
    service_id: UUID
    base_price: Decimal
    estimated_duration_minutes: int
    is_active: bool
    created_at: datetime
