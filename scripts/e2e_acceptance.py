#!/usr/bin/env python3
"""End-to-end acceptance against a running private deployment.

Covers the real delivered surface: readiness, bootstrap/login, project creation,
a mock AI generation task, a persistent workflow run finished by Celery workers,
asset upload, FFmpeg export, MP4 download, audit trail and unauthenticated denial.

Exit code 0 means every step above really happened; any failure exits non-zero.
"""

import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid

PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def call(base, method, path, *, token=None, payload=None, raw=None, content_type=None):
    url = base.rstrip("/") + path
    headers = {"Accept": "application/json"}
    data = None
    if payload is not None:
        data = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    elif raw is not None:
        data = raw
        headers["Content-Type"] = content_type or "application/octet-stream"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read()
            if response.headers.get("content-type", "").startswith("application/json"):
                return response.status, json.loads(body)
            return response.status, body
    except urllib.error.HTTPError as error:
        body = error.read()
        try:
            return error.code, json.loads(body)
        except json.JSONDecodeError:
            return error.code, body


def multipart(fields, filename, content, mime="image/png"):
    boundary = "----e2e" + uuid.uuid4().hex
    lines = []
    for name, value in fields.items():
        lines.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n")
    lines.append(
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
        f"Content-Type: {mime}\r\n\r\n"
    )
    body = "".join(lines).encode() + content + f"\r\n--{boundary}--\r\n".encode()
    return body, f"multipart/form-data; boundary={boundary}"


def step(name, condition, detail=""):
    if condition:
        print(f"[ok] {name}")
        return
    print(f"[fail] {name} {detail}", file=sys.stderr)
    raise SystemExit(1)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--base-url",
        default=f"http://localhost:{os.environ.get('API_PORT', '8000')}",
        help="API root; defaults to API_PORT from the environment (8000).",
    )
    parser.add_argument("--timeout", type=int, default=240)
    args = parser.parse_args()
    base = args.base_url.rstrip("/") + "/api/v1"

    unique = uuid.uuid4().hex[:8]
    email = f"e2e-{unique}@example.com"
    password = "AcceptancePassword1"

    status, body = call(base, "GET", "/health/ready")
    step("readiness reports postgres and redis healthy", status == 200 and body["components"] == {"postgresql": "ok", "redis": "ok"}, str(body))

    status, body = call(
        base,
        "POST",
        "/auth/bootstrap",
        payload={
            "email": email,
            "password": password,
            "full_name": "Acceptance Admin",
            "organization_name": f"Acceptance Studio {unique}",
        },
    )
    step("bootstrap creates the first administrator", status == 200 and body["data"]["email"] == email, str(body))

    status, body = call(base, "POST", "/auth/login", payload={"email": email, "password": password})
    step("login issues an access token", status == 200 and "access_token" in body["data"], str(body))
    token = body["data"]["access_token"]

    status, body = call(base, "GET", "/auth/me", token=token)
    data = body.get("data") or {}
    step(
        "authenticated identity resolves with permissions",
        status == 200 and data.get("user", {}).get("email") == email and data.get("permissions"),
        str(body),
    )

    status, body = call(base, "POST", "/projects", token=token, payload={"code": f"e2e-{unique}", "title": "Acceptance Project"})
    step("project creation succeeds", status == 201, str(body))
    project_id = body["data"]["id"]

    status, body = call(
        base,
        "POST",
        f"/projects/{project_id}/generation/tasks",
        token=token,
        payload={"capability": "text_generation", "prompt": "Acceptance run logline.", "provider_code": "mock", "model_code": "mock-text-1"},
    )
    step("mock generation produces a succeeded task", status == 201 and body["data"]["status"] == "succeeded", str(body))

    status, body = call(base, "POST", f"/projects/{project_id}/workflow-runs", token=token, payload={})
    step("workflow run starts", status == 201, str(body))
    run_id = body["data"]["id"]
    deadline = time.time() + args.timeout
    run = body["data"]
    while time.time() < deadline:
        status, body = call(base, "GET", f"/workflow-runs/{run_id}", token=token)
        run = body["data"]
        if run["status"] in ("succeeded", "failed", "cancelled"):
            break
        time.sleep(5)
    step(
        "workflow run is executed by the celery worker to success",
        run["status"] == "succeeded",
        f"status={run['status']} error={run.get('error_code')}",
    )

    body_bytes, boundary = multipart({"title": "acceptance-frame"}, "frame.png", PNG_1X1)
    status, body = call(
        base,
        "POST",
        f"/projects/{project_id}/assets",
        token=token,
        raw=body_bytes,
        content_type=boundary,
    )
    step("asset upload stores metadata and file", status == 201 and body["data"]["kind"] == "image", str(body))
    asset_id = body["data"]["id"]

    status, body = call(
        base,
        "POST",
        f"/projects/{project_id}/exports",
        token=token,
        payload={"asset_ids": [asset_id], "width": 640, "height": 360, "fps": 25, "seconds_per_image": 1.0, "title": "Acceptance export"},
    )
    step("ffmpeg export job succeeds", status == 201 and body["data"]["job"]["status"] == "succeeded", str(body))
    video = body["data"]["asset"]
    step("exported asset is a verified mp4", video["mime_type"] == "video/mp4" and video["size_bytes"] > 0, str(video))

    status, content = call(base, "GET", f"/assets/{video['id']}/download", token=token)
    step("exported mp4 downloads with a real container header", status == 200 and b"ftyp" in content[:16], f"status={status} head={content[:16]!r}")

    status, body = call(base, "GET", "/audit-logs?page_size=50", token=token)
    step("audit trail records the acceptance activity", status == 200 and body["meta"]["total"] > 0, str(body.get("meta")))

    status, body = call(base, "POST", "/projects", payload={"code": "unauth", "title": "should fail"})
    step("unauthenticated project write is rejected", status == 401, str(body))

    print("E2E acceptance passed: readiness, auth, project, generation, workflow, asset, export, audit, denial")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
