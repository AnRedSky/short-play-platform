from apps.api.errors import AppError
from apps.api.providers.base import Capability, ProviderAdapter, ProviderHealth
from apps.api.providers.mock import FailingProvider, MockProvider


class ProviderRegistry:
    def __init__(self) -> None:
        self._adapters: dict[str, ProviderAdapter] = {}

    def register(self, adapter: ProviderAdapter) -> None:
        self._adapters[adapter.code] = adapter

    def get(self, code: str) -> ProviderAdapter:
        adapter = self._adapters.get(code)
        if adapter is None:
            raise AppError(f"Unknown provider '{code}'", code="VALIDATION_ERROR", status_code=422)
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
    registry = ProviderRegistry()
    registry.register(MockProvider())
    registry.register(FailingProvider())
    return registry
