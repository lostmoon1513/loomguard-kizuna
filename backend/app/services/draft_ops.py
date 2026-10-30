"""Draft workflow logic. Pure async functions so they are easy to test without a web server.

Round 3 additions: versions, word diff, audit log, waivers, revisions, per-draft locks,
permission helpers. Every function still works without a signed-in user (tests, scripts).
"""
import asyncio
import uuid
from typing import Optional

from . import drafts_store, image_store
from .diffing import diff_words
from .parsing import ParseError
from .runner import run_checks, summarize

EDITABLE = ("DRAFT", "CHANGES_REQUESTED")
HANDLED = ("exception_requested", "waived")  # not blocking submit


class OpError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


# ------------------------------------------------------------------ helpers
_LOCKS: dict[str, asyncio.Lock] = {}


def _lock(draft_id: str) -> asyncio.Lock:
    return _LOCKS.setdefault(draft_id, asyncio.Lock())


def _get(draft_id: str) -> dict:
    d = drafts_store.DRAFTS.get(draft_id)
    if not d:
        raise OpError(404, "DRAFT_NOT_FOUND", f"No draft with id {draft_id}.")
    return d


def get_draft(draft_id: str) -> dict:
    return _get(draft_id)


def _actor(actor: Optional[dict], d: Optional[dict] = None) -> dict:
    if actor:
        return {"id": actor.get("id"), "name": actor.get("name", "unknown"), "role": actor.get("role", "creator")}
    return {"id": None, "name": (d or {}).get("author", "system"), "role": "creator"}


def audit(d: dict, actor: Optional[dict], type_: str, detail: str = "") -> None:
    """Append-only trail of everything that changes a draft."""
    a = _actor(actor, d)
    d.setdefault("audit", []).append({"at": drafts_store.now(), "actor": a["name"], "role": a["role"],
                                      "type": type_, "detail": detail[:300]})


def _counts(d: dict) -> dict:
    return {"total": len(d["issues"]),
            "open_mandatory": sum(1 for i in d["issues"] if i["status"] == "open" and i["priority"] == "mandatory")}


def _add_version(d: dict, actor: Optional[dict], note: str) -> None:
    a = _actor(actor, d)
    versions = d.setdefault("versions", [])
    versions.append({"n": len(versions) + 1, "text": d["text"], "author": a["name"], "role": a["role"],
                     "at": drafts_store.now(), "note": note[:200], "counts": _counts(d)})


def _apply_result(d: dict, r: dict, kit) -> None:
    d["issues"], d["checks"], d["ai_available"] = r["issues"], r["checks"], r["ai_available"]
    d["summary"] = summarize(r["issues"])
    d["kit_version"] = kit.version
    d["mask_summary"] = r.get("mask_summary")
    d["revision"] = d.get("revision", 0) + 1  # ids are renumbered on every check, so clients must send this back


def _note_masking(d: dict, before: Optional[dict], actor: Optional[dict]) -> None:
    """One audit line when masking happened or changed (not on every re-check)."""
    now = d.get("mask_summary") or {}
    if now.get("count") and now.get("count") != (before or {}).get("count"):
        kinds = ", ".join(f"{n} {k}" for k, n in now["by_kind"].items())
        audit(d, actor, "masked", f"{now['count']} confidential value(s) masked before AI checks ({kinds})")


_TRANS = str.maketrans({"\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"', "\u00a0": " ", "\u2009": " ",
                        "\u202f": " ", "\u2011": "-", "\u200b": None, "\u200c": None, "\u200d": None, "\ufeff": None,
                        "\u2060": None})


def _clean_text(text: str) -> str:
    """Normalise look-alike characters (curly quotes, non-breaking spaces, zero-width characters) before checking,
    so 'best-in-class' with a hidden character, or a claim in curly quotes, cannot slip past the rules.
    Offsets are computed on this cleaned text, which is what is stored and shown."""
    text = (text or "").translate(_TRANS).replace("\r\n", "\n").replace("\r", "\n").strip()
    if len(text) < 3:
        raise ParseError("EMPTY_DRAFT", "The draft is empty.")
    if len(text) > 50000:
        raise ParseError("DRAFT_TOO_LONG", "Drafts are limited to 50,000 characters.")
    return text


def _short(s: str, n: int = 40) -> str:
    s = s.replace("\n", " ")
    return s if len(s) <= n else s[: n - 1] + "…"


# ------------------------------------------------------------------ permissions
def can_view(user: dict, d: dict) -> bool:
    """Creators see their own drafts. Managers and reviewers see everything that has been submitted."""
    if d.get("owner_id") and d["owner_id"] == user["id"]:
        return True
    if user["role"] in ("manager", "reviewer"):
        return d["status"] != "DRAFT"
    return False


def load_for(user: dict, draft_id: str, *, owner: bool = False, roles: tuple = ()) -> dict:
    """Fetch a draft the user may see. Unknown and not-yours both give 404 so ids do not leak."""
    d = drafts_store.DRAFTS.get(draft_id)
    if not d or not can_view(user, d):
        raise OpError(404, "DRAFT_NOT_FOUND", f"No draft with id {draft_id}.")
    if owner and d.get("owner_id") != user["id"]:
        raise OpError(403, "FORBIDDEN_ROLE", "Only the person who created this draft can do that.")
    if roles and user["role"] not in roles:
        raise OpError(403, "FORBIDDEN_ROLE", f"This needs one of these roles: {', '.join(roles)}.")
    return d


# ------------------------------------------------------------------ create / check
async def create_draft(text: str, kit, title: str = "", author: str = "creator", use_ai: bool = True,
                       owner_id: Optional[str] = None) -> dict:
    if kit.version == 0:
        raise OpError(409, "NO_KIT", "Upload a brand kit (or load the demo kit) before checking drafts.")
    text = _clean_text(text)
    r = await run_checks(text, kit, use_ai)
    actor = {"id": owner_id, "name": author, "role": "creator"}
    d = {
        "id": "dr_" + uuid.uuid4().hex[:6], "title": title.strip() or text[:40].replace("\n", " "),
        "kind": "text", "author": author, "owner_id": owner_id, "status": "DRAFT", "text": text, "original_text": text,
        "use_ai": use_ai, "resolved": [], "comments": [], "decisions": [], "versions": [], "audit": [],
        "revision": 0, "created_at": drafts_store.now(),
    }
    _apply_result(d, r, kit)
    audit(d, actor, "created", f"'{d['title']}' created")
    audit(d, actor, "checked", f"{len(d['issues'])} issues found")
    _note_masking(d, None, actor)
    _add_version(d, actor, "First version")
    drafts_store.save(d)
    return d


def _image_text(info: dict) -> str:
    """Stand-in 'text' for an image draft so versions and the diff keep working."""
    return f"[image {info['filename']} {info['width']}x{info['height']} sha256:{info['sha256'][:12]}]"


async def create_image_draft(data: bytes, filename: str, kit, title: str = "", author: str = "creator",
                             use_ai: bool = True, owner_id: Optional[str] = None) -> dict:
    from . import image_check

    if kit.version == 0:
        raise OpError(409, "NO_KIT", "Upload a brand kit (or load the demo kit) before checking drafts.")
    img, png, info = await asyncio.to_thread(image_check.load_image, data, filename)
    r = await image_check.run_image_checks(png, info, kit, use_ai)
    actor = {"id": owner_id, "name": author, "role": "creator"}
    d = {
        "id": "dr_" + uuid.uuid4().hex[:6], "title": title.strip() or filename or "Image",
        "kind": "image", "author": author, "owner_id": owner_id, "status": "DRAFT", "text": _image_text(info),
        "original_text": "", "image": info, "palette": r["palette"], "elements": r["elements"],
        "use_ai": use_ai, "resolved": [], "comments": [], "decisions": [], "versions": [], "audit": [],
        "revision": 0, "created_at": drafts_store.now(),
    }
    _apply_result(d, r, kit)
    audit(d, actor, "created", f"image '{d['title']}' uploaded ({info['width']}x{info['height']})")
    audit(d, actor, "checked", f"{len(d['issues'])} issues found")
    _add_version(d, actor, "First version")
    image_store.put(d["id"], 1, png)
    drafts_store.save(d)
    return d


async def add_image_revision(draft_id: str, data: bytes, filename: str, kit, actor: Optional[dict] = None,
                             note: str = "New image uploaded") -> dict:
    from . import image_check

    async with _lock(draft_id):
        d = _get(draft_id)
        if d.get("kind") != "image":
            raise OpError(409, "NOT_AN_IMAGE_DRAFT", "This draft is text. Send text, not an image.")
        if d["status"] not in EDITABLE:
            raise OpError(409, "NOT_EDITABLE", f"Draft is {d['status']}. Only DRAFT or CHANGES_REQUESTED drafts can be changed.")
        if kit.version == 0:
            raise OpError(409, "NO_KIT", "Upload a brand kit (or load the demo kit) before checking drafts.")
        img, png, info = await asyncio.to_thread(image_check.load_image, data, filename)
        if info["sha256"] == d["image"]["sha256"]:
            raise OpError(409, "NO_CHANGE", "This image is identical to the current version.")
        old = d["issues"]
        r = await image_check.run_image_checks(png, info, kit, d.get("use_ai", True))
        expired = _carry_over(old, r["issues"])
        d["image"], d["palette"], d["elements"], d["text"] = info, r["palette"], r["elements"], _image_text(info)
        _apply_result(d, r, kit)
        audit(d, actor, "revision_uploaded", note)
        for o in expired:
            audit(d, actor, "waiver_expired", f"Waiver on '{_short(o['quote'])}' ended because the image changed")
        audit(d, actor, "checked", f"re-checked after new image, {len(d['issues'])} issues")
        _add_version(d, actor, note)
        image_store.put(d["id"], len(d["versions"]), png)
        drafts_store.save(d)
        return d


async def image_bytes(d: dict, n: Optional[int] = None) -> Optional[bytes]:
    return await image_store.get(d["id"], n or len(d.get("versions", [])) or 1)


def _carry_over(old_issues: list[dict], new_issues: list[dict]) -> list[dict]:
    """Keep exception requests, waivers and denials on issues whose category and quote are unchanged.
    Returns the old issues that carried a waiver but no longer match (the waiver expired)."""
    keep = {(i["category"], i["quote"].lower()): i for i in old_issues
            if i["status"] in HANDLED or (i.get("waiver") or {}).get("state") == "denied"}
    for i in new_issues:
        old = keep.pop((i["category"], i["quote"].lower()), None)
        if old:
            i["status"], i["exception_note"], i["waiver"] = old["status"], old.get("exception_note"), old.get("waiver")
    return [o for o in keep.values() if o["status"] == "waived"]


async def _recheck_locked(d: dict, kit, actor: Optional[dict] = None, note: str = "") -> dict:
    old, old_mask = d["issues"], d.get("mask_summary")
    if d.get("kind") == "image":
        from . import image_check

        png = await image_store.get(d["id"], len(d.get("versions", [])) or 1)
        if png is None:
            raise OpError(409, "IMAGE_MISSING", "The stored image is gone. Upload it again as a new revision.")
        r = await image_check.run_image_checks(png, d["image"], kit, d.get("use_ai", True))
        d["palette"], d["elements"] = r["palette"], r["elements"]
    else:
        r = await run_checks(d["text"], kit, d.get("use_ai", True))
    expired = _carry_over(old, r["issues"])
    _apply_result(d, r, kit)
    _note_masking(d, old_mask, actor)
    for o in expired:
        audit(d, actor, "waiver_expired",
              f"Waiver on '{_short(o['quote'])}' ended because that text changed")
    audit(d, actor, "checked", note or f"re-checked, {len(d['issues'])} issues")
    drafts_store.save(d)
    return d


async def recheck(d: dict, kit, actor: Optional[dict] = None) -> dict:
    """Re-run all checks on the current text. Exception requests and waivers carry over to matching issues."""
    async with _lock(d["id"]):
        return await _recheck_locked(d, kit, actor)


# ------------------------------------------------------------------ issue actions
async def act_on_issue(draft_id: str, issue_id: str, action: str, kit, chosen_fix: Optional[str] = None,
                       new_text: Optional[str] = None, note: Optional[str] = None,
                       actor: Optional[dict] = None, revision: Optional[int] = None) -> dict:
    async with _lock(draft_id):
        d = _get(draft_id)
        if d["status"] not in EDITABLE:
            raise OpError(409, "NOT_EDITABLE", f"Draft is {d['status']}. Only DRAFT or CHANGES_REQUESTED drafts can be changed.")
        if revision is not None and revision != d.get("revision"):
            raise OpError(409, "STALE_REVISION", "This draft changed since you loaded it. Reload it and try again.")
        issue = next((i for i in d["issues"] if i["id"] == issue_id), None)
        if not issue:
            raise OpError(404, "ISSUE_NOT_FOUND", f"No issue {issue_id} on this draft.")
        s, e = issue["start"], issue["end"]
        is_image = d.get("kind") == "image"
        if not is_image and d["text"][s:e] != issue["quote"]:
            raise OpError(409, "STALE_ISSUE", "The text changed. Re-check the draft first.")
        if is_image and action in ("accept", "edit"):
            raise OpError(422, "FIX_BY_REUPLOAD", "Pixels cannot be edited here. Fix the image and upload it as a new revision, or request an exception.")

        if action == "request_exception":
            if issue["status"] in HANDLED:
                raise OpError(409, "ISSUE_ALREADY_HANDLED", "An exception was already requested or granted for this issue.")
            if not note or len(note.strip()) < 3:
                raise OpError(422, "NOTE_REQUIRED", "Explain why this should be allowed (a short note is required).")
            issue["status"], issue["exception_note"] = "exception_requested", note.strip()
            issue["waiver"] = None  # a new request replaces an earlier denial
            audit(d, actor, "exception_requested", f"'{_short(issue['quote'])}': {note.strip()}")
            drafts_store.save(d)
            return d

        if action == "accept":
            if chosen_fix not in issue["suggested_fixes"]:
                raise OpError(422, "FIX_NOT_ALLOWED", "chosen_fix must be one of the suggested fixes for this issue.")
            replacement, status = chosen_fix, "accepted"
        elif action == "edit":
            if not new_text or "\n" in new_text or len(new_text) > 300:
                raise OpError(422, "BAD_EDIT", "new_text must be one line, up to 300 characters.")
            replacement, status = new_text, "edited"
        else:
            raise OpError(422, "BAD_ACTION", "action must be accept, edit or request_exception.")

        before = issue["quote"]
        d["text"] = d["text"][:s] + replacement + d["text"][e:]
        d["resolved"].append({**issue, "status": status, "replacement": replacement})
        word = "accepted fix" if status == "accepted" else "edited"
        audit(d, actor, "fix_accepted" if status == "accepted" else "edited",
              f"'{_short(before)}' -> '{_short(replacement)}'")
        await _recheck_locked(d, kit, actor, f"re-checked after {word}")
        _add_version(d, actor, f"{word}: '{_short(before, 24)}' -> '{_short(replacement, 24)}'")
        drafts_store.save(d)
        return d


async def add_revision(draft_id: str, text: str, kit, actor: Optional[dict] = None,
                       note: str = "New revision uploaded") -> dict:
    """The creator replaces the whole text (for example after 'changes requested'). Re-checks, adds a version."""
    async with _lock(draft_id):
        d = _get(draft_id)
        if d["status"] not in EDITABLE:
            raise OpError(409, "NOT_EDITABLE", f"Draft is {d['status']}. Only DRAFT or CHANGES_REQUESTED drafts can be changed.")
        if kit.version == 0:
            raise OpError(409, "NO_KIT", "Upload a brand kit (or load the demo kit) before checking drafts.")
        new = _clean_text(text)
        if new == d["text"]:
            raise OpError(409, "NO_CHANGE", "The new text is identical to the current version.")
        d["text"] = new
        audit(d, actor, "revision_uploaded", note)
        await _recheck_locked(d, kit, actor, "re-checked after new revision")
        _add_version(d, actor, note)
        drafts_store.save(d)
        return d


# ------------------------------------------------------------------ waivers
def decide_waiver(draft_id: str, issue_id: str, decision: str, reason: str, actor: dict) -> dict:
    """A manager (any issue) or compliance reviewer (CLAIM issues only) grants or denies an exception request."""
    d = _get(draft_id)
    role = actor.get("role")
    if role not in ("manager", "reviewer"):
        raise OpError(403, "FORBIDDEN_ROLE", "Only a manager or compliance reviewer can decide exception requests.")
    if d["status"] != "IN_REVIEW":
        raise OpError(409, "NOT_IN_REVIEW", f"Draft is {d['status']}. Exceptions are decided while it is IN_REVIEW.")
    issue = next((i for i in d["issues"] if i["id"] == issue_id), None)
    if not issue:
        raise OpError(404, "ISSUE_NOT_FOUND", f"No issue {issue_id} on this draft.")
    if role == "reviewer" and issue["category"] != "CLAIM":
        raise OpError(403, "FORBIDDEN_ROLE", "A compliance reviewer can decide exceptions on claims only. Ask a manager.")
    if issue["status"] != "exception_requested":
        raise OpError(409, "ISSUE_ALREADY_HANDLED", "This issue has no pending exception request.")
    if decision not in ("grant", "deny"):
        raise OpError(422, "BAD_DECISION", "decision must be grant or deny.")
    if not reason or len(reason.strip()) < 3:
        raise OpError(422, "REASON_REQUIRED", "A short reason is required and is kept in the audit log.")
    state = "granted" if decision == "grant" else "denied"
    issue["waiver"] = {"state": state, "by": actor["name"], "role": role, "at": drafts_store.now(), "reason": reason.strip()}
    issue["status"] = "waived" if decision == "grant" else "open"
    audit(d, actor, "waiver_granted" if decision == "grant" else "waiver_denied",
          f"'{_short(issue['quote'])}' ({issue['category']}): {reason.strip()}")
    d["revision"] = d.get("revision", 0) + 1
    drafts_store.save(d)
    return d


# ------------------------------------------------------------------ workflow
def submit(draft_id: str, actor: Optional[dict] = None) -> dict:
    d = _get(draft_id)
    if d["status"] not in EDITABLE:
        raise OpError(409, "NOT_EDITABLE", f"Draft is already {d['status']}.")
    blocking = [i["id"] for i in d["issues"] if i["status"] == "open" and i["priority"] == "mandatory"]
    if blocking:
        raise OpError(409, "OPEN_MANDATORY_ISSUES",
                      f"Resolve or request an exception for these mandatory issues first: {', '.join(blocking)}.")
    d["status"] = "IN_REVIEW"
    audit(d, actor, "submitted", "sent for review")
    drafts_store.save(d)
    return d


def add_comment(draft_id: str, author: str, role: str, text: str, issue_id: Optional[str] = None,
                parent_id: Optional[str] = None) -> dict:
    d = _get(draft_id)
    if not text.strip():
        raise OpError(422, "EMPTY_COMMENT", "Comment is empty.")
    if parent_id and not any(c["id"] == parent_id for c in d["comments"]):
        raise OpError(404, "COMMENT_NOT_FOUND", f"No comment {parent_id} to reply to.")
    d["comments"].append({"id": f"c_{len(d['comments']) + 1}", "author": author, "role": role, "text": text.strip(),
                          "issue_id": issue_id, "parent_id": parent_id,
                          "version": len(d.get("versions", [])) or None, "created_at": drafts_store.now()})
    audit(d, {"name": author, "role": role}, "comment", _short(text.strip(), 80))
    drafts_store.save(d)
    return d


def decide(draft_id: str, role: str, author: str, decision: str, comment: str = "") -> dict:
    if role != "manager":
        raise OpError(403, "MANAGER_ONLY", "Only a manager can approve or request changes.")
    d = _get(draft_id)
    if d["status"] != "IN_REVIEW":
        raise OpError(409, "NOT_IN_REVIEW", f"Draft is {d['status']}, not IN_REVIEW.")
    if decision == "approve":
        pending = [i["id"] for i in d["issues"] if i["status"] == "exception_requested"]
        if pending:
            raise OpError(409, "PENDING_EXCEPTIONS",
                          f"Decide these exception requests first (grant or deny): {', '.join(pending)}.")
        blocking = [i["id"] for i in d["issues"] if i["status"] == "open" and i["priority"] == "mandatory"]
        if blocking:
            raise OpError(409, "OPEN_MANDATORY_ISSUES",
                          f"Mandatory issues are still open ({', '.join(blocking)}). Request changes instead of approving.")
        d["status"] = "APPROVED"
    elif decision == "request_changes":
        if not comment.strip():
            raise OpError(422, "COMMENT_REQUIRED", "Say what needs to change.")
        d["status"] = "CHANGES_REQUESTED"
    else:
        raise OpError(422, "BAD_DECISION", "decision must be approve or request_changes.")
    d["decisions"].append({"manager": author, "decision": decision, "comment": comment.strip(), "created_at": drafts_store.now()})
    audit(d, {"name": author, "role": role}, "decision", f"{decision}" + (f": {_short(comment.strip(), 80)}" if comment.strip() else ""))
    if comment.strip():
        d["comments"].append({"id": f"c_{len(d['comments']) + 1}", "author": author, "role": role, "text": comment.strip(),
                              "issue_id": None, "parent_id": None, "version": len(d.get("versions", [])) or None,
                              "created_at": drafts_store.now()})
    drafts_store.save(d)
    return d


# ------------------------------------------------------------------ versions and audit views
def list_versions(d: dict) -> list[dict]:
    return [{k: v for k, v in ver.items() if k != "text"} | {"chars": len(ver["text"])} for ver in d.get("versions", [])]


def get_version(d: dict, n: int) -> dict:
    ver = next((v for v in d.get("versions", []) if v["n"] == n), None)
    if not ver:
        raise OpError(404, "VERSION_NOT_FOUND", f"This draft has no version {n}.")
    return ver


def diff_versions(d: dict, a: int, b: int) -> dict:
    va, vb = get_version(d, a), get_version(d, b)
    return {"from": a, "to": b, **diff_words(va["text"], vb["text"])}


def global_audit(user: dict, limit: int = 100) -> list[dict]:
    rows = []
    for d in drafts_store.DRAFTS.values():
        if not can_view(user, d) or d.get("demo"):
            continue
        for e in d.get("audit", []):
            rows.append({**e, "draft_id": d["id"], "draft_title": d["title"]})
    rows.sort(key=lambda r: r["at"], reverse=True)
    return rows[:limit]


# ------------------------------------------------------------------ lists and insights
def list_drafts(status: Optional[str] = None, user: Optional[dict] = None) -> list[dict]:
    rows = []
    for d in sorted(drafts_store.DRAFTS.values(), key=lambda x: x["updated_at"], reverse=True):
        if user is not None and not can_view(user, d):
            continue
        if status and d["status"] != status:
            continue
        rows.append({"id": d["id"], "title": d["title"], "kind": d.get("kind", "text"), "author": d.get("author"),
                     "status": d["status"],
                     "open_issues": sum(1 for i in d["issues"] if i["status"] == "open"),
                     "pending_exceptions": sum(1 for i in d["issues"] if i["status"] == "exception_requested"),
                     "total_issues": d["summary"]["total"], "versions": len(d.get("versions", [])),
                     "updated_at": d["updated_at"]})
    return rows


def visible_drafts(user: Optional[dict]) -> list[dict]:
    return [d for d in drafts_store.DRAFTS.values() if user is None or d.get("demo") or can_view(user, d)]


def insights(user: Optional[dict] = None) -> dict:
    by_cat, by_claim, by_source, rules = {}, {}, {}, {}
    exceptions = 0
    status_counts: dict[str, int] = {}
    for d in visible_drafts(user):
        if d.get("demo"):
            continue  # sample history only appears in /api/insights/trends, labelled
        status_counts[d["status"]] = status_counts.get(d["status"], 0) + 1
        for i in d["issues"] + d["resolved"]:
            by_cat[i["category"]] = by_cat.get(i["category"], 0) + 1
            if i.get("claim_status"):
                by_claim[i["claim_status"]] = by_claim.get(i["claim_status"], 0) + 1
            by_source[i["source"]] = by_source.get(i["source"], 0) + 1
            cit = i.get("citation") or {}
            label = f"{i['category']}: {i['quote'].lower()}" if i["category"] == "TERMINOLOGY" else \
                f"{i['category']}: {cit.get('doc', 'no source')} {cit.get('ref', '')}".strip()
            r = rules.setdefault(label, {"rule": label, "count": 0, "exceptions_requested": 0})
            r["count"] += 1
            if i["status"] in ("exception_requested", "waived") or (i.get("waiver") or {}).get("state") == "denied":
                r["exceptions_requested"] += 1
                exceptions += 1
    top = sorted(rules.values(), key=lambda r: (-r["count"], r["rule"]))[:8]
    unclear = [r for r in rules.values() if r["exceptions_requested"] >= 2]
    return {"drafts": sum(status_counts.values()), "drafts_by_status": status_counts, "by_category": by_cat,
            "by_claim_status": by_claim, "by_source": by_source, "exceptions_requested": exceptions,
            "top_rules": top, "potentially_unclear_rules": unclear}