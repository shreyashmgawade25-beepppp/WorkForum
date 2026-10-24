
import asyncio

from sqlalchemy import text
from app.db.session import engine


async def main():
    try:
        async with engine.connect() as connection:
            result = await connection.execute(
                text("""
                    SELECT
                        current_database(),
                        version(),
                        PostGIS_Full_Version()
                """)
            )
            row = result.fetchone()

            print("Database connection: SUCCESS")
            print(f"Database: {row[0]}")
            print(f"PostgreSQL: {row[1].split(',')[0]}")
            print(f"PostGIS: {row[2].split(' ')[0]}")

            tables = await connection.execute(
                text("""
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    ORDER BY table_name
                """)
            )

            print("\nTables detected:")
            for table in tables.fetchall():
                print(f" - {table[0]}")

    except Exception as error:
        print("Database connection: FAILED")
        print(f"Error: {error}")
        raise
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
