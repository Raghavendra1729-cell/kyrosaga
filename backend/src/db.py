import asyncpg
from typing import Any
from src.config import settings

class Database:
    pool: asyncpg.Pool | None = None

    @classmethod
    async def connect(cls) -> None:
        if cls.pool is None:
            cls.pool = await asyncpg.create_pool(
                dsn=settings.database_url,
                min_size=2,
                max_size=10
            )

    @classmethod
    async def disconnect(cls) -> None:
        if cls.pool is not None:
            await cls.pool.close()
            cls.pool = None

    @classmethod
    async def fetch(cls, query: str, *args: Any) -> list[asyncpg.Record]:
        if cls.pool is None:
            raise RuntimeError("Database pool not initialized")
        async with cls.pool.acquire() as conn:
            return await conn.fetch(query, *args)

    @classmethod
    async def execute(cls, query: str, *args: Any) -> str:
        if cls.pool is None:
            raise RuntimeError("Database pool not initialized")
        async with cls.pool.acquire() as conn:
            return await conn.execute(query, *args)

    @classmethod
    async def fetchrow(cls, query: str, *args: Any) -> asyncpg.Record | None:
        if cls.pool is None:
            raise RuntimeError("Database pool not initialized")
        async with cls.pool.acquire() as conn:
            return await conn.fetchrow(query, *args)
