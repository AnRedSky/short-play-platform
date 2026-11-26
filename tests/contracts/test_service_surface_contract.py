"""B-14: the real API surface used by the frontend service layer.

The frontend contract test exercises both branches against the same response
shape. This test guards the other half of the contract: the routes that the
`real` branch targets must actually be registered by the FastAPI app.
"""

from app.main import app

SUPPORTED_SERVICE_ROUTES = {
    "projects.list": ("get", "/api/v1/projects"),
    "projects.create": ("post", "/api/v1/projects"),
    "projects.update": ("patch", "/api/v1/projects/{project_id}"),
    "projects.transition": ("post", "/api/v1/projects/{project_id}/transitions"),
    "quality.run": ("post", "/api/v1/projects/{project_id}/quality/runs"),
    "quality.reports": ("get", "/api/v1/quality-reports"),
    "quality.issues": ("get", "/api/v1/quality-issues"),
    "quality.levels": ("get", "/api/v1/quality-levels"),
    "video.tasks": ("get", "/api/v1/projects/{project_id}/generation/tasks"),
    "video.createTask": ("post", "/api/v1/projects/{project_id}/generation/tasks"),
    "video.attempts": ("get", "/api/v1/generation/tasks/{task_id}"),
    "video.retry": ("post", "/api/v1/generation/tasks/{task_id}/retry"),
    "video.cancel": ("post", "/api/v1/generation/tasks/{task_id}/cancel"),
    "video.updateTask": ("post", "/api/v1/generation/queue/dispatch"),
    "workspace.costSummary": ("get", "/api/v1/costs/summary"),
    "workspace.notifications": ("get", "/api/v1/notifications"),
    "orgs.users": ("get", "/api/v1/users"),
    "post.deliveries": ("get", "/api/v1/deliveries"),
    "notifications.read": ("post", "/api/v1/notifications/{notification_id}/read"),
    "notifications.readAll": ("post", "/api/v1/notifications/read-all"),
    "audit.list": ("get", "/api/v1/audit-logs"),
    "ops.health": ("get", "/api/v1/ops/health"),
    "ops.overview": ("get", "/api/v1/ops/overview"),
    "ops.queues": ("get", "/api/v1/ops/queues"),
    "ops.logs": ("get", "/api/v1/ops/logs"),
    "ops.backups.list": ("get", "/api/v1/ops/backups"),
    "ops.backups.create": ("post", "/api/v1/ops/backups"),
}


def test_service_real_branch_routes_are_registered():
    paths = app.openapi()["paths"]
    missing = []
    for service, (method, path) in SUPPORTED_SERVICE_ROUTES.items():
        operation = paths.get(path, {}).get(method)
        if operation is None:
            missing.append(f"{service}: {method.upper()} {path}")
            continue
        responses = operation.get("responses", {})
        if not any(code in responses for code in ("200", "201", "202", "204")):
            missing.append(f"{service}: {method.upper()} {path} has no success response")
    assert not missing, "frontend service targets missing from real API:\n" + "\n".join(missing)
