
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models import Service

router = APIRouter(prefix="/api/services", tags=["Services"])


@router.get("/")
async def list_services(
    search: str | None = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
):
    statement = select(Service).where(Service.is_active.is_(True))

    if search:
        statement = statement.where(
            Service.name.ilike(f"%{search}%")
            | Service.category.ilike(f"%{search}%")
        )

    statement = statement.order_by(Service.category, Service.name)
    services = (await db.scalars(statement)).all()

    return [
        {
            "id": str(service.id),
            "name": service.name,
            "description": service.description,
            "category": service.category,
        }
        for service in services
    ]


@router.get("/{service_id}")
async def get_service(
    service_id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        import uuid
        parsed_id = uuid.UUID(service_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid service ID.")

    service = await db.scalar(
        select(Service).where(
            Service.id == parsed_id,
            Service.is_active.is_(True),
        )
    )

    if service is None:
        raise HTTPException(status_code=404, detail="Service not found.")

    return {
        "id": str(service.id),
        "name": service.name,
        "description": service.description,
        "category": service.category,
    }
