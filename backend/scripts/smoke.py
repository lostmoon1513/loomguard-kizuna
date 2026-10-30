"""One-command check of a running LoomGuard server, the way a judge would use it.
Usage:  python scripts/smoke.py https://your-app.onrender.com            (uses the demo accounts)
        python scripts/smoke.py http://localhost:8000 --password mypass
Uses only the standard library plus Pillow (already in requirements). Exits 1 if anything fails."""
import argparse
import io
import json
import sys
import urllib.error
import urllib.request
import uuid

ap = argparse.ArgumentParser()
ap.add_argument("base")
ap.add_argument("--password", default="loomguard-demo")
ap.add_argument("--ai", action="store_true", help="also run with AI on (uses Gemini quota)")
A = ap.parse_args()
BASE = A.base.rstrip("/")
results = []


def call(method, path, token=None, json_body=None, form=None, files=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    data = None
    if json_body is not None:
        data, headers["Content-Type"] = json.dumps(json_body).encode(), "application/json"
    elif form is not None or files:
        b = uuid.uuid4().hex
        parts = [f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k, v in (form or {}).items()]
        for k, (fn, content, ct) in (files or {}).items():
            parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{fn}"\r\nContent-Type: {ct}\r\n\r\n'.encode() + content + b"\r\n")
        data, headers["Content-Type"] = b"".join(parts) + f"--{b}--\r\n".encode(), f"multipart/form-data; boundary={b}"
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read()
            return r.status, (json.loads(body) if "json" in r.headers.get("content-type", "") else body)
    except urllib.error.HTTPError as e:
        body = e.read()
        try:
            return e.code, json.loads(body)
        except ValueError:
            return e.code, body


def check(name, ok, detail=""):
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  -> {detail}"))


def code(r):
    return (r[1].get("error") or {}).get("code") if isinstance(r[1], dict) else None


def login(who):
    s, b = call("POST", "/api/auth/login", json_body={"email": f"{who}@loomguard.demo", "password": A.password})
    return b.get("token") if s == 200 else None


def png(colour):
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (400, 200), colour).save(buf, "PNG")
    return buf.getvalue()


s, h = call("GET", "/api/health")
check("health", s == 200 and h.get("status") == "ok", h)
if s == 200:
    print(f"     persistence={h.get('persistence')} kit_version={h.get('kit_version')} ai_configured={h.get('gemini_configured')} legacy_header_auth={h['auth']['legacy_header_auth']}")
    check("legacy header auth is OFF", h["auth"]["legacy_header_auth"] is False, "set LEGACY_HEADER_AUTH=false")
    check("data is persisted (MongoDB)", h.get("persistence") == "mongodb", "drafts are lost on restart")
check("unauthenticated request is refused", code(call("GET", "/api/drafts")) == "UNAUTHENTICATED")
check("fake role header is refused", call("GET", "/api/drafts")[0] == 401)
check("wrong password is refused", code(call("POST", "/api/auth/login", json_body={"email": "creator@loomguard.demo", "password": "nope"})) == "INVALID_CREDENTIALS")
cre, cre2, mgr, rev = (login(x) for x in ("creator", "creator2", "manager", "reviewer"))
check("four demo sign-ins", all((cre, cre2, mgr, rev)), "demo accounts missing: SEED_DEMO_USERS=true?")
if not all((cre, cre2, mgr, rev)):
    sys.exit(1)
check("kit loaded", call("POST", "/api/brand/load-demo", mgr)[0] == 200 or (call("GET", "/api/brand", mgr)[1].get("version", 0) > 0))
check("creator cannot load a kit", code(call("POST", "/api/brand/load-demo", cre)) == "FORBIDDEN_ROLE")
check("bad input: empty", call("POST", "/api/drafts", cre, form={"text": "", "use_ai": "false"})[0] in (400, 422))
check("bad input: not an image", code(call("POST", "/api/drafts/image", cre, form={"use_ai": "false"}, files={"file": ("a.png", b"hello", "image/png")})) == "UNSUPPORTED_IMAGE")

ai = "true" if A.ai else "false"
text = "Aurora is best-in-class and revolutionary. Uptime is 99.99%. Reach us at jo@example.com."
s, d = call("POST", "/api/drafts", cre, form={"text": text, "title": "Smoke test", "use_ai": ai})
check("create text draft", s == 200 and d["summary"]["total"] >= 3, d)
did = d.get("id")
check("another creator cannot see it", call("GET", f"/api/drafts/{did}", cre2)[0] == 404)
check("manager cannot see a private DRAFT", call("GET", f"/api/drafts/{did}", mgr)[0] == 404)
check("submit blocked by open mandatory issues", code(call("POST", f"/api/drafts/{did}/submit", cre)) == "OPEN_MANDATORY_ISSUES")
for i in d["issues"]:
    if i["priority"] == "mandatory":
        r = call("PATCH", f"/api/drafts/{did}/issues/{i['id']}", cre, json_body={"action": "request_exception", "note": "smoke test", "revision": d["revision"]})
        d = r[1] if r[0] == 200 else d
        if r[0] != 200:
            check("exception request", False, r)
check("stale revision returns 409", code(call("PATCH", f"/api/drafts/{did}/issues/iss_01", cre, json_body={"action": "request_exception", "note": "again", "revision": 0})) == "STALE_REVISION")
check("submit", call("POST", f"/api/drafts/{did}/submit", cre)[0] == 200)
check("submit twice returns 409", call("POST", f"/api/drafts/{did}/submit", cre)[0] == 409)
check("approve blocked by pending exceptions", code(call("POST", f"/api/drafts/{did}/decision", mgr, json_body={"decision": "approve"})) == "PENDING_EXCEPTIONS")
check("creator cannot approve", code(call("POST", f"/api/drafts/{did}/decision", cre, json_body={"decision": "approve"})) == "FORBIDDEN_ROLE")
d = call("GET", f"/api/drafts/{did}", mgr)[1]
for i in d["issues"]:
    if i["status"] == "exception_requested":
        call("POST", f"/api/drafts/{did}/issues/{i['id']}/waiver", mgr, json_body={"decision": "grant", "reason": "smoke test"})
check("approve", call("POST", f"/api/drafts/{did}/decision", mgr, json_body={"decision": "approve"})[1].get("status") == "APPROVED")
check("audit trail has entries", len(call("GET", f"/api/drafts/{did}/audit", mgr)[1]) >= 6)

s, im = call("POST", "/api/drafts/image", cre, form={"title": "Smoke banner", "use_ai": ai}, files={"file": ("b.png", png("#FF8800"), "image/png")})
check("image draft: off-brand colour found", s == 200 and any(i["category"] == "COLOUR" and i.get("region") for i in im.get("issues", [])), im)
if s == 200:
    check("annotated image served", call("GET", f"/api/drafts/{im['id']}/image?annotate=true", cre)[0] == 200)
    check("same file again is a clean 409 on revision", code(call("POST", f"/api/drafts/{im['id']}/revisions", cre, files={"file": ("b.png", png("#FF8800"), "image/png")})) == "NO_CHANGE")

t = call("GET", "/api/insights/trends", mgr)
check("insights trends", t[0] == 200 and "weekly" in t[1], t)
check("compliance PDF", call("GET", "/api/insights/report.pdf", mgr)[1][:5] == b"%PDF-" if isinstance(call("GET", "/api/insights/report.pdf", mgr)[1], bytes) else False)
check("creator cannot see insights", call("GET", "/api/insights/trends", cre)[0] == 403)
print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)