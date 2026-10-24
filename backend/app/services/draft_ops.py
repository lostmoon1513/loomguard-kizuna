"""Draft workflow logic. Pure async functions so they are easy to test without a web server."""
import uuid
from typing import Optional

from . import drafts_store
from .parsing import ParseError
from .runner import run_checks, summarize

EDITABLE = ("DRAFT", "CHANGES_REQUESTED")


class OpError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def _get(draft_id: str) -> dict:
    d = drafts_store.DRAFTS.get(draft_id)
    if not d:
        raise OpError(404, "DRAFT_NOT_FOUND", f"No draft with id {draft_id}.")
    return d


def get_draft(draft_id: str) -> dict:
    return _get(draft_id)


def _apply_result(d: dict, r: dict, kit) -> None:
    d["issues"], d["checks"], d["ai_available"] = r["issues"], r["checks"], r["ai_available"]
    d["summary"] = summarize(r["issues"])
    d["kit_version"] = kit.version


async def create_draft(text: str, kit, title: str = "", author: str = "creator", use_ai: bool = True) -> dict:
    if kit.version == 0:
        raise OpError(409, "NO_KIT", "Upload a brand kit (or load the demo kit) before checking drafts.")
    text = text.replace("\r\n", "\n").strip()
    if len(text) < 3:
        raise ParseError("EMPTY_DRAFT", "The draft is empty.")
    if len(text) > 50000:
        raise ParseError("DRAFT_TOO_LONG", "Drafts are limited to 50,000 characters.")
    r = await run_checks(text, kit, use_ai)
    d = {
        "id": "dr_" + uuid.uuid4().hex[:6], "title": title.strip() or text[:40].replace("\n", " "),
        "author": author, "status": "DRAFT", "text": text, "original_text": text, "use_ai": use_ai,
        "resolved": [], "comments": [], "decisions": [], "created_at": drafts_store.now(),
    }
    _apply_result(d, r, kit)
    drafts_store.save(d)
    return d


async def recheck(d: dict, kit) -> dict:
    """Re-run all checks on the current text. Exception requests carry over to matching issues."""
    keep = {(i["category"], i["quote"].lower()): i for i in d["issues"] if i["status"] == "exception_requested"}
    r = await run_checks(d["text"], kit, d.get("use_ai", True))
    for i in r["issues"]:
        old = keep.get((i["category"], i["quote"].lower()))
        if old:
            i["status"], i["exception_note"] = "exception_requested", old.get("exception_note")
    _apply_result(d, r, kit)
    drafts_store.save(d)
    return d


async def act_on_issue(draft_id: str, issue_id: str, action: str, kit, chosen_fix: Optional[str] = None,
                       new_text: Optional[str] = None, note: Optional[str] = None) -> dict:
    d = _get(draft_id)
    if d["status"] not in EDITABLE:
        raise OpError(409, "NOT_EDITABLE", f"Draft is {d['status']}. Only DRAFT or CHANGES_REQUESTED drafts can be changed.")
    issue = next((i for i in d["issues"] if i["id"] == issue_id), None)
    if not issue:
        raise OpError(404, "ISSUE_NOT_FOUND", f"No issue {issue_id} on this draft.")
    s, e = issue["start"], issue["end"]
    if d["text"][s:e] != issue["quote"]:
        raise OpError(409, "STALE_ISSUE", "The text changed. Re-check the draft first.")

    if action == "request_exception":
        if not note or len(note.strip()) < 3:
            raise OpError(422, "NOTE_REQUIRED", "Explain why this should be allowed (a short note is required).")
        issue["status"], issue["exception_note"] = "exception_requested", note.strip()
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

    d["text"] = d["text"][:s] + replacement + d["text"][e:]
    d["resolved"].append({**issue, "status": status, "replacement": replacement})
    return await recheck(d, kit)


def submit(draft_id: str) -> dict:
    d = _get(draft_id)
    if d["status"] not in EDITABLE:
        raise OpError(409, "NOT_EDITABLE", f"Draft is already {d['status']}.")
    blocking = [i["id"] for i in d["issues"] if i["status"] == "open" and i["priority"] == "mandatory"]
    if blocking:
        raise OpError(409, "OPEN_MANDATORY_ISSUES",
                      f"Resolve or request an exception for these mandatory issues first: {', '.join(blocking)}.")
    d["status"] = "IN_REVIEW"
    drafts_store.save(d)
    return d


def add_comment(draft_id: str, author: str, role: str, text: str, issue_id: Optional[str] = None) -> dict:
    d = _get(draft_id)
    if not text.strip():
        raise OpError(422, "EMPTY_COMMENT", "Comment is empty.")
    d["comments"].append({"id": f"c_{len(d['comments']) + 1}", "author": author, "role": role,
                          "text": text.strip(), "issue_id": issue_id, "created_at": drafts_store.now()})
    drafts_store.save(d)
    return d


def decide(draft_id: str, role: str, author: str, decision: str, comment: str = "") -> dict:
    if role != "manager":
        raise OpError(403, "MANAGER_ONLY", "Only a manager can approve or request changes.")
    d = _get(draft_id)
    if d["status"] != "IN_REVIEW":
        raise OpError(409, "NOT_IN_REVIEW", f"Draft is {d['status']}, not IN_REVIEW.")
    if decision == "approve":
        d["status"] = "APPROVED"
    elif decision == "request_changes":
        if not comment.strip():
            raise OpError(422, "COMMENT_REQUIRED", "Say what needs to change.")
        d["status"] = "CHANGES_REQUESTED"
    else:
        raise OpError(422, "BAD_DECISION", "decision must be approve or request_changes.")
    d["decisions"].append({"manager": author, "decision": decision, "comment": comment.strip(), "created_at": drafts_store.now()})
    if comment.strip():
        d["comments"].append({"id": f"c_{len(d['comments']) + 1}", "author": author, "role": role,
                              "text": comment.strip(), "issue_id": None, "created_at": drafts_store.now()})
    drafts_store.save(d)
    return d


def list_drafts(status: Optional[str] = None) -> list[dict]:
    rows = []
    for d in sorted(drafts_store.DRAFTS.values(), key=lambda x: x["updated_at"], reverse=True):
        if status and d["status"] != status:
            continue
        rows.append({"id": d["id"], "title": d["title"], "author": d.get("author"), "status": d["status"],
                     "open_issues": sum(1 for i in d["issues"] if i["status"] == "open"),
                     "total_issues": d["summary"]["total"], "updated_at": d["updated_at"]})
    return rows


def insights() -> dict:
    by_cat, by_claim, by_source, rules = {}, {}, {}, {}
    exceptions = 0
    status_counts: dict[str, int] = {}
    for d in drafts_store.DRAFTS.values():
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
            if i["status"] == "exception_requested":
                r["exceptions_requested"] += 1
                exceptions += 1
    top = sorted(rules.values(), key=lambda r: (-r["count"], r["rule"]))[:8]
    unclear = [r for r in rules.values() if r["exceptions_requested"] >= 2]
    return {"drafts": sum(status_counts.values()), "drafts_by_status": status_counts, "by_category": by_cat,
            "by_claim_status": by_claim, "by_source": by_source, "exceptions_requested": exceptions,
            "top_rules": top, "potentially_unclear_rules": unclear}