"""Workflow domain constants and the built-in template."""

DEFAULT_WORKFLOW_CODE = "episode-production"
DEFAULT_NODE_MAX_ATTEMPTS = 3
DEFAULT_LEASE_SECONDS = 90
RETRY_BASE_SECONDS = 5
MAX_BACKOFF_SECONDS = 300

DISPATCH_TOPIC = "workflow.run.dispatch"

# A minimal, real production chain: script -> shot list -> key art.
DEFAULT_TEMPLATE: dict = {
    "nodes": [
        {
            "key": "script_draft",
            "type": "generation",
            "depends_on": [],
            "payload": {
                "capability": "text_generation",
                "prompt": "Draft the episode script from the project brief.",
                "model_code": "mock-text-1",
                "provider_code": "mock",
            },
        },
        {
            "key": "shot_breakdown",
            "type": "generation",
            "depends_on": ["script_draft"],
            "payload": {
                "capability": "text_generation",
                "prompt": "Break the approved script into a shot list.",
                "model_code": "mock-text-1",
                "provider_code": "mock",
            },
        },
        {
            "key": "key_art",
            "type": "generation",
            "depends_on": ["shot_breakdown"],
            "payload": {
                "capability": "image_generation",
                "prompt": "Key art for the episode, vertical poster composition.",
                "model_code": "mock-image-1",
                "provider_code": "mock",
                "parameters": {"width": 1024, "height": 1536},
            },
        },
    ]
}
