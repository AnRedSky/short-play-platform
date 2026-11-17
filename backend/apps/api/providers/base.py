"""Provider contracts: the only surface a business module may depend on."""

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Protocol


class Capability(StrEnum):
    TEXT_GENERATION = "text_generation"
    IMAGE_GENERATION = "image_generation"
    VIDEO_GENERATION = "video_generation"
    TTS = "tts"
    ASR = "asr"
    MUSIC_GENERATION = "music_generation"


RETRYABLE_PROVIDER_ERRORS = frozenset(
    {"PROVIDER_UNAVAILABLE", "PROVIDER_TIMEOUT", "PROVIDER_RATE_LIMITED"}
)


@dataclass(frozen=True)
class ProviderError:
    code: str
    message: str
    retryable: bool = False

    @classmethod
    def unavailable(cls, message: str = "Provider is unavailable") -> "ProviderError":
        return cls("PROVIDER_UNAVAILABLE", message, retryable=True)

    @classmethod
    def timeout(cls, message: str = "Provider timed out") -> "ProviderError":
        return cls("PROVIDER_TIMEOUT", message, retryable=True)

    @classmethod
    def invalid_request(cls, message: str = "Provider rejected the request") -> "ProviderError":
        return cls("VALIDATION_ERROR", message, retryable=False)


@dataclass(frozen=True)
class GenerationRequest:
    capability: Capability
    prompt: str
    model_code: str = "mock-default"
    parameters: dict[str, Any] = field(default_factory=dict)
    input_assets: list[dict[str, Any]] = field(default_factory=list)


@dataclass(frozen=True)
class GenerationResult:
    status: str
    output: dict[str, Any] = field(default_factory=dict)
    usage: dict[str, Any] = field(default_factory=dict)
    provider_task_id: str | None = None
    error: ProviderError | None = None

    @property
    def succeeded(self) -> bool:
        return self.status == "succeeded" and self.error is None


@dataclass(frozen=True)
class ProviderHealth:
    code: str
    healthy: bool
    detail: str = ""


class ProviderAdapter(Protocol):
    """Adapters translate protocols only; they never touch business state."""

    code: str
    capabilities: frozenset[Capability]

    def health(self) -> ProviderHealth: ...

    def generate(self, request: GenerationRequest) -> GenerationResult: ...
