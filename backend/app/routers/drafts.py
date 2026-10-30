from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from pydantic import BaseModel, Field

from ..config import settings
from ..deps import current_user, require_roles
from ..services import draft_ops, drafts_store, insights as insights_svc, store
from ..services.draft_ops import OpError
from ..services.parsing import ParseError, parse_draft_file

router = APIRouter(prefix="/api", tags=["drafts"])


def _raise(exc: OpError):
    raise HTTPException(exc.status, f"{exc.code}: {exc.message}") from exc


def _view(d: dict) -> dict:
    """What the API returns: no original_text, and versions without their full text (use /versions/{n} for that)."""
    out = {k: v for k, v in d.items() if k not in ("original_text", "versions")}
    out["versions"] = draft_ops.list_versions(d)
    return out


async def _read_input(file: Optional[UploadFile], text: Optional[str]) -> tuple[str, str]:
    """Returns (body, filename). Raises HTTPException for missing or oversized input."""
    if file is not None and file.filename:
        data = await file.read()
        if len(data) > settings.max_upload_mb * 1024 * 1024:
            raise HTTPException(413, f"FILE_TOO_LARGE: limit is {settings.max_upload_mb} MB.")
        return parse_draft_file(file.filename, data), file.filename
    if text:
        return text, ""
    raise HTTPException(400, "NO_INPUT: send a file or text.")


# ------------------------------------------------------------------ create / read
@router.post("/drafts")
async def create_draft(file: Optional[UploadFile] = File(None), text: Optional[str] = Form(None),
                       title: str = Form(""), use_ai: bool = Form(True),
                       user: dict = Depends(require_roles("creator", "manager"))):
    """Upload a file (.md .txt .docx text-PDF) or send pasted text, and get the checked draft back."""
    try:
        body, fname = await _read_input(file, text)
        d = await draft_ops.create_draft(body, store.KIT, title or fname, user["name"], use_ai, owner_id=user["id"])
    except ParseError as exc:
        raise HTTPException(400, f"{exc.code}: {exc.message}") from exc
    except OpError as exc:
        _raise(exc)
    return _view(d)


@router.post("/drafts/image")
async def create_image_draft(file: UploadFile = File(...), title: str = Form(""), use_ai: bool = Form(True),
                             user: dict = Depends(require_roles("creator", "manager"))):
    """Upload a PNG or JPG banner. Colours, WCAG contrast and logo placement are checked; findings carry a `region`."""
    data = await file.read()
    try:
        d = await draft_ops.create_image_draft(data, file.filename or "image", store.KIT, title, user["name"], use_ai,
                                               owner_id=user["id"])
    except ParseError as exc:
        raise HTTPException(400, f"{exc.code}: {exc.message}") from exc
    except OpError as exc:
        _raise(exc)
    return _view(d)


@router.get("/drafts/{draft_id}/image")
async def draft_image(draft_id: str, version: Optional[int] = Query(None, ge=1), annotate: bool = False,
                      user: dict = Depends(current_user)):
    """The checked image (PNG). annotate=true draws every finding on it as a numbered box (iss_03 -> 3)."""
    try:
        d = draft_ops.load_for(user, draft_id)
        if d.get("kind") != "image":
            raise OpError(404, "NOT_AN_IMAGE_DRAFT", "This draft has no image.")
        png = await draft_ops.image_bytes(d, version)
    except OpError as exc:
        _raise(exc)
    if png is None:
        raise HTTPException(404, "IMAGE_MISSING: the stored image is gone. Upload it again as a new revision.")
    if annotate:
        from ..services import image_check

        png = image_check.annotate(png, d["issues"])
    return Response(content=png, media_type="image/png", headers={"Cache-Control": "no-store"})


@router.get("/drafts")
async def list_drafts(status: Optional[str] = None, user: dict = Depends(current_user)):
    return draft_ops.list_drafts(status, user)


@router.get("/drafts/{draft_id}")
async def get_draft(draft_id: str, user: dict = Depends(current_user)):
    try:
        return _view(draft_ops.load_for(user, draft_id))
    except OpError as exc:
        _raise(exc)


# ------------------------------------------------------------------ creator actions (owner only)
class IssueAction(BaseModel):
    action: Literal["accept", "edit", "request_exception"]
    chosen_fix: Optional[str] = None
    new_text: Optional[str] = None
    note: Optional[str] = None
    revision: Optional[int] = None  # send the draft's `revision` you last saw; a stale value returns 409 STALE_REVISION


@router.patch("/drafts/{draft_id}/issues/{issue_id}")
async def act(draft_id: str, issue_id: str, body: IssueAction, user: dict = Depends(current_user)):
    try:
        draft_ops.load_for(user, draft_id, owner=True)
        d = await draft_ops.act_on_issue(draft_id, issue_id, body.action, store.KIT, body.chosen_fix, body.new_text,
                                         body.note, actor=user, revision=body.revision)
    except OpError as exc:
        _raise(exc)
    return _view(d)


@router.post("/drafts/{draft_id}/recheck")
async def recheck(draft_id: str, user: dict = Depends(current_user)):
    try:
        d = draft_ops.load_for(user, draft_id, owner=True)
        return _view(await draft_ops.recheck(d, store.KIT, user))
    except OpError as exc:
        _raise(exc)


@router.post("/drafts/{draft_id}/revisions")
async def add_revision(draft_id: str, file: Optional[UploadFile] = File(None), text: Optional[str] = Form(None),
                       note: str = Form("New revision uploaded"), user: dict = Depends(current_user)):
    """Replace the whole text (for example after 'changes requested'). Adds a version and re-checks."""
    try:
        cur = draft_ops.load_for(user, draft_id, owner=True)
        if cur.get("kind") == "image":
            if file is None or not file.filename:
                raise HTTPException(400, "NO_INPUT: send a PNG or JPG file.")
            d = await draft_ops.add_image_revision(draft_id, await file.read(), file.filename, store.KIT, user,
                                                   note.strip()[:200] or "New image uploaded")
            return _view(d)
        body, _ = await _read_input(file, text)
        d = await draft_ops.add_revision(draft_id, body, store.KIT, user, note.strip()[:200] or "New revision uploaded")
    except ParseError as exc:
        raise HTTPException(400, f"{exc.code}: {exc.message}") from exc
    except OpError as exc:
        _raise(exc)
    return _view(d)


@router.post("/drafts/{draft_id}/submit")
async def submit(draft_id: str, user: dict = Depends(current_user)):
    try:
        draft_ops.load_for(user, draft_id, owner=True)
        d = draft_ops.submit(draft_id, user)
    except OpError as exc:
        _raise(exc)
    return {"id": d["id"], "status": d["status"]}


# ------------------------------------------------------------------ versions, diff, audit
@router.get("/drafts/{draft_id}/versions")
async def versions(draft_id: str, user: dict = Depends(current_user)):
    try:
        return draft_ops.list_versions(draft_ops.load_for(user, draft_id))
    except OpError as exc:
        _raise(exc)


@router.get("/drafts/{draft_id}/versions/{n}")
async def version(draft_id: str, n: int, user: dict = Depends(current_user)):
    try:
        return draft_ops.get_version(draft_ops.load_for(user, draft_id), n)
    except OpError as exc:
        _raise(exc)


@router.get("/drafts/{draft_id}/diff")
async def diff(draft_id: str, from_: int = Query(alias="from", ge=1), to: int = Query(ge=1),
               user: dict = Depends(current_user)):
    """Word-level diff: ops are equal / insert / delete. Example: /diff?from=1&to=3"""
    try:
        return draft_ops.diff_versions(draft_ops.load_for(user, draft_id), from_, to)
    except OpError as exc:
        _raise(exc)


@router.get("/drafts/{draft_id}/audit")
async def draft_audit(draft_id: str, user: dict = Depends(current_user)):
    try:
        return draft_ops.load_for(user, draft_id).get("audit", [])
    except OpError as exc:
        _raise(exc)


@router.get("/audit")
async def global_audit(limit: int = Query(100, ge=1, le=500), user: dict = Depends(require_roles("manager"))):
    return draft_ops.global_audit(user, limit)


# ------------------------------------------------------------------ review
class WaiverIn(BaseModel):
    decision: Literal["grant", "deny"]
    reason: str = Field(min_length=3, max_length=500)


@router.post("/drafts/{draft_id}/issues/{issue_id}/waiver")
async def waiver(draft_id: str, issue_id: str, body: WaiverIn,
                 user: dict = Depends(require_roles("manager", "reviewer"))):
    """Grant or deny an exception request. Managers: any issue. Compliance reviewers: CLAIM issues only."""
    try:
        draft_ops.load_for(user, draft_id)
        return _view(draft_ops.decide_waiver(draft_id, issue_id, body.decision, body.reason, user))
    except OpError as exc:
        _raise(exc)


class CommentIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    issue_id: Optional[str] = None
    parent_id: Optional[str] = None  # reply to another comment


@router.post("/drafts/{draft_id}/comments")
async def comment(draft_id: str, body: CommentIn, user: dict = Depends(current_user)):
    try:
        draft_ops.load_for(user, draft_id)
        return _view(draft_ops.add_comment(draft_id, user["name"], user["role"], body.text, body.issue_id, body.parent_id))
    except OpError as exc:
        _raise(exc)


class DecisionIn(BaseModel):
    decision: Literal["approve", "request_changes"]
    comment: str = ""


@router.post("/drafts/{draft_id}/decision")
async def decision(draft_id: str, body: DecisionIn, user: dict = Depends(require_roles("manager"))):
    try:
        draft_ops.load_for(user, draft_id)
        d = draft_ops.decide(draft_id, user["role"], user["name"], body.decision, body.comment)
    except OpError as exc:
        _raise(exc)
    return {"id": d["id"], "status": d["status"]}


@router.get("/insights")
async def insights(user: dict = Depends(require_roles("manager", "reviewer"))):
    return draft_ops.insights(user)


@router.get("/insights/trends")
async def insight_trends(weeks: int = Query(8, ge=2, le=26), include_demo: bool = True,
                         user: dict = Depends(require_roles("manager", "reviewer"))):
    """Weekly series, per-rule patterns with trend, and written recommendations with their evidence."""
    return insights_svc.build(draft_ops.visible_drafts(user), weeks, include_demo=include_demo)


@router.get("/insights/export.csv")
async def insight_csv(table: Literal["weekly", "rules", "recommendations"] = "weekly", weeks: int = Query(8, ge=2, le=26),
                      include_demo: bool = True, user: dict = Depends(require_roles("manager", "reviewer"))):
    data = insights_svc.build(draft_ops.visible_drafts(user), weeks, include_demo=include_demo)
    return Response(insights_svc.to_csv(data, table), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="loomguard-{table}.csv"'})


@router.get("/insights/report.pdf")
async def insight_pdf(weeks: int = Query(8, ge=2, le=26), include_demo: bool = True,
                      user: dict = Depends(require_roles("manager", "reviewer"))):
    """Downloadable compliance summary: findings, exceptions and decisions over time, with recommendations."""
    data = insights_svc.build(draft_ops.visible_drafts(user), weeks, include_demo=include_demo)
    return Response(insights_svc.to_pdf(data, f"{user['name']} ({user['role']})"), media_type="application/pdf",
                    headers={"Content-Disposition": 'attachment; filename="loomguard-compliance-summary.pdf"'})


@router.post("/demo/history")
async def add_demo_history(user: dict = Depends(require_roles("manager"))):
    """Adds clearly labelled [DEMO] drafts so the trend screen has something to show. Removable."""
    if any(d.get("demo") for d in drafts_store.DRAFTS.values()):
        raise HTTPException(409, "DEMO_HISTORY_EXISTS: demo history is already loaded. Remove it first.")
    return {"added": insights_svc.seed_demo_history()}


@router.delete("/demo/history")
async def remove_demo_history(user: dict = Depends(require_roles("manager"))):
    return {"removed": insights_svc.clear_demo_history()}


@router.get("/demo/drafts")
async def demo_drafts():
    from ..services.demo import demo_drafts as load

    return load()