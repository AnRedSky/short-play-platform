"""Outbound HTTP client shared by adapters that call external services."""

from functools import lru_cache

import httpx

from app.config.settings import get_settings


@lru_cache
def get_http_client() -> httpx.Client:
    settings = get_settings()
    return httpx.Client(timeout=httpx.Timeout(30.0), headers={"user-agent": settings.app_name})


def close_http_client() -> None:
    client = get_http_client()
    client.close()
    get_http_client.cache_clear()
