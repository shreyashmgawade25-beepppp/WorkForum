# WorkForum Architecture (Initial Milestone)

## Current runtime

- `frontend/`: React + TypeScript + Vite; initial responsive prototype.
- `backend/`: FastAPI; root and health endpoints.
- `db`: PostgreSQL with PostGIS extension, started via Compose.
- `redis`: Redis, currently used by the API health endpoint.
- `docs/`: architecture and API notes.

## Planned next layers

1. SQLAlchemy async engine and Alembic migrations.
2. Users, worker profiles, services, jobs, offers, bookings, reviews, verification records, complaints.
3. JWT auth and role-based access checks.
4. PostGIS distance queries and explainable SmartMatch ranking.
5. WebSockets for offers and booking state.
6. Tests, CI and deployment.

## Safety / correctness

- Enforce role checks and state transitions in backend code.
- Only permit reviews for completed bookings.
- Record an agreed price when an offer is accepted.
- Never represent straight-line distance as road travel time.
- Clearly label seeded demo data.
