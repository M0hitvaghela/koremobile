from urllib.parse import urlparse, urlunparse

from fastapi import HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.redis import cache_ratelimit


def _ratelimit_redis_url() -> str:
	parsed = urlparse(settings.REDIS_URL)
	if parsed.scheme in ("redis", "rediss"):
		path = f"/{settings.REDIS_DB_RATELIMIT}"
		parsed = parsed._replace(path=path, params="", query="", fragment="")
		return urlunparse(parsed)
	return settings.REDIS_URL

# Central limiter instance to avoid circular imports with app.main
limiter = Limiter(key_func=get_remote_address, storage_uri=_ratelimit_redis_url())


async def enforce_rate_limit(
	request: Request,
	scope: str,
	limit: int,
	window_seconds: int,
) -> None:
	ip = get_remote_address(request) or "unknown"
	key = f"rl:{scope}:{ip}"
	count = await cache_ratelimit.client.incr(key)
	if count == 1:
		await cache_ratelimit.client.expire(key, window_seconds)
	if count > limit:
		ttl = await cache_ratelimit.client.ttl(key)
		retry = ttl if ttl and ttl > 0 else window_seconds
		raise HTTPException(status_code=429, detail=f"Rate limit exceeded. Try again in {retry}s.")
