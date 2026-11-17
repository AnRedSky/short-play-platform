import hashlib
import json

from apps.api.providers.base import (
    Capability,
    GenerationRequest,
    GenerationResult,
    ProviderError,
    ProviderHealth,
)

SUPPORTED = frozenset(
    {
        Capability.TEXT_GENERATION,
        Capability.IMAGE_GENERATION,
        Capability.VIDEO_GENERATION,
        Capability.TTS,
    }
)


class MockProvider:
    """Deterministic provider used by CI and local development."""

    code = "mock"
    capabilities = SUPPORTED

    def __init__(self, *, fail_capabilities: set[Capability] | None = None) -> None:
        self._fail = fail_capabilities or set()

    def health(self) -> ProviderHealth:
        return ProviderHealth(code=self.code, healthy=True, detail="deterministic mock")

    def generate(self, request: GenerationRequest) -> GenerationResult:
        if request.capability not in self.capabilities:
            return GenerationResult(
                status="failed",
                error=ProviderError.invalid_request(
                    f"mock provider does not support '{request.capability}'"
                ),
            )
        if request.capability in self._fail:
            return GenerationResult(status="failed", error=ProviderError.unavailable())
        if not request.prompt.strip():
            return GenerationResult(status="failed", error=ProviderError.invalid_request())

        digest = hashlib.sha256(
            json.dumps(
                {
                    "capability": request.capability,
                    "prompt": request.prompt,
                    "model": request.model_code,
                    "parameters": request.parameters,
                },
                sort_keys=True,
            ).encode("utf-8")
        ).hexdigest()
        return GenerationResult(
            status="succeeded",
            output=self._build_output(request, digest),
            usage={"unit": "call", "quantity": 1, "source": "mock"},
            provider_task_id=f"mock-{digest[:16]}",
        )

    def _build_output(self, request: GenerationRequest, digest: str) -> dict:
        key = f"mock/{request.capability}/{digest[:24]}"
        if request.capability is Capability.TEXT_GENERATION:
            return {
                "kind": "text",
                "text": (f"[mock:{request.model_code}] {request.prompt.strip()[:400]}"),
                "checksum": digest,
            }
        if request.capability is Capability.IMAGE_GENERATION:
            return {
                "kind": "image",
                "storage_key": f"{key}.png",
                "mime_type": "image/png",
                "width": int(request.parameters.get("width", 1024)),
                "height": int(request.parameters.get("height", 576)),
                "checksum": digest,
                "placeholder": True,
            }
        if request.capability is Capability.VIDEO_GENERATION:
            return {
                "kind": "video",
                "storage_key": f"{key}.mp4",
                "mime_type": "video/mp4",
                "duration_seconds": int(request.parameters.get("duration_seconds", 5)),
                "checksum": digest,
                "placeholder": True,
            }
        return {
            "kind": "audio",
            "storage_key": f"{key}.wav",
            "mime_type": "audio/wav",
            "duration_seconds": int(request.parameters.get("duration_seconds", 10)),
            "checksum": digest,
            "placeholder": True,
        }


class FailingProvider(MockProvider):
    """Adapter used by tests and drills to exercise the error contract."""

    code = "mock-failing"

    def __init__(self) -> None:
        super().__init__(fail_capabilities=set(SUPPORTED))
