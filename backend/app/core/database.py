from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from typing import AsyncGenerator
from .config import settings


# SQLAlchemy Base for all models
class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models"""
    pass


# Async engine with connection pooling
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    poolclass=NullPool,  # Optimal for asyncpg
    pool_pre_ping=True,  # Test connections before using
    connect_args={
        "server_settings": {"application_name": "koremobile_api"},
        "timeout": 10,
        "command_timeout": 10,
    },
)

# Async session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency: Provide AsyncSession for each request.
    Usage: async def my_route(db: AsyncSession = Depends(get_db)):
    """
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """
    Initialize database by creating all tables.
    Safe to call multiple times (no-op if tables exist).
    Should be called on app startup via lifespan.
    """
    async with engine.begin() as conn:
        # Tables should already exist, this is a safety measure
        await conn.run_sync(Base.metadata.create_all)
