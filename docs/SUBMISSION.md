# Round 2 submission text (copy into the form; fix anything marked [CHECK] after testing)

## Project
LoomGuard: a pre-publication brand review and compliance platform (Team KIZUNA, RGUKT Basar).
Creators upload a draft. LoomGuard checks it against the brand guide and the approved-facts sheet, explains every issue with a source (guide page or facts row), suggests small phrase-level fixes, and routes the draft to a manager. The system never approves anything and never rewrites a whole document.

## Links
- Working project: [PASTE LIVE LINK]
- Source code: [PASTE GITHUB LINK]
- Updated PDF: [ATTACH]

## Completed features
1. Brand kit: upload a guide PDF and an approved-facts CSV (or load the built-in demo kit). Rules keep their page number, priority (mandatory / advisory) and exceptions together.
2. Draft intake: paste text or upload .md, .txt, .docx or text PDF. Scanned PDFs are rejected with a clear message.
3. Terminology check: banned and preferred terms (case, hyphen and plural aware) with the guide page cited.
4. Claim verification against approved facts, decided by code: CONTRADICTED (wrong number, with the right value suggested), OUTDATED (fact expired, current value suggested), UNSUPPORTED (no source; shown as "unverified", not "false"). Superlatives such as "#1" and outcome guarantees are flagged for a human.
5. Readability check (long sentences).
6. Prompt-injection scan: text in a draft that tries to instruct the checker is flagged and ignored.
7. AI checks with Gemini (tone and extra claims) behind an output guard: phrases must exist verbatim in the draft, at most 3 similar-length replacements, no links or instructions, citations and offsets always set by code. [CHECK: works with the new API key]
8. Review Studio: highlighted draft, issue cards with reason, source, Rule / AI tag, Mandatory / Advisory chip, "Needs human review" badge.
9. Actions: accept a suggested fix, edit manually, request an exception (note required). Every change triggers a full re-check.
10. Workflow: submit (blocked until mandatory issues are handled), comments, manager-only Approve / Request changes, status tracking.
11. Insights: issues by category and claim type, most-triggered rules, exception counts, "potentially unclear rules" (two or more exception requests).
12. Reliability: if Gemini or MongoDB is down the app keeps working with rule-based checks and shows a banner. Results are cached by content.
13. Evaluation harness with a labelled test set (results in the PDF).

## Technology and implementation
- Backend: Python 3.11, FastAPI, Pydantic v2, pypdf, python-docx, numpy, rapidfuzz-free own matcher, own BM25 + Reciprocal Rank Fusion.
- AI: Google Gemini (`gemini-2.5-flash` for tone and claim extraction, `gemini-embedding-001` for embeddings; both set by environment variables), called through `google-genai` with schema-bound JSON output, 10 s timeout, one retry, never trusted without validation.
- Data: MongoDB Atlas (motor) when reachable, in-memory fallback. Kit is rebuilt into the search index at startup.
- Web app: single-page HTML/JS served by the same FastAPI service (one deployed link). Optional separate React app by Pradeep. [CHECK]
- Deploy: Render (free), Docker file included.
- Design rules: code decides claim status and citations; the AI only suggests phrases; every AI answer is validated; manager approval is always human.
- External services: Gemini API, MongoDB Atlas, Render. No customer data is sent to AI beyond the draft text being checked.

## Evaluation (from `backend/evals/results.md`, rule-based checks, 56 drafts, 39 labelled issues)
Generic checker: recall 18%. Brand kit + retrieval only: recall 46%. Full LoomGuard: precision 100%, recall 100%, 0 false alarms on 23 clean drafts, claim-status accuracy 100% (22 claims), all citations correct. Prompt-injection scan caught 8 of 8 attacks, 0 of 6 harmless texts flagged. Retrieval Hit@3 97% (keyword only).
Honest limits: small team-written test set; two code bugs and two label errors were found and fixed by this evaluation (documented in results.md); AI checks are not in these numbers.

## Changes made to the original plan
See `docs/changes_from_plan.md` (PyMuPDF to pypdf; Chroma to own BM25 + numpy; four claim statuses instead of similarity only; asyncio instead of LangGraph; Cloudinary and real login deferred; injection scan and output guard added).

## Three major improvements for Round 3
1. **Image and banner checker with accessibility (WCAG).** Upload a banner or social image. Extract dominant colours (K-Means), compare them with the brand palette using CIEDE2000 colour difference, measure text contrast against WCAG 2.1 AA (4.5:1) for text regions, and use Gemini Vision for logo placement and layout. Findings reuse the same issue format, citations (guide page) and workflow, so the Review Studio shows image issues with highlighted regions.
2. **Revision history, side-by-side diff and exception waivers.** Keep every version of a draft with who changed what. Show a word-level diff between versions. Managers grant or deny exception requests with a recorded reason, and a granted exception stops that issue from blocking approval for that draft. Add real sign-in with Creator, Manager and Compliance Reviewer roles.
3. **Governance insights and sensitive-data masking.** Mask confidential codenames and customer names locally before any AI call (reversible mapping kept on the server), and show what was masked. Turn repeated mistakes and exception requests into recommendations ("Rule p3_r1 got 6 exception requests: clarify the wording"), over time, with a downloadable compliance summary.

## Team contribution [FILL IN: each person writes their own]
- Shruthi Pallemoni: [backend, AI/RAG, evaluation, ...]
- Pradeep Sutrave: [frontend, workflow, sample data, testing, ...]

## AI-assistance and reuse disclosure
Code and documents were drafted with help from Claude (Anthropic) and planning advice from ChatGPT, then reviewed, run and tested by the team. Runtime AI: Google Gemini. No code from earlier projects was reused. [CHECK: edit if untrue]
Libraries: FastAPI, Pydantic, Uvicorn, motor, pypdf, python-docx, numpy, google-genai, certifi, reportlab (sample kit generation).

## Known limitations
Text-only checks (no images yet); text PDFs only; keyword-only search if embeddings are unavailable; claims phrased in unusual ways can be missed; roles are simplified (no sign-in yet); free hosting may sleep and clears in-memory drafts on restart if MongoDB is unreachable.