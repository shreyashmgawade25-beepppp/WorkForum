
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models import User, WorkerProfile
from app.schemas.worker import (
    WorkerProfileCreate,
    WorkerProfileResponse,
    WorkerProfileUpdate,
)

router = APIRouter(prefix="/api/workers", tags=["Workers"])


def serialize_profile(profile: WorkerProfile) -> dict:
    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "full_name": profile.user.full_name,
        "bio": profile.bio,
        "city": profile.city,
        "latitude": profile.latitude,
        "longitude": profile.longitude,
        "is_available": profile.is_available,
        "verification_status": profile.verification_status,
        "average_rating": profile.average_rating,
        "completed_jobs": profile.completed_jobs,
        "created_at": profile.created_at,
    }


async def get_own_profile(
    user: User,
    db: AsyncSession,
) -> WorkerProfile:
    profile = await db.scalar(
        select(WorkerProfile).where(
            WorkerProfile.user_id == user.id
        )
    )
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Worker profile not found. Create one first.",
        )
    return profile


@router.post(
    "/profile",
    response_model=WorkerProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_worker_profile(
    payload: WorkerProfileCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role != "worker":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only worker accounts can create worker profiles.",
        )

    existing = await db.scalar(
        select(WorkerProfile).where(
            WorkerProfile.user_id == user.id
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a worker profile.",
        )

    profile = WorkerProfile(
        user_id=user.id,
        bio=payload.bio,
        city=payload.city,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)

    profile.user = user
    return serialize_profile(profile)


@router.get(
    "/profile/me",
    response_model=WorkerProfileResponse,
)
async def read_my_worker_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role != "worker":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is for worker accounts only.",
        )

    profile = await get_own_profile(user, db)
    profile.user = user
    return serialize_profile(profile)


@router.patch(
    "/profile/me",
    response_model=WorkerProfileResponse,
)
async def update_my_worker_profile(
    payload: WorkerProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role != "worker":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is for worker accounts only.",
        )

    profile = await get_own_profile(user, db)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)

    profile.user = user
    return serialize_profile(profile)
