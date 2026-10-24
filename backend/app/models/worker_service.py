
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class WorkerService(Base):
    __tablename__ = "worker_services"
    __table_args__ = (
        UniqueConstraint(
            "worker_id",
            "service_id",
            name="uq_worker_service",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    worker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("worker_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("services.id", ondelete="CASCADE"),
        nullable=False,
    )
    base_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False
    )
    estimated_duration_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=60
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    worker: Mapped["WorkerProfile"] = relationship(
        back_populates="services"
    )
    service: Mapped["Service"] = relationship(
        back_populates="workers"
    )
