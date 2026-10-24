# WorkForum

**Hyperlocal Services & Worker Empowerment Platform** — hackathon starter project.

## Current scope

This ZIP contains the project files created in the initial foundation milestone:
- React + TypeScript + Vite frontend
- Responsive WorkForum landing page with searchable illustrative worker cards
- FastAPI API with root and health endpoints
- Docker Compose definitions for PostgreSQL/PostGIS and Redis
- Environment template and basic project documentation

**Not yet implemented:** database connection/migrations, registration/login, worker/job APIs, offers/counteroffers, bookings, reviews, SmartMatch, WebSockets, AI integrations, deployment configuration. UI sample workers and ratings are illustrative only.

## Requirements

- Node.js (current LTS recommended) and npm
- Python 3.11+ recommended
- Docker Compose plugin (or managed PostgreSQL/Redis alternatives)

## Quick start

### 1. Environment and services

```bash
cp .env.example .env
# Edit .env and change the development password if desired.
docker compose up -d
docker compose ps
```

The sample `DATABASE_URL` in `.env.example` must use the same password as `POSTGRES_PASSWORD`.

### 2. Backend

In terminal A:

```bash
cd backend
python -m venv .venv
# Linux/macOS/Codespaces:
source .venv/bin/activate
# Windows PowerShell instead:
# .venv\Scripts\Activate.ps1

pip install -r requirements.txt
fastapi dev app/main.py --host 0.0.0.0
```

API docs: http://localhost:8000/docs  
Health: http://localhost:8000/health

The current health endpoint checks Redis. PostgreSQL is defined in Compose but is not yet connected to the API.

### 3. Frontend

In terminal B, from the project root:

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Open the URL printed by Vite (usually http://localhost:5173).

### 4. Build checks

```bash
cd frontend
npm run build
```

And in another terminal:

```bash
cd backend
python -m compileall app
```

## Cloud development with GitHub Codespaces

1. Create a GitHub repository named `workforum`.
2. Upload/push this project to it.
3. Create a Codespace on the repository.
4. Run the commands above in the integrated terminal.
5. In Codespaces, open the Ports tab to preview port 5173 and port 8000.

## Team collaboration

- Member 1: frontend and UI
- Member 2: backend/database/auth
- Member 3: SmartMatch, offers and booking workflow
- Member 4: integration, tests, deployment and demo

Use feature branches and agree on API request/response schemas before parallel implementation.

## Security notes

- Never commit `.env`.
- Use managed secrets and strong unique credentials for hosted deployments.
- Do not treat illustrative profiles as real workers or verified identities.
- Do not claim live ETA, identity verification or payment processing until integrations are implemented and tested.
