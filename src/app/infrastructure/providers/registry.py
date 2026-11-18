from functools import lru_cache

from app.infrastructure.providers.base import Capability, ProviderAdapter, ProviderHealth
from app.infrastructure.providers.mock import FailingProvider, MockProvider
from app.public.exceptions import validation_error


class ProviderRegistry:
    def __init__(self) -> None:
        self._adapters: dict[str, ProviderAdapter] = {}

    def register(self, adapter: ProviderAdapter) -> None:
        self._adapters[adapter.code] = adapter

    def get(self, code: str) -> ProviderAdapter:
        adapter = self._adapters.get(code)
        if adapter is None:
            raise validation_error(f"Unknown provider '{code}'")
        return adapter

    def candidates(self, capability: Capability) -> list[ProviderAdapter]:
        return [
            adapter for adapter in self._adapters.values() if capability in adapter.capabilities
        ]

    def health(self) -> list[ProviderHealth]:
        return [
            ProviderHealth(code=adapter.code, healthy=adapter.health().healthy)
            for adapter in self._adapters.values()
        ]


def build_registry() -> ProviderRegistry:
    """Build a fresh registry (used by tests and by explicit dependency injection)."""
    registry = ProviderRegistry()
    registry.register(MockProvider())
    registry.register(FailingProvider())
    return registry


@lru_cache
def get_registry() -> ProviderRegistry:
    """Process-wide registry dependency for routers and workers."""
    return build_registry()
