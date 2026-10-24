
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.booking import Booking
from app.models.user import User
from app.models.worker_profile import WorkerProfile
from app.models.worker_service import WorkerService
from app.schemas.booking import (
    BookingCreate,
    BookingResponse,
    BookingStatusUpdate,
)

router = APIRouter(prefix="/api/bookings", tags=["Bookings"])


@router.post(
    "/",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_booking(
    payload: BookingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can create bookings.",
        )

    result = await db.execute(
        select(WorkerService)
        .options(
            selectinload(WorkerService.worker).selectinload(
                WorkerProfile.user
            ),
            selectinload(WorkerService.service),
        )
        .where(WorkerService.id == payload.worker_service_id)
    )
    listing = result.scalar_one_or_none()

    if (
        listing is None
        or not listing.is_active
        or listing.worker is None
        or not listing.worker.is_available
        or listing.worker.user is None
        or not listing.worker.user.is_active
        or listing.service is None
        or not listing.service.is_active
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This worker service is not available.",
        )

    booking = Booking(
        customer_id=current_user.id,
        worker_id=listing.worker_id,
        worker_service_id=listing.id,
        description=payload.description,
        scheduled_for=payload.scheduled_for,
        agreed_price=listing.base_price,
        status="pending",
    )

    db.add(booking)
    await db.commit()
    await db.refresh(booking)
    return booking


@router.get("/me", response_model=list[BookingResponse])
async def get_my_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Booking)
        .where(Booking.customer_id == current_user.id)
        .order_by(Booking.created_at.desc())
    )
    return result.scalars().all()


@router.get("/worker")
async def get_worker_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "worker":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workers can view incoming bookings.",
        )

    profile_result = await db.execute(
        select(WorkerProfile).where(
            WorkerProfile.user_id == current_user.id
        )
    )
    profile = profile_result.scalar_one_or_none()

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Create your worker profile first.",
        )

    result = await db.execute(
        select(Booking)
        .options(
            selectinload(Booking.customer),
            selectinload(Booking.worker_service).selectinload(
                WorkerService.service
            ),
        )
        .where(Booking.worker_id == profile.id)
        .order_by(Booking.created_at.desc())
    )

    bookings = result.scalars().all()

    return [
        {
            "id": str(booking.id),
            "customer_id": str(booking.customer_id),
            "customer_name": booking.customer.full_name,
            "worker_service_id": str(booking.worker_service_id),
            "service_name": booking.worker_service.service.name,
            "description": booking.description,
            "scheduled_for": booking.scheduled_for,
            "agreed_price": float(booking.agreed_price),
            "status": booking.status,
            "created_at": booking.created_at,
        }
        for booking in bookings
    ]


@router.patch("/{booking_id}/status", response_model=BookingResponse)
async def update_booking_status(
    booking_id: UUID,
    payload: BookingStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "worker":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workers can update booking status.",
        )

    profile_result = await db.execute(
        select(WorkerProfile).where(
            WorkerProfile.user_id == current_user.id
        )
    )
    profile = profile_result.scalar_one_or_none()

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Worker profile not found.",
        )

    result = await db.execute(
        select(Booking).where(Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()

    if booking is None or booking.worker_id != profile.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found for this worker.",
        )

    allowed_transitions = {
        "pending": {"accepted", "rejected"},
        "accepted": {"completed"},
    }

    if payload.status not in allowed_transitions.get(booking.status, set()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot change booking from '{booking.status}' to '{payload.status}'.",
        )

    booking.status = payload.status
    await db.commit()
    await db.refresh(booking)
    return booking
