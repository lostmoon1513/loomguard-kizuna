from typing import Literal, Optional

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field

from ..config import settings
from ..services import draft_ops, store
from ..services.draft_ops import OpError
from ..services.parsing import ParseError, parse_draft_file

router = APIRouter(prefix="/api", tags=["drafts"])


def _raise(exc: OpError):
    raise HTTPException(exc.status, f"{exc.code}: {exc.message}") from exc


def _view(d: dict) -> dict:
    return {k: v for k, v in d.items() if k not in ("original_text",)}


@router.post("/drafts")
async def create_draft(file: Optional[UploadFile] = File(None), text: Optional[str] = Form(None),
                       title: str = Form(""), author: str = Form("creator"), use_ai: bool = Form(True)):
    """Upload a file (.md .txt .docx text-PDF) or send pasted text, and get the checked draft back."""
    try:
        if file is not None and file.filename:
            data = await file.read()
            if len(data) > settings.max_upload_mb * 1024 * 1024:
                raise HTTPException(413, f"FILE_TOO_LARGE: limit is {settings.max_upload_mb} MB.")
            body = parse_draft_file(file.filename, data)
            title = title or file.filename
        elif text:
            body = text
        else:
            raise HTTPException(400, "NO_INPUT: send a file or text.")
        d = await draft_ops.create_draft(body, store.KIT, title, author, use_ai)
    except ParseError as exc:
        raise HTTPException(400, f"{exc.code}: {exc.message}") from exc
    except OpError as exc:
        _raise(exc)
    return _view(d)


@router.get("/drafts")
async def list_drafts(status: Optional[str] = None):
    return draft_ops.list_drafts(status)


@router.get("/drafts/{draft_id}")
async def get_draft(draft_id: str):
    try:
        return _view(draft_ops.get_draft(draft_id))
    except OpError as exc:
        _raise(exc)


class IssueAction(BaseModel):
    action: Literal["accept", "edit", "request_exception"]
    chosen_fix: Optional[str] = None
    new_text: Optional[str] = None
    note: Optional[str] = None


@router.patch("/drafts/{draft_id}/issues/{issue_id}")
async def act(draft_id: str, issue_id: str, body: IssueAction):
    try:
        d = await draft_ops.act_on_issue(draft_id, issue_id, body.action, store.KIT, body.chosen_fix, body.new_text, body.note)
    except OpError as exc:
        _raise(exc)
    return _view(d)


@router.post("/drafts/{draft_id}/recheck")
async def recheck(draft_id: str):
    try:
        return _view(await draft_ops.recheck(draft_ops.get_draft(draft_id), store.KIT))
    except OpError as exc:
        _raise(exc)


@router.post("/drafts/{draft_id}/submit")
async def submit(draft_id: str):
    try:
        d = draft_ops.submit(draft_id)
    except OpError as exc:
        _raise(exc)
    return {"id": d["id"], "status": d["status"]}


class CommentIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    issue_id: Optional[str] = None


@router.post("/drafts/{draft_id}/comments")
async def comment(draft_id: str, body: CommentIn, x_role: str = Header("creator"), x_user: str = Header("anonymous")):
    try:
        return _view(draft_ops.add_comment(draft_id, x_user, x_role, body.text, body.issue_id))
    except OpError as exc:
        _raise(exc)


class DecisionIn(BaseModel):
    decision: Literal["approve", "request_changes"]
    comment: str = ""


@router.post("/drafts/{draft_id}/decision")
async def decision(draft_id: str, body: DecisionIn, x_role: str = Header("creator"), x_user: str = Header("anonymous")):
    """Send header X-Role: manager. Only managers can decide."""
    try:
        d = draft_ops.decide(draft_id, x_role, x_user, body.decision, body.comment)
    except OpError as exc:
        _raise(exc)
    return {"id": d["id"], "status": d["status"]}


@router.get("/insights")
async def insights():
    return draft_ops.insights()


@router.get("/demo/drafts")
async def demo_drafts():
    from ..services.demo import demo_drafts as load

    return load()