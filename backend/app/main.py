
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers.auth import router as auth_router
from app.routers.services import router as services_router
from app.routers.workers import router as workers_router
from app.routers.worker_services import router as worker_services_router
from app.routers.bookings import router as bookings_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Database and Redis connections will be initialized
    # when their respective services are implemented.
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "A hyperlocal marketplace connecting customers "
        "with skilled and unskilled service workers."
    ),
    lifespan=lifespan,
)

app.include_router(auth_router)
app.include_router(services_router)
app.include_router(workers_router)
app.include_router(worker_services_router)
app.include_router(bookings_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_origin.rstrip("/"),
        "https://work-forum-three.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", tags=["System"])
async def root():
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "message": "Welcome to WorkForum",
    }


@app.get("/health", tags=["System"])
async def health():
    return {
        "status": "healthy",
        "service": "workforum-api",
    }
