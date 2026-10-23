# LoomGuard: Round 2 Roadmap (Team KIZUNA)

**Window:** Thu 22 Oct 10:00 AM IST to **Sun 25 Oct 10:00 AM IST** (25 Oct 2026 is a Sunday; 72 hours total).
**Goal:** Judges open one link and run the whole core journey with no help:
Brand setup -> upload draft -> see flagged issues with citations -> fix -> submit -> manager approves.

## 1. Scoring -> what to protect

| Criterion | Pts | What it means for us |
|---|---|---|
| Working core workflow | 30 | One unbroken path, deployed, with a pre-loaded demo brand kit so judges don't need their own files |
| Technical depth & reliability | 25 | Two-step claim check, Python-first rules, structured JSON, graceful failure when Gemini times out |
| Progress from Round 1 | 20 | Build what the PDF promised (text pipeline, RAG, citations, roles, approval). Document every change |
| Three planned improvements | 15 | Substantial Round 3 items, each with a concrete design (see section 8) |
| Usability | 10 | Seeded demo, a "Try sample draft" button, clear empty states, no login friction |

## 2. Scope: IN vs OUT for Round 2

**IN (must work end to end)**
1. Brand setup: upload Brand Guide PDF + Approved Facts CSV, add banned/preferred terms and brand HEX codes
2. Draft upload: paste text, Markdown, DOCX, text PDF
3. Checks: banned/preferred terms, readability, claim extraction + fact-sheet verification (UNSUPPORTED_CLAIM), tone check via Gemini
4. Review Studio: highlighted issues, rule card with citation (`[Brand Guide - Page 9]`, `[Facts CSV - Row 14]`), Accept Fix / Edit Manually / Request Exception
5. Roles: Creator and Manager (simple role switch or two seeded logins)
6. Workflow states: DRAFT -> IN_REVIEW -> APPROVED / CHANGES_REQUESTED, with manager comments
7. AI disclosure tag per check (AI vs Python rule)

**Light version in Round 2 (so the Round 3 story is credible)**
- Basic Insights page: count of issues by category (full "Potentially Unclear" logic comes in Round 3)

**OUT until Round 3 (these are your three improvements)**
- Image banner checker (K-Means, delta-E, WCAG contrast, Gemini Vision)
- Version diff history + exception waiver approval flow
- Full governance insights + local sensitive-data masking

Do not start these early unless the core path is already deployed and stable.

## 3. Requirements checklist

**Accounts / keys (get these in the first hour)**
- Google AI Studio API key for Gemini 2.5 Flash (both members create one; free tier has rate limits)
- MongoDB Atlas free cluster (M0), one shared connection string, IP allowlist 0.0.0.0/0 for the hackathon
- GitHub repo (public, or judge-accessible), both members as collaborators
- Deploy accounts: Render or Railway (backend), Vercel or Netlify (frontend)
- Cloudinary is optional in Round 2; store uploads on local disk/Mongo first and add Cloudinary with the image checker

**Local tools**
- Python 3.11+, Node 20+, Git, VS Code, Postman/Thunder Client

**Python packages**
`fastapi uvicorn[standard] python-multipart pydantic pymongo motor pymupdf python-docx chromadb sentence-transformers (or Gemini embeddings) google-genai pandas textstat python-dotenv`

**Frontend packages**
`react vite tailwindcss lucide-react recharts react-router-dom axios`

**Test assets (Pradeep, first 3 hours)**
- `sample_kit/brand_guide.pdf`: about 8 to 10 pages with real rules (tone, banned words, HEX palette, claims policy)
- `sample_kit/approved_facts.csv`: 15 to 25 rows (id, claim, value, source, valid_until)
- 4 deliberately flawed drafts: (a) banned words, (b) fake stats, (c) outdated pricing, (d) clean draft that should pass

## 4. Architecture (keep it this simple)

```
React (Vite)  --HTTPS-->  FastAPI
                              |-- /brand   parse PDF -> chunks (page no. kept) -> ChromaDB; glossary/HEX -> MongoDB
                              |-- /drafts  extract text -> run checks in parallel (asyncio.gather)
                              |      |- rules_check.py   banned/preferred terms, readability   (Python)
                              |      |- claims_check.py  Gemini extracts claims -> Chroma lookup -> threshold -> UNSUPPORTED_CLAIM
                              |      |- tone_check.py    Gemini, phrase-only schema            (AI)
                              |-- /reviews comments, status transitions, exceptions
                              |-- /insights aggregate issue counts
MongoDB: brand_kits, drafts, issues, comments, reviews
```

**Rules that must hold (these are your technical-depth points)**
- Citations come from chunk metadata (`page_number`, `row_id`), never from LLM text
- Gemini output is validated with Pydantic; the schema only allows `original_phrase` + `replacement_options` (max 3)
- Python rules run first and work even if Gemini is down
- Every Gemini call has a timeout (10 s) and one retry; on failure return the Python results plus an "AI check unavailable" notice

## 5. Shared contract (agree on this in hour 1, then work in parallel)

**Issue object**
```json
{
  "id": "iss_01",
  "category": "TERMINOLOGY | TONE | CLAIM | READABILITY",
  "severity": "high | medium | low",
  "source": "python_rule | gemini",
  "quote": "world's #1 platform",
  "start": 128, "end": 148,
  "reason": "Superlative claim has no match in the approved facts sheet.",
  "citation": {"doc": "Approved Facts CSV", "ref": "Row 14"},
  "suggested_fixes": ["a leading platform", "trusted by 500+ teams"],
  "status": "open | accepted | edited | exception_requested"
}
```

**Endpoints**

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/brand/upload` | Guide PDF + facts CSV |
| PUT | `/api/brand/terms` | Banned/preferred words, HEX codes |
| GET | `/api/brand` | Current kit summary |
| POST | `/api/drafts` | Upload/paste a draft, run checks, return issues |
| GET | `/api/drafts/{id}` | Draft + issues + status |
| PATCH | `/api/drafts/{id}/issues/{iid}` | Accept / edit / request exception |
| POST | `/api/drafts/{id}/submit` | DRAFT -> IN_REVIEW |
| POST | `/api/drafts/{id}/comments` | Add comment |
| POST | `/api/drafts/{id}/decision` | Approve or Request Changes (manager) |
| GET | `/api/insights` | Issue counts by category and rule |

Shruthi publishes a **mock response file** (`backend/mocks/draft_response.json`) in hour 2 so Pradeep can build the UI against fake data immediately.

## 6. Schedule (IST)

| Block | Pradeep (Frontend / Workflow) | Shruthi (Backend / AI) |
|---|---|---|
| **Thu 10 PM to 1 AM** | Repo + Vite/Tailwind scaffold, routing, role switch. Draft the sample brand guide PDF and facts CSV | FastAPI scaffold, Mongo connection, `.env`, health route. Agree the contract above. Publish mock JSON |
| **Fri 9 AM to 1 PM** | Brand Setup page (uploads, terms, HEX) | `/brand/upload`: PDF -> chunks with page numbers -> Chroma; CSV -> rows with ids; terms/HEX -> Mongo |
| **Fri 1 PM to 6 PM** | Review Studio: split-pane, text highlighter, issue cards (mock data first) | Rules check (banned/preferred, readability) + claim extraction and retrieval + UNSUPPORTED_CLAIM logic |
| **Fri 6 PM to 11 PM** | Wire Studio to real API; Accept/Edit/Exception actions | Gemini tone check with phrase-only schema; parallel runner; timeouts and fallbacks |
| **Sat 9 AM to 1 PM** | Submit flow, manager view, comments, Approve / Request Changes | Review endpoints, status machine, comments; basic `/insights` |
| **Sat 1 PM to 6 PM** | Insights page (Recharts), AI-vs-rule tags, empty/error states, demo seed button | **Deploy backend**, test with real files (messy PDFs, long drafts), fix edge cases |
| **Sat 6 PM to 11 PM** | **Deploy frontend**, connect to prod API, full run-through together | Bug fixing from run-through, rate-limit handling, seed data on prod |
| **Sun 12 AM to 6 AM** | Sleep, or fix blocking bugs only | Sleep |
| **Sun 6 AM to 9 AM** | Final E2E test on the live link in an incognito window. Record a 2 min backup demo video | Update PDF, README, features list, Round 3 plan. Fill the form |
| **Sun 9 AM to 9:45 AM** | **Submit.** Do not wait until 9:59 | Confirm links open without login |

Note: deadline is Sun 25 Oct 10:00 AM IST, so the Sunday rows are correct.

## 7. Definition of done (check before submitting)

- [ ] Live link opens with no setup; demo brand kit is pre-loaded
- [ ] Sample flawed draft returns issues in under about 15 seconds
- [ ] At least one issue each of: banned term, unsupported claim, tone, with real page/row citations
- [ ] Clean draft returns zero or near-zero issues
- [ ] Accept Fix changes only the flagged phrase
- [ ] Creator submits -> Manager sees it -> Approve works -> status shows APPROVED
- [ ] Gemini key removed/failing -> Python checks still work and UI explains why
- [ ] Repo is accessible, README has run instructions, commits show steady work from the window
- [ ] Updated PDF, features list, changes-from-plan, three Round 3 improvements all written

## 8. Round 3 improvements (write these in the submission)

Each must be substantial, with a concrete design:

1. **Image banner and WCAG checker.** K-Means dominant colours via OpenCV/scikit-learn, delta-E (CIEDE2000) against the brand palette, WCAG 2.1 contrast ratio for text regions, Gemini Vision for layout issues. Output uses the same issue object, so the Studio UI reuses it.
2. **Revision history, diff view and exception waivers.** Versioned drafts, side-by-side word-level diff, inline comment threads, and a manager workflow to grant or deny exception requests with a recorded reason.
3. **Governance insights and local data masking.** Regex/keyword masking of confidential codenames before any Gemini call (with a reversible mapping kept server-side), plus an insights engine that flags "Potentially Unclear" rules when exception requests or repeat violations pass a threshold, with CSV/PDF compliance export.

## 9. Changes from the Round 1 plan (be upfront, it scores "progress")

Decide these early and list the ones you actually make:
- Cloudinary deferred to Round 3 (not needed until images)
- Role handling kept simple (role switch/seeded users) instead of full auth
- Readability via `textstat` rather than a custom scorer
- Anything dropped or swapped for time

## 10. Risks and fallbacks

| Risk | Fallback |
|---|---|
| Gemini rate limits / timeouts | Retry once, then return Python-only results with a notice; cache results per draft hash |
| Messy PDFs / scanned guide | Demo with a clean text PDF; show a clear error for scanned files |
| Chroma on free hosting (ephemeral disk) | Rebuild index on startup from Mongo-stored chunks, or use in-memory Chroma seeded at boot |
| Free-tier cold starts | Ping the backend before the demo; mention a short first-load delay in the README |
| Merge conflicts | Strict folder ownership (below), small commits, `main` stays deployable |
| Scope creep | If it isn't in section 2 "IN", it waits |
