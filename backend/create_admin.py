"""Standalone admin creation script.
Usage: python create_admin.py
This script loads .env, prompts for username/email/password, hashes the password,
and inserts into admin_users using the app's async SQLAlchemy session.
"""
import asyncio
from getpass import getpass

from dotenv import load_dotenv
from sqlalchemy import select

from app.core.security import hash_password
from app.core.database import async_session_maker
from app.models.admin_user import AdminUser


load_dotenv()


async def main():
    username = input("Admin username: ").strip()
    email = input("Admin email: ").strip()
    password = getpass("Password: ")
    password2 = getpass("Confirm Password: ")
    if password != password2:
        print("Passwords do not match")
        return

    async with async_session_maker() as session:
        existing = await session.scalar(
            select(AdminUser).where(
                (AdminUser.username == username) | (AdminUser.email == email)
            )
        )

        if existing:
            existing.username = username
            existing.email = email
            existing.hashed_password = hash_password(password)
            existing.is_active = True
            admin = existing
        else:
            admin = AdminUser(
                username=username,
                email=email,
                hashed_password=hash_password(password),
                is_active=True,
            )
            session.add(admin)

        await session.commit()
        print(f"Admin saved! username={admin.username} email={admin.email}")


if __name__ == "__main__":
    asyncio.run(main())
