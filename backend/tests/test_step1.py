"""Step 1 + 3 checks: API boots, health works, error shape, mock matches schema."""
import json
from pathlib import Path

import pytest

from app.schemas import Draft

MOCK = Path(__file__).resolve().parent.parent / "mocks" / "draft_response.json"


def test_mock_matches_schema():
    Draft.model_validate(json.loads(MOCK.read_text(encoding="utf-8")))


def test_mock_covers_all_categories_and_claim_statuses():
    d = Draft.model_validate(json.loads(MOCK.read_text(encoding="utf-8")))
    assert {i.category for i in d.issues} == {"TERMINOLOGY", "TONE", "CLAIM"}
    assert {i.claim_status for i in d.issues if i.claim_status} == {"UNSUPPORTED", "CONTRADICTED", "OUTDATED"}


def test_bad_offsets_rejected():
    data = json.loads(MOCK.read_text(encoding="utf-8"))
    data["issues"][0]["start"] += 1
    with pytest.raises(ValueError):
        Draft.model_validate(data)


def test_health_endpoint():
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as client:
        r = client.get("/api/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert "database" in body


def test_error_shape():
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as client:
        r = client.get("/api/does-not-exist")
        assert r.status_code == 404
        assert set(r.json()["error"]) == {"code", "message"}


def test_mock_endpoint():
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as client:
        r = client.get("/api/mock/draft")
        assert r.status_code == 200
        Draft.model_validate(r.json())
