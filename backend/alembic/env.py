"""
Alembic environment configuration — async-aware with pgvector support.

Key design decisions:
  - Uses run_async_migrations() so Alembic talks to Postgres via asyncpg,
    matching the async engine in app.db.database.
  - Imports all ORM models via app.db.models so autogenerate detects them.
  - Registers the pgvector Vector type so Alembic doesn't choke on it.
"""

import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

# ---------------------------------------------------------------------------
# Ensure the backend/ directory is on sys.path so "config" and "app" resolve.
# ---------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import settings  # noqa: E402

# Import Base (carries metadata) and all models so autogenerate sees them.
from app.db.database import Base  # noqa: E402
import app.db.models  # noqa: E402, F401

# ---------------------------------------------------------------------------
# Alembic Config object — provides access to alembic.ini values.
# ---------------------------------------------------------------------------
alembic_cfg = context.config

# Set the sqlalchemy.url dynamically from our .env-backed settings
# so we never need credentials in alembic.ini.
alembic_cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Interpret the alembic.ini [loggers] section.
if alembic_cfg.config_file_name is not None:
    fileConfig(alembic_cfg.config_file_name)

# The MetaData object for autogenerate support.
target_metadata = Base.metadata


# ---------------------------------------------------------------------------
# Offline migrations (generates SQL script without a live DB connection)
# ---------------------------------------------------------------------------
def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = alembic_cfg.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# Online (async) migrations — talks to the live database
# ---------------------------------------------------------------------------
def do_run_migrations(connection) -> None:
    """Configure the migration context and run."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an async engine and run migrations within its connection."""
    configuration = alembic_cfg.get_section(alembic_cfg.config_ini_section, {})
    configuration["sqlalchemy.url"] = settings.DATABASE_URL

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (async)."""
    asyncio.run(run_async_migrations())


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
