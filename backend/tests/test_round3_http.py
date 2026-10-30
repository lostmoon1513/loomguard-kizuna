"""Round 3 HTTP layer: sign-in, roles and the full review journey through the real app (rules only, no AI)."""
from fastapi.testclient import TestClient

from app.main import app
from app.services import drafts_store

drafts_store.PERSIST = False
PW = "loomguard-demo"
TEXT = "Aurora is best-in-class. Used by 10,000 teams. We utilize AI."


def login(client, who):
    r = client.post("/api/auth/login", json={"email": f"{who}@loomguard.demo", "password": PW})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["token"]}


def test_auth_required_and_error_shape():
    with TestClient(app) as c:
        for method, path in (("get", "/api/drafts"), ("get", "/api/insights"), ("get", "/api/brand"), ("get", "/api/auth/me")):
            r = getattr(c, method)(path)
            assert r.status_code == 401 and r.json()["error"]["code"] == "UNAUTHENTICATED"
        r = c.post("/api/auth/login", json={"email": "creator@loomguard.demo", "password": "wrong"})
        assert r.status_code == 401 and r.json()["error"]["code"] == "INVALID_CREDENTIALS"
        assert c.get("/api/auth/me", headers={"X-Role": "manager"}).status_code == 401  # headers alone are not enough


def test_roles_are_enforced_by_the_server():
    with TestClient(app) as c:
        creator, reviewer = login(c, "creator"), login(c, "reviewer")
        assert c.post("/api/brand/load-demo", headers=creator).json()["error"]["code"] == "FORBIDDEN_ROLE"
        assert c.get("/api/insights", headers=creator).status_code == 403
        assert c.get("/api/insights", headers=reviewer).status_code == 200
        assert c.post("/api/drafts", data={"text": TEXT, "use_ai": "false"}, headers=reviewer).status_code == 403
        assert c.get("/api/debug/demo-drafts", headers=creator).status_code == 403


def test_full_journey_with_versions_diff_waiver_and_audit():
    with TestClient(app) as c:
        creator, creator2, manager = login(c, "creator"), login(c, "creator2"), login(c, "manager")
        assert c.post("/api/brand/load-demo", headers=manager).status_code == 200
        d = c.post("/api/drafts", data={"text": TEXT, "use_ai": "false"}, headers=creator).json()
        did = d["id"]
        assert c.get(f"/api/drafts/{did}", headers=creator2).status_code == 404   # not yours
        assert c.get(f"/api/drafts/{did}", headers=manager).status_code == 404    # still private
        fixable = next(i for i in d["issues"] if i["suggested_fixes"] and i["category"] == "CLAIM")
        r = c.patch(f"/api/drafts/{did}/issues/{fixable['id']}", headers=creator,
                    json={"action": "accept", "chosen_fix": fixable["suggested_fixes"][0], "revision": d["revision"]})
        assert r.status_code == 200 and len(r.json()["versions"]) == 2
        again = c.patch(f"/api/drafts/{did}/issues/{fixable['id']}", headers=creator,
                        json={"action": "accept", "chosen_fix": fixable["suggested_fixes"][0], "revision": d["revision"]})
        assert again.status_code == 409                                              # double click
        d = r.json()
        for i in d["issues"]:
            if i["priority"] == "mandatory" and i["status"] == "open":
                assert c.patch(f"/api/drafts/{did}/issues/{i['id']}", headers=creator,
                               json={"action": "request_exception", "note": "approved by legal"}).status_code == 200
        assert c.post(f"/api/drafts/{did}/submit", headers=creator).json()["status"] == "IN_REVIEW"
        assert c.post(f"/api/drafts/{did}/decision", headers=creator, json={"decision": "approve"}).status_code == 403
        assert c.post(f"/api/drafts/{did}/decision", headers=manager, json={"decision": "approve"}).json()["error"]["code"] == "PENDING_EXCEPTIONS"
        diff = c.get(f"/api/drafts/{did}/diff?from=1&to=2", headers=manager).json()
        assert diff["stats"]["removed_words"] >= 1 and any(o["op"] == "insert" for o in diff["ops"])
        for i in c.get(f"/api/drafts/{did}", headers=manager).json()["issues"]:
            if i["status"] == "exception_requested":
                r = c.post(f"/api/drafts/{did}/issues/{i['id']}/waiver", headers=manager,
                           json={"decision": "grant", "reason": "Approved by legal in writing"})
                assert r.status_code == 200
        assert c.post(f"/api/drafts/{did}/decision", headers=manager, json={"decision": "approve"}).json()["status"] == "APPROVED"
        types = [e["type"] for e in c.get(f"/api/drafts/{did}/audit", headers=manager).json()]
        assert "waiver_granted" in types and types[-1] == "decision"
        assert c.get("/api/audit", headers=manager).status_code == 200


def _png(colour="#FF8800"):
    import io

    from PIL import Image
    b = io.BytesIO()
    Image.new("RGB", (400, 200), colour).save(b, "PNG")
    return b.getvalue()


def test_image_upload_flow_over_http():
    with TestClient(app) as c:
        creator, manager = login(c, "creator"), login(c, "manager")
        c.post("/api/brand/load-demo", headers=manager)
        bad = c.post("/api/drafts/image", files={"file": ("a.png", b"not an image", "image/png")}, data={"use_ai": "false"}, headers=creator)
        assert bad.status_code == 400 and bad.json()["error"]["code"] == "UNSUPPORTED_IMAGE"
        r = c.post("/api/drafts/image", files={"file": ("banner.png", _png(), "image/png")}, data={"use_ai": "false"}, headers=creator)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["kind"] == "image" and any(i["category"] == "COLOUR" and i["region"] for i in d["issues"])
        img = c.get(f"/api/drafts/{d['id']}/image?annotate=true", headers=creator)
        assert img.status_code == 200 and img.headers["content-type"] == "image/png"
        assert c.get(f"/api/drafts/{d['id']}/image", headers=login(c, "creator2")).status_code == 404
        rev = c.post(f"/api/drafts/{d['id']}/revisions", files={"file": ("b2.png", _png("#1F4FD8"), "image/png")}, headers=creator)
        assert rev.status_code == 200 and len(rev.json()["versions"]) == 2


def test_insights_over_time_and_exports():
    drafts_store.DRAFTS.clear()
    with TestClient(app) as c:
        manager, creator = login(c, "manager"), login(c, "creator")
        assert c.get("/api/insights/trends", headers=creator).status_code == 403
        assert c.post("/api/demo/history", headers=creator).status_code == 403
        assert c.post("/api/demo/history", headers=manager).json()["added"] == 14
        assert c.post("/api/demo/history", headers=manager).status_code == 409
        t = c.get("/api/insights/trends?weeks=6", headers=manager).json()
        assert t["includes_demo_data"] is True and len(t["weekly"]) == 6 and t["recommendations"]
        assert c.get("/api/insights/trends?include_demo=false", headers=manager).json()["drafts"] == 0
        csv_r = c.get("/api/insights/export.csv?table=rules", headers=manager)
        assert csv_r.status_code == 200 and csv_r.headers["content-type"].startswith("text/csv")
        pdf = c.get("/api/insights/report.pdf", headers=manager)
        assert pdf.status_code == 200 and pdf.content[:5] == b"%PDF-"
        
        assert c.delete("/api/demo/history", headers=manager).json()["removed"] == 14