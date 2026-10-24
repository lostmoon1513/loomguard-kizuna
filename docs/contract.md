# LoomGuard API contract (for the frontend)  | base URL: http://localhost:8000

Errors always look like `{"error": {"code": "OPEN_MANDATORY_ISSUES", "message": "..."}}`.
Role header on every request: `X-Role: creator` or `X-Role: manager`, plus `X-User: <name>`.
Highlight text with `start`/`end` offsets into `draft.text`. Do NOT search for the quote.

## Draft object (returned by create / get / patch / recheck)
`{id, title, author, status, text, ai_available, kit_version, checks[], issues[], summary{total,by_category}, resolved[], comments[], decisions[], created_at, updated_at}`
status: DRAFT | IN_REVIEW | APPROVED | CHANGES_REQUESTED
Issue: `{id, category(TERMINOLOGY|TONE|CLAIM|READABILITY|SECURITY), claim_status(UNSUPPORTED|CONTRADICTED|OUTDATED|null), severity(high|medium|low), source(python_rule|gemini|gemini+python), quote, start, end, reason, citation{doc,ref,rule_id?}|null, suggested_fixes[<=3], needs_review(bool), priority(mandatory|advisory), status(open|accepted|edited|exception_requested), exception_note}`
UI: show badge "AI" if source contains "gemini" else "Rule". Show "Needs human review" when needs_review. Show Mandatory/Advisory chip.
If `ai_available` is false show a banner: "AI checks unavailable. Rule-based checks only."

## Endpoints
| Method | Path | Body | Notes |
|---|---|---|---|
| GET | /api/health | | server status |
| GET | /api/brand | | kit summary (`ready`, guide pages, facts rows, terms) |
| POST | /api/brand/upload | multipart `guide` (.pdf), `facts` (.csv) | |
| POST | /api/brand/load-demo | | loads demo kit |
| PUT | /api/brand/terms | `{banned:[{term,reason}], preferred:[{avoid,use}], hex_codes:[]}` | |
| GET | /api/demo/drafts | | `{flawed_1: "text", ...}` for a "Try sample draft" button |
| POST | /api/drafts | multipart: `file` OR `text`, optional `title`, `author`, `use_ai` | runs all checks |
| GET | /api/drafts?status= | | list rows |
| GET | /api/drafts/{id} | | full draft |
| PATCH | /api/drafts/{id}/issues/{iid} | `{action:"accept", chosen_fix}` or `{action:"edit", new_text}` or `{action:"request_exception", note}` | accept/edit change the text and re-check; response is the new draft |
| POST | /api/drafts/{id}/recheck | | |
| POST | /api/drafts/{id}/submit | | 409 `OPEN_MANDATORY_ISSUES` until every mandatory issue is accepted, edited or has an exception note |
| POST | /api/drafts/{id}/comments | `{text, issue_id?}` | |
| POST | /api/drafts/{id}/decision | `{decision:"approve"|"request_changes", comment}` | needs `X-Role: manager`, else 403 `MANAGER_ONLY` |
| GET | /api/insights | | counts by category, claim status, top rules, exceptions |

Mock (no backend logic): GET /api/mock/draft.
