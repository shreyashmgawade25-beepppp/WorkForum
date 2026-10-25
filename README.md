 Deployed website - https://work-forum-three.vercel.app/


# WorkForum — Connecting Skills with Opportunities

A full-stack local services marketplace that connects customers with skilled professionals through service discovery, transparent pricing, and streamlined booking management.

## 🚀 Overview

Finding reliable local service professionals can be challenging. WorkForum bridges the gap between customers looking for services and workers looking to showcase their skills.

Customers can discover service providers, compare prices, filter listings, and submit booking requests. Workers can manage their profiles, publish services, set prices, and handle incoming bookings through a dedicated dashboard.

## ✨ Key Features

### 🔎 SmartMatch — Smart Service Discovery
- Browse available service categories and worker listings.
- Search for specific services.
- Filter by category, budget, and availability.
- Compare prices, estimated durations, and worker information.
- Use rule-based discovery filters to narrow down suitable options.

### 🛡️ TrustLayer — Worker Transparency
- Display worker availability and profile information.
- Show verification status where available.
- Present completed-job counts and available rating information.
- Help customers make more informed decisions.

*TrustLayer displays trust-related information; it does not independently guarantee worker identity or credentials.*

### 🧰 Worker Dashboard
- Create and manage worker profiles.
- Publish multiple service listings.
- Set service-specific prices and estimated durations.
- View incoming booking requests.
- Accept or reject bookings.
- Mark accepted bookings as completed.

### 📅 Booking Management
- Submit customer booking requests.
- Provide service requirements and preferred schedules.
- Record the agreed price when a booking is created.
- View customer booking history.
- Manage booking status through authorized worker operations.

### 📊 Analytics
- Explore marketplace activity through the analytics interface.
- Present available metrics through dashboard visualizations.

### 🔐 Authentication and Authorization
- User registration and login.
- Customer and worker roles.
- JWT-based authentication.
- Password hashing.
- Protected API endpoints and role-specific operations.

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4 |
| Backend | Python, FastAPI |
| Database | PostgreSQL, PostGIS |
| ORM | SQLAlchemy |
| Database Migrations | Alembic |
| Authentication | JWT, Argon2 |
| API Documentation | FastAPI Swagger UI |
| Version Control | Git, GitHub |

## 🏗️ System Architecture

```mermaid
flowchart TD
    A[Customer] --> UI[React + TypeScript Frontend]
    B[Service Worker] --> UI
    UI --> API[FastAPI REST API]
    API --> AUTH[JWT Authentication]
    API --> SM[SmartMatch Discovery]
    API --> BK[Booking Management]
    API --> TL[TrustLayer Indicators]
    API --> ORM[SQLAlchemy ORM]
    ORM --> DB[(PostgreSQL + PostGIS)]
    MIG[Alembic Migrations] --> DB
```

## 🔄 Booking Workflow

```mermaid
stateDiagram-v2
    [*] --> Pending
    Pending --> Accepted
    Pending --> Rejected
    Accepted --> Completed
```

## 📂 Project Structure

```text
WorkForum/
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   └── api.ts
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models/
│   │   └── routers/
│   ├── alembic/
│   ├── alembic.ini
│   └── requirements.txt
│
└── README.md
```

*The structure above is a simplified overview; exact files may vary.*

## ⚙️ Getting Started

### Prerequisites

Install the following:

- [Python](https://www.python.org/downloads/)
- [Node.js](https://nodejs.org/)
- [PostgreSQL](https://www.postgresql.org/download/)
- [Git](https://git-scm.com/downloads/)

Install PostGIS as well if your configured database or application uses spatial features.

### 1. Clone the Repository

```bash
git clone https://github.com/shreyashmgawade25-beepppp/WorkForum.git
cd WorkForum
```

### 2. Set Up the Backend

Open PowerShell in the project directory:

```powershell
cd backend

python -m venv .venv
.\.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create the `.env` file in the location expected by your backend configuration.

Example values:

```dotenv
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/workforum
JWT_SECRET_KEY=replace_with_a_long_random_secret
```

These are example variable names. Use the names expected by your application's settings, configure the PostgreSQL database, and never commit actual credentials.

### 4. Apply Database Migrations

From the backend directory:

```powershell
alembic upgrade head
```

Ensure your database is running and the connection configuration is correct before applying migrations.

### 5. Start the Backend

```powershell
uvicorn app.main:app --reload
```

Backend endpoints:

- API: http://127.0.0.1:8000
- Swagger documentation: http://127.0.0.1:8000/docs
- ReDoc documentation: http://127.0.0.1:8000/redoc

### 6. Set Up the Frontend

Open a second terminal:

```powershell
cd frontend

npm install
npm run dev
```

Open the URL printed by Vite, usually:

http://localhost:5173/

Make sure the frontend API configuration points to the correct backend URL.

## 🔌 API Overview

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a user |
| POST | `/api/auth/login` | Log in |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/services/` | List service categories |
| GET | `/api/workers/services/discover` | Discover service listings |
| POST | `/api/workers/profile` | Create worker profile |
| GET | `/api/workers/profile/me` | Get worker profile |
| POST | `/api/workers/services` | Publish a service |
| GET | `/api/workers/services/me` | Get own listings |
| POST | `/api/bookings/` | Create a booking |
| GET | `/api/bookings/me` | Get customer bookings |
| GET | `/api/bookings/worker` | Get worker bookings |
| PATCH | `/api/bookings/{booking_id}/status` | Update booking status |

See the interactive Swagger documentation for request schemas, authentication requirements, and response details.

## 🔒 Security Considerations

WorkForum incorporates authentication and role-based authorization. Before production deployment, additional review should cover:

- Secret management and environment configuration.
- Password hashing and login security.
- Booking ownership and role enforcement.
- Input validation and database integrity.
- CORS policies and rate limiting.
- Protection of personal information.
- Database backups, logging, and monitoring.

## 🗺️ Future Roadmap

Potential future improvements include:

- 📍 Location-aware service discovery using PostGIS.
- ⭐ Booking-linked reviews and ratings.
- 💳 Secure payment integration.
- 🔔 Booking notifications.
- 🗺️ Interactive maps and service coverage.
- 🧪 Expanded automated and end-to-end testing.
- 🚀 Production deployment and CI/CD.
- 🛡️ A documented worker identity-verification process.

These items represent possible enhancements, not necessarily existing functionality.

## 🎯 Project Objectives

- Make local service discovery easier.
- Improve price transparency.
- Simplify booking management.
- Help workers showcase their skills.
- Establish a foundation for future location-aware matching and analytics.

## 🤝 Contributing

Contributions and suggestions are welcome.

1. Fork this repository.
2. Create a feature branch.
3. Implement and test your changes.
4. Submit a pull request with a clear description.

Please do not commit credentials, `.env` files, or other sensitive information.

## 📄 License

No license has been specified yet. Add a `LICENSE` file to define the terms under which others may use and distribute this project.

---

**WorkForum — Connecting Skills with Opportunities.**

Built with React, TypeScript, FastAPI, PostgreSQL, and a focus on transparent local service discovery and booking management.
