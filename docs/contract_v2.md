# API contract v2 (Round 3): sign-in, versions, waivers

For Pradeep. Base URL: the Render API. All errors: `{"error": {"code": "...", "message": "..."}}`.

## 1. Sign-in (replaces the X-Role / X-User headers)

| Call | Body | Returns |
|---|---|---|
| `GET /api/auth/demo-accounts` | none (public) | `{demo, password, accounts:[{id,email,name,role}]}` for the login page buttons |
| `POST /api/auth/login` | `{email, password}` | `{token, user:{id,email,name,role}}` |
| `GET /api/auth/me` | none | `{user}` |

Send `Authorization: Bearer <token>` on every other call (except `/api/health`, `/api/mock/*`, `/api/demo/drafts`).
Roles: `creator`, `manager`, `reviewer` (compliance reviewer). Demo accounts: `creator@`, `creator2@`, `manager@`, `reviewer@loomguard.demo`, shared password from `/api/auth/demo-accounts`.
401 `UNAUTHENTICATED` / `TOKEN_EXPIRED` / `INVALID_CREDENTIALS` -> show the login page. 429 `RATE_LIMITED` after 10 wrong passwords in 5 minutes.

## 2. Who can do what

| Action | creator | manager | reviewer |
|---|---|---|---|
| Create draft (`POST /api/drafts`) | yes | yes | no (403) |
| See drafts | own drafts only | all submitted drafts (not private DRAFTs) | same as manager |
| Fix / edit / exception request / recheck / submit / new revision | owner only | no (403) | no |
| Comment | on drafts they can see | yes | yes |
| Grant or deny an exception (`/waiver`) | no | any issue | `CLAIM` issues only |
| Approve / request changes (`/decision`) | no | yes | no |
| Brand kit upload / terms, `/api/debug/*` | no | yes | no |
| `GET /api/insights` | no | yes | yes |
| `GET /api/audit` (all drafts) | no | yes | no |

A draft that is not yours (or not visible to you) returns **404** `DRAFT_NOT_FOUND`, not 403.
Hide buttons the role cannot use, but the server enforces it anyway.

## 3. Draft object: what changed

New fields on a draft: `kind` ("text"), `owner_id`, `revision` (int), `versions` (list, **without text**), `audit` (list).
New field on an issue: `waiver` = `{state: "granted"|"denied", by, role, at, reason}` or `null`.
New issue `status` value: `waived`. Statuses: `open`, `accepted`, `edited`, `exception_requested`, `waived`.

`versions[i]` = `{n, author, role, at, note, counts:{total, open_mandatory}, chars}`. Full text: `GET /api/drafts/{id}/versions/{n}`.
`audit[i]` = `{at, actor, role, type, detail}`. Types: created, checked, fix_accepted, edited, revision_uploaded, exception_requested, waiver_granted, waiver_denied, waiver_expired, submitted, comment, decision.
Comments gain `parent_id` (reply to a comment id, or null) and `version`.

## 4. New and changed endpoints

| Call | Notes |
|---|---|
| `PATCH /api/drafts/{id}/issues/{iid}` | body adds optional **`revision`**: send the draft's `revision` you last received. A stale value returns 409 `STALE_REVISION` (double click or someone else changed it): reload the draft. **Always send it.** |
| `POST /api/drafts/{id}/revisions` | multipart `file` or `text`, optional `note`. Replaces the whole text, adds a version, re-checks. 409 `NO_CHANGE` if identical. |
| `GET /api/drafts/{id}/versions` | list |
| `GET /api/drafts/{id}/versions/{n}` | one version including `text` |
| `GET /api/drafts/{id}/diff?from=1&to=3` | `{from, to, ops:[{op:"equal"\|"insert"\|"delete", text}], stats:{added_words, removed_words, unchanged_words}}`. Concatenate `equal`+`delete` = old text; `equal`+`insert` = new text. |
| `POST /api/drafts/{id}/issues/{iid}/waiver` | body `{decision:"grant"\|"deny", reason}` (reason required, 3+ chars). Only while the draft is `IN_REVIEW`. Returns the draft. |
| `POST /api/drafts/{id}/comments` | body `{text, issue_id?, parent_id?}`. Author comes from the token. |
| `POST /api/drafts/{id}/decision` | `{decision:"approve"\|"request_changes", comment}`. Approve is refused with 409 `PENDING_EXCEPTIONS` (undecided requests) or 409 `OPEN_MANDATORY_ISSUES`. |
| `GET /api/drafts/{id}/audit` / `GET /api/audit?limit=100` | audit trail |
| `GET /api/drafts` | list now includes `kind`, `pending_exceptions`, `versions`, and only drafts you may see |
| `GET /api/health` | adds `persistence` ("mongodb" or "memory": show a warning banner on "memory"), `kit_version`, `auth` |

## 5. Rules the UI must reflect

- **Exception flow:** creator requests an exception (note required) -> status `exception_requested` -> still allows submit -> manager/reviewer grants (issue becomes `waived`, stops blocking) or denies (issue goes back to `open`, with `waiver.state = "denied"` and the reason; creator must fix it or ask again with a new note).
- A waiver only applies to that exact quoted text. If the creator changes it, the issue re-opens and the audit shows `waiver_expired`.
- Submit is blocked by open mandatory issues (409 `OPEN_MANDATORY_ISSUES`). `exception_requested` and `waived` do not block submit.
- Disable a button while its request is running (double click protection), and on 409 reload the draft.

## 6. New error codes

`UNAUTHENTICATED 401`, `TOKEN_EXPIRED 401`, `INVALID_CREDENTIALS 401`, `FORBIDDEN_ROLE 403`, `RATE_LIMITED 429`, `STALE_REVISION 409`, `ISSUE_ALREADY_HANDLED 409`, `PENDING_EXCEPTIONS 409`, `NO_CHANGE 409`, `NOT_IN_REVIEW 409`, `REASON_REQUIRED 422`, `VERSION_NOT_FOUND 404`, `COMMENT_NOT_FOUND 404`. Older codes unchanged.

## 7. Environment (Render)

`JWT_SECRET` (long random string, required or sign-ins end on every restart), `TOKEN_HOURS=12`, `SEED_DEMO_USERS=true`, `DEMO_PASSWORD`, and **`LEGACY_HEADER_AUTH=false`**.
While the frontend still sends X-Role/X-User you may set `LEGACY_HEADER_AUTH=true` as a bridge. That setting is insecure: it must be `false` for the final submission.


## 8. Part 2: masking, images, insights over time

### Masking (draft field `mask_summary`)
`mask_summary = {count, by_kind:{confidential|email|phone|card|key: n}, items:[{token, kind, preview}], ai_used}`. Show "N values were hidden from the AI" with the kinds; `items[].preview` is a short, partly hidden label, never the full value. Audit gets a `masked` event. Managers edit confidential terms with `PUT /api/brand/terms` (`confidential:[{term, kind}]`). If masking fails the AI checks are skipped and the check note says so.

### Image drafts
| Call | Notes |
|---|---|
| `POST /api/drafts/image` | multipart `file` (PNG or JPG, content-checked), `title`, `use_ai`. Returns the draft with `kind:"image"`. Errors 400: `UNSUPPORTED_IMAGE`, `IMAGE_TOO_LARGE`, `IMAGE_TOO_SMALL`, `IMAGE_CORRUPT`. |
| `GET /api/drafts/{id}/image?version=n&annotate=true` | PNG. `annotate=true` draws numbered boxes for every finding (iss_03 = box 3). Use `<img>` with the Authorization header via fetch to blob, or draw boxes yourself from `region`. |
| `POST /api/drafts/{id}/revisions` | for an image draft send a new `file` (PNG/JPG). |

New draft fields for images: `image` `{filename, format, width, height, original_width, original_height, downscaled, bytes, sha256}`, `palette` (dominant colours `{hex, share, chroma, region, on_brand, nearest_brand, delta_e}`), `elements` (text and logo boxes found, with `measured`).
Image issues keep the usual fields, with `start = end = 0`, plus **`region`** `{x, y, w, h}` as fractions of the image (0-1) and **`measurement`**. Categories: `COLOUR`, `ACCESSIBILITY`, `LAYOUT`, `SECURITY`.
- ACCESSIBILITY `measurement`: `{text, foreground, background, ratio, required, standard:"WCAG 2.1 AA", basis}`. `suggested_fixes[0]` is a same-hue colour that passes.
- COLOUR `measurement`: `{colour, share, nearest_brand, delta_e00, match_threshold}`.
- Fix and accept: not possible on pixels. `PATCH ... action:"accept"|"edit"` returns 422 `FIX_BY_REUPLOAD`. Use "upload a new image" or `request_exception` (waiver flow identical to text).
- Image `checks` entries: palette, contrast, logo_placement, masking (always "not run": text inside images cannot be masked; tell the user the image goes to Gemini unless AI is switched off).
- Versions of an image draft have a placeholder `text` `[image name WxH sha256:...]`. Do not run the word diff view for image drafts; show the two images side by side instead (`/image?version=n`).

### Insights over time (manager, reviewer)
| Call | Notes |
|---|---|
| `GET /api/insights/trends?weeks=8&include_demo=true` | `{weeks, drafts, includes_demo_data, demo_note, weekly:[{week_start, drafts_checked, issues_found, fixes_applied, exceptions_requested, waivers_granted, waivers_denied, approved, changes_requested}], top_rules:[{rule, category, count, drafts, exceptions_requested, waivers_granted, waivers_denied, recent, earlier, trend:"rising"\|"falling"\|"steady"}], recommendations:[{id, level:"high"\|"medium"\|"info", title, text, evidence}], totals, drafts_by_status}`. If `demo_note` is not null, show it above the charts. |
| `GET /api/insights/export.csv?table=weekly\|rules\|recommendations` | download |
| `GET /api/insights/report.pdf` | the downloadable compliance summary |
| `POST /api/demo/history` / `DELETE /api/demo/history` | manager only. Adds or removes 14 drafts titled "[DEMO] ...". 409 `DEMO_HISTORY_EXISTS` if already loaded. Demo drafts also appear in the drafts list, labelled by title. |
`GET /api/insights` (old summary) is unchanged and never counts demo drafts.