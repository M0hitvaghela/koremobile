"""
Redis cache and session store for Koremobile.

Redis DB layout:
  0 sessions
  1 otp
  2 products + wishlist
  3 search
  4 cart
  5 orders
  6 settings
  7 reviews
  8 ratelimit
  9 email
  10 pincode
"""
from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime
from typing import Any, Optional
from urllib.parse import urlparse, urlunparse

import redis.asyncio as aioredis

from app.core.config import settings


class CacheTTL:
    SESSION = 86400         # 24h
    OTP_TTL = 600           # 10m
    OTP_COOLDOWN = 90       # 90s
    PRODUCTS_LIST = 3600    # 1h
    PRODUCT_DETAIL = 3600   # 1h
    FEATURED = 3600         # 1h
    CATEGORIES = 3600       # 1h
    REVIEWS = 900           # 15m
    ORDERS_LIST = 300       # 5m
    ORDER_DETAIL = 300      # 5m
    SETTINGS_TTL = 1800     # 30m
    SEARCH_SUGGEST = 300    # 5m
    SEARCH_HISTORY = 2592000  # 30d
    CART = 86400            # 24h
    WISHLIST = 3600         # 1h
    EMAIL = 86400           # 24h
    PINCODE = 604800        # 7 days


def _base_redis_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in ("redis", "rediss"):
        return url
    if parsed.path and parsed.path != "/":
        parsed = parsed._replace(path="", params="", query="", fragment="")
    return urlunparse(parsed)


class RedisManager:
    def __init__(self, base_url: str):
        self._base_url = base_url
        self._clients: dict[int, aioredis.Redis] = {}

    def client(self, db: int) -> aioredis.Redis:
        if db not in self._clients:
            self._clients[db] = aioredis.from_url(
                self._base_url,
                db=db,
                encoding="utf-8",
                decode_responses=True,
            )
        return self._clients[db]

    async def connect(self, dbs: list[int]) -> None:
        for db in sorted(set(dbs)):
            await self.client(db).ping()

    async def disconnect(self) -> None:
        for client in self._clients.values():
            await client.aclose()


class RedisCache:
    """Async Redis wrapper with JSON serialization."""

    def __init__(self, manager: RedisManager, db: int):
        self._manager = manager
        self._db = db

    @property
    def client(self) -> aioredis.Redis:
        return self._manager.client(self._db)

    async def get(self, key: str) -> Any:
        try:
            raw = await self.client.get(key)
            return json.loads(raw) if raw is not None else None
        except Exception:
            return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        try:
            payload = json.dumps(value, default=str)
            if ttl:
                await self.client.setex(key, ttl, payload)
            else:
                await self.client.set(key, payload)
        except Exception:
            pass

    async def delete(self, key: str) -> None:
        try:
            await self.client.delete(key)
        except Exception:
            pass

    async def delete_pattern(self, pattern: str) -> None:
        """Delete all keys matching a glob pattern (SCAN-based)."""
        try:
            cursor = 0
            while True:
                cursor, keys = await self.client.scan(cursor, match=pattern, count=200)
                if keys:
                    await self.client.delete(*keys)
                if cursor == 0:
                    break
        except Exception:
            pass


class RedisSessionStore:
    """Redis-backed session store for validation and listing."""

    def __init__(self, cache: RedisCache):
        self._cache = cache

    @staticmethod
    def _user_key(jti: str) -> str:
        return f"session:user:{jti}"

    @staticmethod
    def _admin_key(jti: str) -> str:
        return f"session:admin:{jti}"

    @staticmethod
    def _user_index(user_id: int) -> str:
        return f"session:user:index:{user_id}"

    @staticmethod
    def _admin_index(admin_id: int) -> str:
        return f"session:admin:index:{admin_id}"

    @staticmethod
    def _user_id_key(session_id: int) -> str:
        return f"session:user:id:{session_id}"

    @staticmethod
    def _admin_id_key(session_id: int) -> str:
        return f"session:admin:id:{session_id}"

    async def store_user_session(
        self,
        session_id: int,
        user_id: int,
        jti: str,
        device_info: str,
        ip_address: str,
        expires_at: datetime,
    ) -> None:
        now_ts = datetime.utcnow().timestamp()
        key = self._user_key(jti)
        payload = {
            "id": str(session_id),
            "user_id": str(user_id),
            "device_info": device_info or "",
            "ip_address": ip_address or "",
            "created_at_ts": str(now_ts),
            "last_used_ts": str(now_ts),
            "expires_at_ts": str(expires_at.timestamp()),
        }
        for field, value in payload.items():
            await self._cache.client.hset(key, field, value)
        await self._cache.client.expire(key, CacheTTL.SESSION)
        await self._cache.client.setex(self._user_id_key(session_id), CacheTTL.SESSION, jti)
        index_key = self._user_index(user_id)
        await self._cache.client.zadd(index_key, {jti: now_ts})
        await self._cache.client.expire(index_key, CacheTTL.SESSION)

    async def store_admin_session(
        self,
        session_id: int,
        admin_id: int,
        jti: str,
        device_info: str,
        ip_address: str,
        expires_at: datetime,
    ) -> None:
        now_ts = datetime.utcnow().timestamp()
        key = self._admin_key(jti)
        payload = {
            "id": str(session_id),
            "admin_id": str(admin_id),
            "device_info": device_info or "",
            "ip_address": ip_address or "",
            "created_at_ts": str(now_ts),
            "last_used_ts": str(now_ts),
            "expires_at_ts": str(expires_at.timestamp()),
        }
        for field, value in payload.items():
            await self._cache.client.hset(key, field, value)
        await self._cache.client.expire(key, CacheTTL.SESSION)
        await self._cache.client.setex(self._admin_id_key(session_id), CacheTTL.SESSION, jti)
        index_key = self._admin_index(admin_id)
        await self._cache.client.zadd(index_key, {jti: now_ts})
        await self._cache.client.expire(index_key, CacheTTL.SESSION)

    async def validate_user_session(self, jti: str) -> bool:
        key = self._user_key(jti)
        data = await self._cache.client.hgetall(key)
        if not data:
            return False
        expires_at = float(data.get("expires_at_ts", "0") or 0)
        now_ts = datetime.utcnow().timestamp()
        if expires_at and expires_at < now_ts:
            await self.revoke_user_session(jti)
            return False
        user_id = int(data.get("user_id", "0") or 0)
        if user_id:
            await self._cache.client.hset(key, "last_used_ts", str(now_ts))
            index_key = self._user_index(user_id)
            await self._cache.client.zadd(index_key, {jti: now_ts})
            await self._cache.client.expire(index_key, CacheTTL.SESSION)
        return True

    async def validate_admin_session(self, jti: str) -> bool:
        key = self._admin_key(jti)
        data = await self._cache.client.hgetall(key)
        if not data:
            return False
        expires_at = float(data.get("expires_at_ts", "0") or 0)
        now_ts = datetime.utcnow().timestamp()
        if expires_at and expires_at < now_ts:
            await self.revoke_admin_session(jti)
            return False
        admin_id = int(data.get("admin_id", "0") or 0)
        if admin_id:
            await self._cache.client.hset(key, "last_used_ts", str(now_ts))
            index_key = self._admin_index(admin_id)
            await self._cache.client.zadd(index_key, {jti: now_ts})
            await self._cache.client.expire(index_key, CacheTTL.SESSION)
        return True

    async def revoke_user_session(self, jti: str) -> None:
        key = self._user_key(jti)
        data = await self._cache.client.hgetall(key)
        if data:
            user_id = int(data.get("user_id", "0") or 0)
            session_id = int(data.get("id", "0") or 0)
            if user_id:
                await self._cache.client.zrem(self._user_index(user_id), jti)
            if session_id:
                await self._cache.client.delete(self._user_id_key(session_id))
        await self._cache.client.delete(key)

    async def revoke_admin_session(self, jti: str) -> None:
        key = self._admin_key(jti)
        data = await self._cache.client.hgetall(key)
        if data:
            admin_id = int(data.get("admin_id", "0") or 0)
            session_id = int(data.get("id", "0") or 0)
            if admin_id:
                await self._cache.client.zrem(self._admin_index(admin_id), jti)
            if session_id:
                await self._cache.client.delete(self._admin_id_key(session_id))
        await self._cache.client.delete(key)

    async def revoke_user_session_by_id(self, session_id: int) -> Optional[str]:
        jti = await self._cache.client.get(self._user_id_key(session_id))
        if jti:
            await self.revoke_user_session(jti)
        return jti

    async def revoke_admin_session_by_id(self, session_id: int) -> Optional[str]:
        jti = await self._cache.client.get(self._admin_id_key(session_id))
        if jti:
            await self.revoke_admin_session(jti)
        return jti

    async def revoke_all_user_sessions(self, user_id: int) -> None:
        index_key = self._user_index(user_id)
        jtis = await self._cache.client.zrange(index_key, 0, -1)
        for jti in jtis:
            await self.revoke_user_session(jti)
        await self._cache.client.delete(index_key)

    async def revoke_all_admin_sessions(self, admin_id: int) -> None:
        index_key = self._admin_index(admin_id)
        jtis = await self._cache.client.zrange(index_key, 0, -1)
        for jti in jtis:
            await self.revoke_admin_session(jti)
        await self._cache.client.delete(index_key)

    async def list_user_sessions(self, user_id: int) -> list[dict]:
        index_key = self._user_index(user_id)
        jtis = await self._cache.client.zrevrange(index_key, 0, -1)
        sessions: list[dict] = []
        now_ts = datetime.utcnow().timestamp()
        for jti in jtis:
            data = await self._cache.client.hgetall(self._user_key(jti))
            if not data:
                continue
            expires_at = float(data.get("expires_at_ts", "0") or 0)
            if expires_at and expires_at < now_ts:
                await self.revoke_user_session(jti)
                continue
            data["jti"] = jti
            sessions.append(data)
        return sessions

    async def list_admin_sessions(self, admin_id: int) -> list[dict]:
        index_key = self._admin_index(admin_id)
        jtis = await self._cache.client.zrevrange(index_key, 0, -1)
        sessions: list[dict] = []
        now_ts = datetime.utcnow().timestamp()
        for jti in jtis:
            data = await self._cache.client.hgetall(self._admin_key(jti))
            if not data:
                continue
            expires_at = float(data.get("expires_at_ts", "0") or 0)
            if expires_at and expires_at < now_ts:
                await self.revoke_admin_session(jti)
                continue
            data["jti"] = jti
            sessions.append(data)
        return sessions


class OtpStore:
    """OTP helpers for Redis (no plaintext storage)."""

    def __init__(self, cache: RedisCache):
        self._cache = cache

    @staticmethod
    def _otp_hash(otp: str) -> str:
        return hashlib.sha256(otp.encode()).hexdigest()

    async def store_otp(
        self,
        identifier: str,
        otp: str,
        ip_address: str = "",
        ttl: int = CacheTTL.OTP_TTL,
    ) -> None:
        key = f"otp:{identifier}"
        payload = {
            "hash": self._otp_hash(otp),
            "attempts": 0,
            "ip": ip_address,
        }
        await self._cache.set(key, payload, ttl)

    async def verify_otp(
        self,
        identifier: str,
        otp: str,
        max_attempts: int = 5,
    ) -> tuple[bool, str]:
        key = f"otp:{identifier}"
        data = await self._cache.get(key)

        if data is None:
            return False, "OTP expired or not found"

        if data.get("attempts", 0) >= max_attempts:
            await self._cache.delete(key)
            return False, "Too many incorrect attempts"

        if not hmac.compare_digest(data.get("hash", ""), self._otp_hash(otp)):
            data["attempts"] = data.get("attempts", 0) + 1
            try:
                remaining = await self._cache.client.ttl(key)
                ttl = max(int(remaining), 1)
            except Exception:
                ttl = CacheTTL.OTP_TTL
            await self._cache.set(key, data, ttl)
            remaining_attempts = max_attempts - data["attempts"]
            return False, f"Invalid OTP ({remaining_attempts} attempts left)"

        await self._cache.delete(key)
        return True, "ok"

    async def invalidate_otp(self, identifier: str) -> None:
        await self._cache.delete(f"otp:{identifier}")

    async def otp_exists(self, identifier: str) -> bool:
        try:
            return await self._cache.client.exists(f"otp:{identifier}") > 0
        except Exception:
            return False


_base_url = _base_redis_url(settings.REDIS_URL)
redis_manager = RedisManager(_base_url)

cache_sessions  = RedisCache(redis_manager, settings.REDIS_DB_SESSIONS)
cache_otp       = RedisCache(redis_manager, settings.REDIS_DB_OTP)
cache_products  = RedisCache(redis_manager, settings.REDIS_DB_PRODUCTS)
cache_wishlist  = RedisCache(redis_manager, settings.REDIS_DB_PRODUCTS)
cache_search    = RedisCache(redis_manager, settings.REDIS_DB_SEARCH)
cache_cart      = RedisCache(redis_manager, settings.REDIS_DB_CART)
cache_orders    = RedisCache(redis_manager, settings.REDIS_DB_ORDERS)
cache_settings  = RedisCache(redis_manager, settings.REDIS_DB_SETTINGS)
cache_reviews   = RedisCache(redis_manager, settings.REDIS_DB_REVIEWS)
cache_ratelimit = RedisCache(redis_manager, settings.REDIS_DB_RATELIMIT)
cache_email     = RedisCache(redis_manager, settings.REDIS_DB_EMAIL)
cache_pincode   = RedisCache(redis_manager, settings.REDIS_DB_PINCODE)

session_store = RedisSessionStore(cache_sessions)
otp_store     = OtpStore(cache_otp)

REDIS_DBS = [
    settings.REDIS_DB_SESSIONS,
    settings.REDIS_DB_OTP,
    settings.REDIS_DB_PRODUCTS,
    settings.REDIS_DB_SEARCH,
    settings.REDIS_DB_CART,
    settings.REDIS_DB_ORDERS,
    settings.REDIS_DB_SETTINGS,
    settings.REDIS_DB_REVIEWS,
    settings.REDIS_DB_RATELIMIT,
    settings.REDIS_DB_EMAIL,
    settings.REDIS_DB_PINCODE,
]