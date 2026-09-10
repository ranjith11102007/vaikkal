"""Async SQLAlchemy database setup."""
from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

_IS_SQLITE = settings.DATABASE_URL.startswith("sqlite")

scheme = settings.DATABASE_URL.split("://", 1)[0].split("+", 1)[0]
if scheme not in ("sqlite", "postgres", "postgresql"):
    raise ValueError(
        "DATABASE_URL must use an async driver "
        "(e.g. sqlite+aiosqlite:///... or postgresql+asyncpg://...). Got: "
        f"{settings.DATABASE_URL.split('://', 1)[0]}"
    )

_engine_kwargs: dict = {
    "echo": settings.DATABASE_ECHO,
    "future": True,
}
if _IS_SQLITE:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    _engine_kwargs.update(
        {
            # NullPool avoids cross-event-loop connection reuse, which breaks
            # FastAPI TestClient suites (each client runs its own loop).
            "poolclass": NullPool,
            "pool_pre_ping": True,
        }
    )

engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)

async_session_maker = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

# Backwards/legacy alias used by seed.py and some utilities.
SessionLocal = async_session_maker


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async database session."""
    async with async_session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Create all tables (used for development; use Alembic in production)."""
    from app.models import Base  # noqa: F401

    # Multi-process deploys can race on CREATE TYPE/tables. create_all is
    # idempotent, so retry to let the other worker finish first.
    import asyncio

    for attempt in range(5):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            break
        except Exception:
            if attempt == 4:
                raise
            await asyncio.sleep(0.5 * (attempt + 1))

    if settings.DATABASE_URL.startswith("sqlite"):
        await _migrate_sqlite_users_phone_nullable()


async def _migrate_sqlite_users_phone_nullable() -> None:
    """Make users.phone nullable on older SQLite databases (idempotent)."""
    from sqlalchemy import text

    async with engine.connect() as conn:
        cols = (await conn.execute(text("PRAGMA table_info(users)"))).fetchall()
    if not cols:
        return

    phone_not_null = any(c[1] == "phone" and c[3] == 1 for c in cols)
    if not phone_not_null:
        return

    create_ddl = (
        "CREATE TABLE users_new ("
        "id VARCHAR(32) NOT NULL, "
        "created_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP), "
        "updated_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP), "
        "email VARCHAR(255), "
        "phone VARCHAR(20), "
        "password_hash VARCHAR(255) NOT NULL, "
        "full_name VARCHAR(255) NOT NULL, "
        "role VARCHAR(32) NOT NULL DEFAULT 'consumer', "
        "is_verified BOOLEAN NOT NULL DEFAULT 0, "
        "is_active BOOLEAN NOT NULL DEFAULT 1, "
        "preferred_language VARCHAR(10) NOT NULL DEFAULT 'ta', "
        "avatar_url TEXT, "
        "verification_status VARCHAR(32) NOT NULL DEFAULT 'draft', "
        "PRIMARY KEY (id)"
        ")"
    )
    async with engine.begin() as conn:
        await conn.execute(text(create_ddl))
        await conn.execute(
            text(
                "INSERT INTO users_new (id, created_at, updated_at, email, phone, "
                "password_hash, full_name, role, is_verified, is_active, "
                "preferred_language, avatar_url, verification_status) "
                "SELECT id, created_at, updated_at, email, phone, password_hash, "
                "full_name, role, is_verified, is_active, preferred_language, "
                "avatar_url, verification_status FROM users"
            )
        )
        await conn.execute(text("DROP TABLE users"))
        await conn.execute(text("ALTER TABLE users_new RENAME TO users"))
        await conn.execute(
            text("CREATE UNIQUE INDEX ix_users_email ON users (email)")
        )
        await conn.execute(
            text("CREATE UNIQUE INDEX ix_users_phone ON users (phone)")
        )


async def ping_database() -> bool:
    """Check whether the database is reachable."""
    try:
        from sqlalchemy import text

        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False