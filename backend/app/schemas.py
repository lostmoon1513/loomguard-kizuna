"""Pydantic models. This file is the source of truth for docs/contract.md."""
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

Category = Literal["TERMINOLOGY", "TONE", "CLAIM", "READABILITY", "SECURITY"]
ClaimStatus = Literal["SUPPORTED", "CONTRADICTED", "OUTDATED", "UNSUPPORTED"]
Severity = Literal["high", "medium", "low"]
IssueSource = Literal["python_rule", "gemini", "gemini+python"]
IssueStatus = Literal["open", "accepted", "edited", "exception_requested"]
DraftStatus = Literal["CHECKING", "DRAFT", "IN_REVIEW", "APPROVED", "CHANGES_REQUESTED"]
Priority = Literal["mandatory", "advisory"]


class Citation(BaseModel):
    doc: str  # "Brand Guide" | "Approved Facts CSV"
    ref: str  # "Page 9" | "Row 14"
    rule_id: Optional[str] = None


class Issue(BaseModel):
    id: str
    category: Category
    claim_status: Optional[ClaimStatus] = None
    severity: Severity
    source: IssueSource
    quote: str
    start: int = Field(ge=0)
    end: int = Field(gt=0)
    reason: str
    citation: Optional[Citation] = None
    suggested_fixes: list[str] = Field(default_factory=list, max_length=3)
    needs_review: bool = False
    priority: Priority = "advisory"
    status: IssueStatus = "open"
    exception_note: Optional[str] = None

    @model_validator(mode="after")
    def _offsets_ordered(self):
        if self.end <= self.start:
            raise ValueError("end must be greater than start")
        return self


class CheckInfo(BaseModel):
    name: str
    source: IssueSource
    ran: bool


class Summary(BaseModel):
    total: int
    by_category: dict[str, int] = Field(default_factory=dict)


class Draft(BaseModel):
    id: str
    title: str
    status: DraftStatus
    text: str
    ai_available: bool = True
    kit_version: Optional[int] = None
    checks: list[CheckInfo] = Field(default_factory=list)
    issues: list[Issue] = Field(default_factory=list)
    summary: Summary

    @model_validator(mode="after")
    def _quotes_match_text(self):
        """Guard: every issue quote must equal text[start:end]."""
        for i in self.issues:
            if self.text[i.start:i.end] != i.quote:
                raise ValueError(f"issue {i.id}: quote does not match text[{i.start}:{i.end}]")
        return self


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody