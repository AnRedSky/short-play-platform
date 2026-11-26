import uuid


def _create(client, admin, **brief):
    body = {
        "code": f"dto-{uuid.uuid4().hex[:6]}",
        "name": "雾城来信",
        "summary": "一句话设定",
        "genre": "悬疑 / 都市",
        "audience": "18–30 岁都市女性",
        "episodes": 24,
        "duration": "90 秒 / 集",
        "ratio": "9:16 · 1080×1920",
        "language": "普通话",
        "style": "冷灰低饱和",
        "constraints": "禁止血腥正面镜头",
        "budget": 18000,
    }
    body.update(brief)
    response = client.post("/api/v1/projects", headers=admin["headers"], json=body)
    assert response.status_code == 201, response.text
    return response.json()["data"]


def test_project_dto_exposes_business_id_and_brief_fields(client, admin):
    project = _create(client, admin)
    assert project["id"].startswith("dto-")
    assert uuid.UUID(project["record_id"])
    assert project["name"] == "雾城来信"
    assert project["genre"] == "悬疑 / 都市"
    assert project["episodes"] == 24
    assert project["budget"] == 18000
    assert project["owner"] == "Admin"
    assert project["ownerId"]
    assert project["phase"] == "创意策划"
    assert project["budgetState"] == "正常"
    assert len(project["created"]) == 10
    assert len(project["updated"]) == 16

    detail = client.get(
        f"/api/v1/projects/{project['record_id']}", headers=admin["headers"]
    )
    assert detail.status_code == 200
    assert detail.json()["data"]["id"] == project["id"]
    assert detail.json()["data"]["owner"] == project["owner"]

    listed = client.get("/api/v1/projects?limit=100", headers=admin["headers"])
    row = next(item for item in listed.json()["data"] if item["id"] == project["id"])
    assert row["genre"] == "悬疑 / 都市"
    assert row["created"] == project["created"]


def test_patch_persists_brief_fields_and_uses_page_names(client, admin):
    project = _create(client, admin, genre="喜剧")
    patch = client.patch(
        f"/api/v1/projects/{project['record_id']}",
        headers=admin["headers"],
        json={
            "name": "改名后的项目",
            "genre": "悬疑",
            "audience": "25–40 岁",
            "episodes": 30,
            "duration": "120 秒 / 集",
            "ratio": "16:9",
            "language": "粤语",
            "style": "高饱和",
            "constraints": "不得出现真实品牌",
            "budget": 25000,
            "summary": "更新后的设定",
        },
    )
    assert patch.status_code == 200, patch.text
    data = patch.json()["data"]
    assert data["name"] == "改名后的项目"
    assert data["genre"] == "悬疑"
    assert data["audience"] == "25–40 岁"
    assert data["episodes"] == 30
    assert data["duration"] == "120 秒 / 集"
    assert data["ratio"] == "16:9"
    assert data["language"] == "粤语"
    assert data["style"] == "高饱和"
    assert data["constraints"] == "不得出现真实品牌"
    assert data["budget"] == 25000
    assert data["summary"] == "更新后的设定"

    reread = client.get(
        f"/api/v1/projects/{project['record_id']}", headers=admin["headers"]
    ).json()["data"]
    assert reread["genre"] == "悬疑"
    assert reread["constraints"] == "不得出现真实品牌"


def test_patch_rejects_unknown_fields_instead_of_silently_dropping(client, admin):
    project = _create(client, admin)
    response = client.patch(
        f"/api/v1/projects/{project['record_id']}",
        headers=admin["headers"],
        json={"genre": "悬疑", "unexpected": "value"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"

