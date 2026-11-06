
import asyncio
import csv
from pathlib import Path

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal, engine
from app.models.user import User
from app.models.worker_profile import WorkerProfile
from app.models.worker_service import WorkerService
from app.models.service import Service


CUSTOMER_COUNT = 50
WORKER_COUNT = 30

DEMO_PASSWORD = "Demo@12345"
EMAIL_DOMAIN = "example.test"

# Broad demo locations; these are fictional listings.
CITIES = [
    "Mumbai",
    "Thane",
    "Mira Road",
    "Navi Mumbai",
    "Borivali",
    "Andheri",
]

# Prices are illustrative demo prices in INR.
SERVICE_PRICES = {
    "Carpentry": 500,
    "Tutoring": 400,
    "Electrical Repair": 350,
    "Beauty Services": 600,
    "House Cleaning": 700,
    "Plumbing": 400,
    "Painting": 800,
    "Appliance Repair": 500,
    "AC Repair": 650,
    "Moving Help": 900,
    "Computer Repair": 500,
    "Gardening": 350,
}


def demo_email(role: str, number: int) -> str:
    return f"demo.{role}{number:03d}@{EMAIL_DOMAIN}"


def demo_phone(number: int) -> str:
    # Reserved-looking synthetic values; do not use for real customers.
    return f"90000{number:05d}"


async def main():
    credentials_path = Path(__file__).with_name(
        "demo_credentials.csv"
    )

    created_customers = 0
    created_workers = 0
    created_profiles = 0
    created_listings = 0

    # Load services already present in the database.
    async with AsyncSessionLocal() as db:
        services = (
            await db.execute(
                select(Service).where(Service.is_active.is_(True))
            )
        ).scalars().all()

        if not services:
            raise RuntimeError(
                "No active services found. Seed services first."
            )

        existing_service_names = {s.name for s in services}
        print(f"Found {len(services)} active services.")

        # Store the credentials only on your local computer.
        credentials = []

        for number in range(1, CUSTOMER_COUNT + 1):
            email = demo_email("customer", number)
            phone = demo_phone(number)

            existing = await db.scalar(
                select(User).where(User.email == email)
            )
            if existing:
                continue

            user = User(
                full_name=f"Demo Customer {number:03d}",
                email=email,
                phone=phone,
                password_hash=hash_password(DEMO_PASSWORD),
                role="customer",
                is_active=True,
            )
            db.add(user)
            credentials.append(
                {
                    "role": "customer",
                    "email": email,
                    "password": DEMO_PASSWORD,
                }
            )
            created_customers += 1

        # Flush users before creating their dependent profiles.
        await db.flush()

        for number in range(1, WORKER_COUNT + 1):
            email = demo_email("worker", number)
            phone = demo_phone(1000 + number)

            user = await db.scalar(
                select(User).where(User.email == email)
            )

            if user is None:
                user = User(
                    full_name=f"Demo Worker {number:03d}",
                    email=email,
                    phone=phone,
                    password_hash=hash_password(DEMO_PASSWORD),
                    role="worker",
                    is_active=True,
                )
                db.add(user)
                await db.flush()
                created_workers += 1

                credentials.append(
                    {
                        "role": "worker",
                        "email": email,
                        "password": DEMO_PASSWORD,
                    }
                )

            profile = await db.scalar(
                select(WorkerProfile).where(
                    WorkerProfile.user_id == user.id
                )
            )

            if profile is None:
                city = CITIES[(number - 1) % len(CITIES)]
                profile = WorkerProfile(
                    user_id=user.id,
                    bio=(
                        f"Demo service professional offering "
                        f"reliable local services in {city}."
                    ),
                    city=city,
                    is_available=True,
                    verification_status="pending",
                    average_rating=0.0,
                    completed_jobs=0,
                )
                db.add(profile)
                await db.flush()
                created_profiles += 1

            # Assign two services to each worker, spread across
            # the active services already in the database.
            for offset in range(min(2, len(services))):
                service = services[
                    (number - 1 + offset) % len(services)
                ]

                existing_listing = await db.scalar(
                    select(WorkerService).where(
                        WorkerService.worker_id == profile.id,
                        WorkerService.service_id == service.id,
                    )
                )

                if existing_listing is None:
                    price = SERVICE_PRICES.get(service.name, 500)
                    db.add(
                        WorkerService(
                            worker_id=profile.id,
                            service_id=service.id,
                            base_price=price,
                            estimated_duration_minutes=60,
                            is_active=True,
                        )
                    )
                    created_listings += 1

        await db.commit()

        # Export credentials for newly created demo accounts only.
        if credentials:
            write_header = not credentials_path.exists()
            with credentials_path.open(
                "a", newline="", encoding="utf-8"
            ) as file:
                writer = csv.DictWriter(
                    file,
                    fieldnames=["role", "email", "password"],
                )
                if write_header:
                    writer.writeheader()
                writer.writerows(credentials)

    await engine.dispose()

    print("\nBulk seeding complete.")
    print(f"New customers: {created_customers}")
    print(f"New workers: {created_workers}")
    print(f"New worker profiles: {created_profiles}")
    print(f"New worker service listings: {created_listings}")
    print(f"Credentials file: {credentials_path}")
    print(f"Shared demo password for new accounts: {DEMO_PASSWORD}")
    print("\nThese are synthetic demo accounts, not real registrations.")


if __name__ == "__main__":
    asyncio.run(main())
