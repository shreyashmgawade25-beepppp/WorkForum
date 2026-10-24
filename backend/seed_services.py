
import asyncio

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models import Service


SERVICES = [
    ("Plumbing", "Tap, pipe and water-leak repairs", "Home Repair"),
    ("Electrical Repair", "Switches, wiring and electrical repairs", "Home Repair"),
    ("Carpentry", "Furniture repairs and installation", "Home Repair"),
    ("House Cleaning", "Home and apartment cleaning", "Cleaning"),
    ("Painting", "Interior and exterior painting", "Home Repair"),
    ("AC Repair", "Air conditioner servicing and repairs", "Appliance Repair"),
    ("Appliance Repair", "Repairs for common home appliances", "Appliance Repair"),
    ("Moving Help", "Loading, unloading and moving assistance", "Moving"),
    ("Gardening", "Garden maintenance and basic landscaping", "Outdoor"),
    ("Computer Repair", "Computer troubleshooting and setup", "Technology"),
    ("Tutoring", "Academic tutoring and learning support", "Education"),
    ("Beauty Services", "At-home grooming and beauty services", "Personal Care"),
]


async def main():
    async with AsyncSessionLocal() as db:
        added = 0

        for name, description, category in SERVICES:
            existing = await db.scalar(
                select(Service).where(Service.name == name)
            )

            if existing:
                continue

            db.add(
                Service(
                    name=name,
                    description=description,
                    category=category,
                    is_active=True,
                )
            )
            added += 1

        await db.commit()
        print(f"Service seeding complete. Added {added} new services.")

        services = (
            await db.scalars(
                select(Service)
                .where(Service.is_active.is_(True))
                .order_by(Service.category, Service.name)
            )
        ).all()

        print(f"Total active services: {len(services)}")
        for service in services:
            print(f"- {service.name} ({service.category})")

    await AsyncSessionLocal.kw["bind"].dispose()


if __name__ == "__main__":
    asyncio.run(main())
