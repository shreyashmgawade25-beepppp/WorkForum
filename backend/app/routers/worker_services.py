
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models import Service, User, WorkerProfile, WorkerService
from app.schemas.worker_service import (
    WorkerServiceCreate,
    WorkerServiceResponse,
    WorkerServiceUpdate,
)

router = APIRouter(
    prefix="/api/workers/services",
    tags=["Worker Services"],
)


async def get_worker_profile(
    user: User,
    db: AsyncSession,
) -> WorkerProfile:
    if user.role != "worker":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only worker accounts can manage service listings.",
        )

    profile = await db.scalar(
        select(WorkerProfile).where(
            WorkerProfile.user_id == user.id
        )
    )
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Create your worker profile first.",
        )

    return profile


async def get_owned_listing(
    listing_id: UUID,
    worker_id: UUID,
    db: AsyncSession,
) -> WorkerService:
    listing = await db.scalar(
        select(WorkerService).where(
            WorkerService.id == listing_id,
            WorkerService.worker_id == worker_id,
        )
    )

    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service listing not found.",
        )

    return listing


@router.post(
    "",
    response_model=WorkerServiceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_worker_service(
    payload: WorkerServiceCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_worker_profile(user, db)

    service = await db.scalar(
        select(Service).where(
            Service.id == payload.service_id,
            Service.is_active.is_(True),
        )
    )
    if service is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active service not found.",
        )

    existing = await db.scalar(
        select(WorkerService).where(
            WorkerService.worker_id == profile.id,
            WorkerService.service_id == payload.service_id,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a listing for this service.",
        )

    listing = WorkerService(
        worker_id=profile.id,
        service_id=payload.service_id,
        base_price=payload.base_price,
        estimated_duration_minutes=payload.estimated_duration_minutes,
    )
    db.add(listing)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A listing for this service already exists.",
        )

    await db.refresh(listing)
    return listing


@router.get(
    "/me",
    response_model=list[WorkerServiceResponse],
)

@router.get("/discover")
async def discover_worker_services(
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(WorkerService)
        .join(WorkerService.worker)
        .join(WorkerService.service)
        .join(WorkerProfile.user)
        .options(
            selectinload(WorkerService.worker).selectinload(
                WorkerProfile.user
            ),
            selectinload(WorkerService.service),
        )
        .where(
            WorkerService.is_active.is_(True),
            WorkerProfile.is_available.is_(True),
            WorkerProfile.user.has(User.is_active.is_(True)),
            Service.is_active.is_(True),
        )
        .order_by(WorkerService.base_price.asc())
    )

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            Service.name.ilike(term)
            | Service.category.ilike(term)
            | User.full_name.ilike(term)
        )

    result = await db.scalars(query)
    listings = result.all()

    return [
        {
            "listing_id": str(listing.id),
            "worker_id": str(listing.worker_id),
            "service_id": str(listing.service_id),
            "worker_name": listing.worker.user.full_name,
            "service_name": listing.service.name,
            "category": listing.service.category,
            "description": listing.service.description,
            "price": float(listing.base_price),
            "estimated_duration_minutes": listing.estimated_duration_minutes,
            "city": listing.worker.city,
            "is_available": listing.worker.is_available,
            "verification_status": listing.worker.verification_status,
            "average_rating": float(listing.worker.average_rating),
            "completed_jobs": listing.worker.completed_jobs,
        }
        for listing in listings
    ]

async def list_my_services(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_worker_profile(user, db)

    result = await db.scalars(
        select(WorkerService)
        .where(WorkerService.worker_id == profile.id)
        .order_by(WorkerService.created_at.desc())
    )
    return result.all()


@router.patch(
    "/{listing_id}",
    response_model=WorkerServiceResponse,
)
async def update_worker_service(
    listing_id: UUID,
    payload: WorkerServiceUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_worker_profile(user, db)
    listing = await get_owned_listing(listing_id, profile.id, db)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(listing, field, value)

    await db.commit()
    await db.refresh(listing)
    return listing


@router.delete(
    "/{listing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_worker_service(
    listing_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_worker_profile(user, db)
    listing = await get_owned_listing(listing_id, profile.id, db)

    await db.delete(listing)
    await db.commit()
    return None
