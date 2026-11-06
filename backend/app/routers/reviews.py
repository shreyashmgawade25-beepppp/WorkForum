
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.booking import Booking
from app.models.review import Review
from app.models.user import User
from app.models.worker_profile import WorkerProfile
from app.schemas.review import ReviewCreate, ReviewResponse

router = APIRouter(prefix="/api/reviews", tags=["Reviews"])


@router.post(
    "/",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_review(
    payload: ReviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can submit reviews.",
        )

    result = await db.execute(
        select(Booking).where(Booking.id == payload.booking_id)
    )
    booking = result.scalar_one_or_none()

    if booking is None or booking.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Completed booking not found.",
        )

    if booking.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You can review only completed bookings.",
        )

    existing_result = await db.execute(
        select(Review).where(Review.booking_id == booking.id)
    )
    if existing_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This booking has already been reviewed.",
        )

    review = Review(
        booking_id=booking.id,
        customer_id=current_user.id,
        worker_id=booking.worker_id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)

    try:
        await db.flush()

        rating_result = await db.execute(
            select(func.avg(Review.rating), func.count(Review.id)).where(
                Review.worker_id == booking.worker_id
            )
        )
        average_rating, _ = rating_result.one()

        worker_result = await db.execute(
            select(WorkerProfile).where(
                WorkerProfile.id == booking.worker_id
            )
        )
        worker = worker_result.scalar_one()

        worker.average_rating = float(average_rating or 0.0)

        await db.commit()
        await db.refresh(review)
        return review

    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This booking has already been reviewed.",
        )


@router.get(
    "/worker/{worker_id}",
    response_model=list[ReviewResponse],
)
async def get_worker_reviews(
    worker_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    worker_result = await db.execute(
        select(WorkerProfile.id).where(WorkerProfile.id == worker_id)
    )
    if worker_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Worker not found.",
        )

    result = await db.execute(
        select(Review)
        .where(Review.worker_id == worker_id)
        .order_by(Review.created_at.desc())
    )
    return result.scalars().all()
