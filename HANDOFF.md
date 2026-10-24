# LoomGuard: HANDOFF (give this file to any AI or teammate)

Paste this whole file as the first message to a new AI. Then say: "Continue from the first unchecked step."

## 0. Context
- Event: Inkloom AI hackathon, "Intelligent Brand-Governance Platform". Team KIZUNA (RGUKT Basar).
- Round 2 (The Build): Thu 22 Oct 10:00 IST to **Sun 25 Oct 10:00 IST** (25 Oct 2026 is a Sunday). Submit at https://forms.gle/gyRiHtQT3AnC3MdV6. Aim to submit by Sun 8:00 AM, not 9:59.
- Submit: live link, repo link, updated PDF, completed features list, tech details, changes from plan, 3 Round 3 improvements.
- The official problem statement ALSO asks for Round 2: architecture + main technical decisions; list of APIs, AI models, datasets, libraries, templates, external services; evidence of user testing or structured feedback; each member's contribution. Rules: only work done inside the window counts (judges can inspect commit history), AI assistance and reused code must be disclosed.
- Score (100): core workflow 30, technical depth/reliability 25, progress from Round 1 20, 3 planned improvements 15, usability 10.
- Team: Shruthi = backend/AI/RAG/evals (`backend/`, `evals/`). Pradeep = frontend/workflow/sample data (`frontend/`, `sample_kit/`).
- Product: pre-publication check. Creator uploads draft -> system flags brand issues with citations (guide page / facts row) -> phrase-level fixes -> creator submits -> manager approves. System NEVER approves, NEVER rewrites whole doc, checks "supported by approved sources", not "true".
- Related docs in repo: `README.md`, `ROADMAP.md` (schedule), `WORKFLOW.md` (diagrams, data model, API). Round 1 PDF: `KIZUNA_Round_1_LoomGuard_Submission.pdf`.
- Linked ChatGPT chat (https://chatgpt.com/share/6adaec0b-7638-83ec-af66-9f14c77b9aa7) titled "Build Brand RAG App" could NOT be read by tools. If it holds decisions, paste its key parts into section 9 below.

## 0b. ChatGPT advice review (what we KEEP, what we SKIP)
Problem statement says: system REVIEWS content BEFORE publication. It checks, it does not generate. So ChatGPT's "generate content" parts are skipped.

KEEP (adds score):
- Rule extraction with metadata: store each guide rule as `{rule_id, category, requirement, scope, exception, priority(mandatory|advisory), source_page, version}`. Keep exceptions with the rule, never as lone chunks. Cite rule_id + page.
- Chunk by section/rule (300-700 tokens, small overlap), not blind character split.
- Hybrid retrieval (BM25 + vector + RRF) is P0. Metadata filter by `brand_id` and `kit_version` (no cross-brand leak).
- Conflict handling: if two rules clash and precedence unclear, flag "needs human review". Do not let LLM guess.
- Revise-and-recheck: after Accept Fix, re-run checks on new text, show result.
- Uncertainty: every issue has `confidence` (certain | needs_review). Missing evidence = "unverified", never invent support. No fake "95% compliance" score.
- Eval metrics: retrieval Recall@k/MRR, violation precision, violation recall, FALSE-POSITIVE rate, citation accuracy, latency, plus 3-way comparison (see Step 12). This is our biggest differentiator.
- Test cases: paraphrase, missing evidence, conflicting rules, exception in scope, wrong-brand, prompt injection inside uploaded draft/PDF, clean content must give no false alarms.
- Do not claim visual checks we do not do. Round 2 = text only.

SKIP (not worth time now):
- Content generation, LLM-writes-caption flow (not in problem statement).
- Cross-encoder reranker, HyDE, query expansion, agentic loops, knowledge graph (only add if eval shows a measured failure; maybe Round 3).
- PostgreSQL/pgvector, full auth (keep Mongo + role switch).
- Ragas dependency. Custom eval script is enough (add Ragas only if time left).
- Cap any retry loop at 2.

## 0c. Commit-history warning
Only work inside the window counts and judges inspect commits. Make the first commit now, commit often. If reusing code from old projects (AskMyDocs etc.), disclose it. Both members must be able to explain the whole pipeline.

## 1. Current status
- DONE: README.md, ROADMAP.md, WORKFLOW.md, this file. Python deps check in cloud sandbox only.
- Step 1 + 3 CODE WRITTEN (user must run verify): `backend/app/{config,db,schemas,main}.py`, `mocks/draft_response.json` (schema-validated), `tests/test_step1.py`.
- Step 2 sample kit GENERATED: `sample_kit/{brand_guide.pdf,approved_facts.csv,terms.json,drafts/*.md}`, regenerate with `python sample_kit/make_sample_kit.py`. Pradeep may refine.
- Step 4 CODE WRITTEN: `app/services/{parsing,indexing,retrieval,embeddings,store}.py`, `app/routers/brand.py`, `tests/test_step4.py`. Pure-Python parts (parse, chunk, facts, BM25 retrieval) tested in sandbox: 8/8 pass. NOT tested: FastAPI routes, Mongo save/load, Gemini embeddings (sandbox has no network/pip). User must run them.
- Design change: pypdf + own BM25 + numpy cosine + RRF instead of PyMuPDF/Chroma (see docs/changes_from_plan.md). Facts "Row N" = spreadsheet row (header is row 1).
- USER RAN (Fri 23 Oct 16:44): server starts, /docs and /api/health OK (Gemini + Mongo configured), pytest 13 pass 1 fail (404 error shape). Fixed in main.py by catching StarletteHTTPException. Step 1 and 3 count as verified once re-run is green.
- Step 5 CODE WRITTEN + tested in sandbox (9/9): `services/{issues,rules_check,guards}.py`, `tests/test_step5.py`. Banned/preferred terms with page citations from chunk metadata, long-sentence check, prompt-injection scan (new category SECURITY, tell Pradeep). Not yet wired to an endpoint (runner is Step 8).
- USER VERIFIED (Fri 23 Oct 17:01): upload works, GET /api/brand survives restart (Mongo OK), 23 tests pass. FOUND: `vector_search:false` = Gemini embeddings failing silently (cause unknown). Use GET /api/health/gemini to read the real error.
- Step 6 CODE WRITTEN, 18/18 pure tests pass in sandbox: `services/{claims_check,llm_claims,gemini_client,demo}.py`, `routers/debug.py`, `tests/test_step6.py`. Claim statuses decided by code (CONTRADICTED / OUTDATED / UNSUPPORTED), fixes + Row citations from fact metadata. Gemini only suggests extra claim phrases (optional). Added: `POST /api/brand/load-demo`, auto-load demo kit at startup (AUTOLOAD_DEMO), `GET /api/health/gemini`, `POST /api/debug/check-text` (temporary, replaced by drafts router in Step 8). Gemini calls NOT tested yet.
- Sat 24 Oct 09:14: Gemini key was SUSPENDED (403 CONSUMER_SUSPENDED), not a model-name problem. Models now env vars GEMINI_MODEL / GEMINI_EMBED_MODEL (default gemini-2.5-flash / gemini-embedding-001; docs say 2.5 flash is still served; gemini-embedding-2 is the official embedding replacement). Keys are masked in logs. User must create a NEW key in a NEW Google Cloud project and rotate the leaked ones. Mongo SSL error = Atlas IP allowlist (add 0.0.0.0/0) ; db.py now uses certifi and a 60 s circuit breaker so a dead Mongo never slows the API.
- Steps 7, 8, 9, 10 CODE WRITTEN + 30/30 pure tests pass in sandbox: tone check + output guard (`tone_check.py`, `guards.guard_tone_findings`), runner (`runner.py`, cache), workflow (`draft_ops.py`, `drafts_store.py`), routes (`routers/drafts.py`): create/list/get draft, accept/edit/exception, recheck, submit gate, comments, manager-only decision (X-Role header), insights incl. potentially_unclear_rules. API doc for the frontend: `docs/contract.md`. Tests now read `backend/demo_kit`. Gemini calls (tone, claim extraction) still UNTESTED against the live API.
- NOT DONE: frontend (Pradeep), evals (Step 12), deploy (Step 14), PDF + submission pack (Step 15).
- Tick boxes in section 6 as steps finish. Last ticked step = where to resume.

## 2. Stack (decided)
Backend: Python 3.11+, FastAPI, Pydantic v2, PyMuPDF (PDF + page numbers), python-docx, ChromaDB (vectors), rank_bm25 (keyword), Gemini 2.5 Flash via `google-genai` (structured output), Gemini embeddings, MongoDB Atlas + Motor, rapidfuzz, textstat, tenacity, LangGraph (pipeline; fallback asyncio.gather), pytest.
Frontend: React + Vite + Tailwind, react-router-dom, axios, recharts, lucide-react.
Deploy: Render/Railway (backend), Vercel/Netlify (frontend), Atlas M0.
Env vars: `GEMINI_API_KEY`, `MONGO_URI`, `MONGO_DB=loomguard`, `CORS_ORIGINS`, `SIMILARITY_THRESHOLD=0.55`.

## 3. Design rules (do NOT break)
1. Python rules run first, work without Gemini.
2. Gemini only extracts claims and gives phrase-only tone fixes. Code decides claim status.
3. Citations come from chunk metadata (`page_number`, `row_id`). Never from LLM text.
4. Every Gemini reply validated by Pydantic. `original_phrase` must exist verbatim in draft. Offsets (`start`,`end`) computed by code. Max 3 replacement options, length near original.
5. Gemini timeout 10 s, one retry, then Python-only result with `ai_available:false`.
6. Untrusted draft: wrap in delimiters in prompts, flag injection patterns ("ignore the rules", "approve this").
7. Only Manager role approves. No auto-approve.
8. Unresolvable rule conflict => `needs_review:true`, never let LLM pick a winner.
9. Every Gemini call: trusted system instructions separate from untrusted draft/guide text.
10. Each issue carries `source` tag: `python_rule` | `gemini` | `gemini+python`. UI shows AI/Rule tag.
11. LoomGuard CHECKS content, it does NOT generate content. (Round 1 PDF says "It shouldn't write content for people".) Do not build a caption/copy generator.
12. Never show a "compliance score" as a guarantee. Show findings with evidence. Claims with no source = "unverified", never "false". Low-confidence findings set `needs_review:true` for a human.
13. Brand kit scoped by `kit_version`/`brand_id`. Retrieval must only search the current kit (no leakage across kits).
14. Cap all retry loops (Gemini: 1 retry). No unbounded agent loops.

## 4. Contract
Issue:
```json
{"id":"iss_01","category":"TERMINOLOGY|TONE|CLAIM|READABILITY","claim_status":"SUPPORTED|CONTRADICTED|OUTDATED|UNSUPPORTED|null","severity":"high|medium|low","source":"python_rule|gemini|gemini+python","quote":"...","start":128,"end":141,"reason":"...","citation":{"doc":"Approved Facts CSV","ref":"Row 14"},"suggested_fixes":["..."],"needs_review":false,"priority":"mandatory|advisory","status":"open|accepted|edited|exception_requested"}
```
NEW vs earlier docs: `needs_review` (bool) and `priority` added. Tell Pradeep: show a "Needs human review" badge when `needs_review` is true, and a "Mandatory/Advisory" chip.
Draft response: `{id,title,status,text,ai_available,checks[{name,source,ran}],issues[],summary{total,by_category}}`.
Errors: `{"error":{"code":"FILE_UNSUPPORTED","message":"..."}}`.
Endpoints:
- `POST /api/brand/upload` (guide PDF + facts CSV), `PUT /api/brand/terms`, `GET /api/brand`
- `POST /api/drafts` (file or text), `GET /api/drafts/{id}`, `POST /api/drafts/{id}/recheck`
- `PATCH /api/drafts/{id}/issues/{iid}` body `{action:accept|edit|request_exception, chosen_fix?, text?, note?}`
- `POST /api/drafts/{id}/submit`, `POST /api/drafts/{id}/comments`, `POST /api/drafts/{id}/decision` body `{decision:approve|request_changes, comment}`
- `GET /api/insights`, `GET /api/health`
Draft status: CHECKING -> DRAFT -> IN_REVIEW -> APPROVED | CHANGES_REQUESTED -> DRAFT.
Claim status logic: no match above threshold = UNSUPPORTED; match but numbers differ = CONTRADICTED; match, numbers same, `valid_until` passed = OUTDATED; else SUPPORTED (no issue raised).

## 5. Target layout
```
loomguard/
  README.md ROADMAP.md WORKFLOW.md HANDOFF.md
  docs/contract.md docs/changes_from_plan.md
  sample_kit/ brand_guide.pdf approved_facts.csv drafts/{flawed_1,flawed_2,flawed_3,clean}.md
  backend/ app/{main,config,db,schemas}.py
           app/routers/{brand,drafts,reviews,insights}.py
           app/services/{parsing,indexing,rules_check,claims_check,tone_check,guards,runner}.py
           mocks/draft_response.json  tests/  requirements.txt  .env.example
  evals/ golden_claims.json golden_retrieval.json golden_terms.json run_evals.py results.md
  frontend/ src/{pages,components,api,mocks}  package.json  .env.example
```

## 6. Build steps with verification (do in order, tick when verified)
Rule: finish + verify one step before the next. If check fails, fix before moving on.

### Step 1 [ ] Scaffold backend
Do: venv, install deps, `app/main.py` with CORS, `/api/health`, `.env` loading, Mongo connect, error handler.
Verify:
- `uvicorn app.main:app --reload` starts, no errors.
- `curl localhost:8000/api/health` returns `{"status":"ok"}`.
- `localhost:8000/docs` opens.
- Wrong Mongo URI gives clear error, not a crash loop.

### Step 2 [ ] Sample data (Pradeep)
Do: `brand_guide.pdf` (8-10 pages: tone, banned words, HEX, claims policy), `approved_facts.csv` (15-25 rows: id, claim, value, unit, source, valid_until incl. one expired), 4 drafts.
Verify:
- PDF text selectable (not scanned).
- CSV has at least one row per status case: matching, number-differs, expired.
- flawed drafts contain: banned word, fake stat, wrong number (99.99 vs 99.9), expired price, injection line. clean.md has none.

### Step 3 [ ] Mock JSON + contract (unblocks frontend)
Do: `backend/mocks/draft_response.json` with 5 issues covering all categories; commit `docs/contract.md`.
Verify: JSON validates against Pydantic `Draft` model; Pradeep renders it in Studio.

### Step 4 [ ] Brand upload + indexing
Do: parse PDF per page (PyMuPDF). Chunk by section/heading (target 300-700 tokens, small overlap), keeping each rule TOGETHER with its exception/scope text (e.g. "Never use X, except in Y" must stay in one chunk). Chunk metadata: `page_number`, `section`, `priority` (mandatory/advisory, detect words like "must/never/always" vs "should/prefer"), `kit_version`. CSV rows keep `row_id`. Build Chroma + BM25; save terms/HEX; bump `kit_version`; reject scanned PDF. Try tables with `pdfplumber` only if the sample guide has tables.
Verify:
- Upload sample kit, `GET /api/brand` shows page count, chunk count, row count.
- Query chunks for "banned words": top result has correct `page_number`.
- Upload a scanned/empty PDF: clear error.
- Restart server: index rebuilds (or persists).

### Step 5 [ ] Rules check (Python)
Do: banned/preferred term match (exact + rapidfuzz), readability (textstat), offsets.
Verify:
- `pytest`: banned word found at right `start/end`; clean draft gives 0 term issues.
- `draft[start:end] == quote` for every issue.

### Step 6 [ ] Claim pipeline
Do: regex extract (numbers, %, prices, dates, "#1/best/guaranteed") + Gemini extract; hybrid retrieve (BM25 + vector + RRF) on facts; compare numbers; assign status.
Verify:
- flawed draft yields UNSUPPORTED, CONTRADICTED and OUTDATED each at least once; matching claim yields none.
- Citation `Row N` equals the real CSV row.
- Missing evidence => UNSUPPORTED/"unverified", never "supported".
- Two conflicting rules in test kit => issue marked `confidence: needs_review`, not silently resolved.
- Brand A kit never returns Brand B chunks.
- Gemini off (bad key): regex claims still processed, `ai_available:false`.

### Step 7 [ ] Gemini tone check + guards
Do: schema-bound call, `guards.py` (phrase exists, offsets by code, max 3 options, length ratio, injection scan).
Verify:
- Fake model reply with phrase not in draft is dropped (unit test).
- Injection line in draft is flagged, instruction not obeyed.
- Timeout simulated: result still returned.

### Step 8 [ ] Runner (LangGraph or asyncio.gather) + `POST /api/drafts`
Do: parse -> guard -> 3 checks parallel -> merge/dedupe -> output guard -> save in Mongo; cache by content hash + kit_version.
Verify:
- Upload flawed_1.md: issues returned under ~15 s.
- Same upload twice: second is instant (cache).
- clean.md: 0 or near-0 issues.
- .md, .docx, text PDF all parse.

### Step 9 [ ] Issue actions + workflow
Do: PATCH issue (accept replaces only that phrase, updates `text`, shifts later offsets), recheck, submit, comments, decision (manager only), status machine.
Verify:
- Accept fix: only that phrase changes, other issue offsets still correct, and checks re-run on the new text (fixed issue gone, no new issue created by the fix).
- Creator cannot call decision (403). Manager can.
- Submit with unresolved open issue (no note) is blocked.
- Status goes DRAFT -> IN_REVIEW -> APPROVED.

### Step 10 [ ] Insights
Do: `GET /api/insights` counts by category, top rules, exception counts.
Verify: after running 3 drafts, counts match manual count.

### Step 11 [ ] Frontend wiring (Pradeep)
Do: Brand Setup, Studio (highlights from `start/end`), Review Queue, Manager view, Insights, role switch, "Load demo kit", "Try sample draft".
Verify: all 8 acceptance steps in section 7 pass locally.

### Step 12 [ ] Evals (Shruthi)
Do: golden sets (30 retrieval pairs, 40 labeled claims, banned-term drafts), `run_evals.py` writes `results.md`.
Metrics: HitRate@3, MRR, claim-status accuracy + confusion table, violation precision / recall / false-positive rate (include COMPLIANT drafts so false alarms are measured), term precision/recall, % valid schema, % correct offsets, % correct citations, median latency, Gemini failure rate.
Test set: aim 50+ cases if time allows (min 30). Include: paraphrased claims, missing-evidence claim, expired fact, wrong number, exception-scoped rule, prompt-injection line inside draft, compliant draft that must NOT be flagged.
**Winning comparison (do this, cheap and memorable):** run the SAME test cases through 3 systems and show one table:
  A) plain Gemini prompt (guide + draft pasted, no retrieval, no code checks)
  B) LoomGuard retrieval only (no numeric compare / guards)
  C) full LoomGuard (retrieval + numeric compare + guards)
Show where C beats A/B and where it still fails (honest limitations score well).
Verify: script runs end to end, table saved, numbers pasted in README and PDF with set sizes stated.

### Step 13 [ ] Tests + hardening
Do: pytest for rules, guards, claim status, offsets, state machine; rate-limit/retry; file size limits.
Verify: `pytest` all green.

### Step 14 [ ] Deploy (by Sat 24 Oct night at latest, deadline is Sun 25 Oct 10:00 IST)
Do: backend on Render/Railway with env vars, frontend on Vercel/Netlify with `VITE_API_URL`, set CORS, seed demo kit on prod.
Verify (incognito window, no login): run section 7 on the LIVE link. Cold start tested.

### Step 14b [ ] User feedback evidence (problem statement asks for it)
Do: after deploy, send live link to 5+ people (classmates, seniors). Small Google Form: did the core flow work without help (Y/N), what confused you, 1-5 usability, one suggestion. Save screenshots/summary in `docs/user_feedback.md`. Fix 1-2 easy findings and log them.
Verify: at least 5 responses saved; summary + 2 fixes written down.

### Step 15 [ ] Submission pack
Do: update PDF (architecture + main technical decisions and why, workflow, screenshots, eval table incl. 3-way comparison, user feedback summary, each member's contribution, full list of APIs/models/libraries/external services/templates used, AI-assistance disclosure incl. Claude/ChatGPT/Gemini), features list, tech details, `docs/changes_from_plan.md`, three Round 3 improvements.
Verify: repo public or judge-accessible, README run steps work on a clean clone, form filled before deadline.

## 7. Acceptance test (live link)
1. Open app, demo kit loaded.
2. Creator uploads flawed_1.md.
3. Within ~15 s: banned term, unsupported claim, wrong number, tone issue, each with page/row citation and 2-3 fixes.
4. Accept one fix (only phrase changes). Request exception on another with note.
5. Submit -> IN_REVIEW.
6. Manager: comment, Approve -> APPROVED.
7. Insights shows counts.
8. clean.md gives ~0 issues.
Also: unset Gemini key -> Python checks still work, banner shown.

## 8. Round 3 improvements (write in submission)
1. Image banner + WCAG checker: K-Means dominant colours, delta-E (CIEDE2000) vs brand HEX, WCAG 2.1 contrast, Gemini Vision for layout. Reuses same issue object.
2. Revision history + diff + exception waivers: versioned drafts, word-level diff, manager grant/deny with recorded reason.
3. Governance insights + local data masking: mask confidential codenames before AI calls, flag "Potentially Unclear" rules from repeated violations/exceptions, export compliance summary.

Changes from Round 1 plan (confirm real ones): Cloudinary deferred to R3; simple role switch not full auth; LangGraph for pipeline (optional); textstat for readability; Gemini embeddings instead of local model.

## 9. Open items / notes
- Risks: Gemini quota, free-host cold start, ephemeral disk for Chroma (rebuild index at boot from Mongo chunks), scanned PDFs unsupported.
- DEADLINE CORRECTION: earlier docs (README/ROADMAP) wrongly say "Sat 25 Oct". 25 Oct 2026 is SUNDAY. Real dates: Thu 22, Fri 23, Sat 24, Sun 25 (ends 10:00 AM IST). ROADMAP "Sun" rows are correct, "Sat 25 Oct" wording is wrong. From Fri 23 Oct ~11 AM about 47 hours remain.
- Suggested time map from Fri 11 AM: Fri = steps 1-8 (backend core + frontend studio on mock). Sat AM = steps 9-11 (workflow + wiring). Sat PM = steps 12-14 deploy + evals. Sat night = 14b feedback. Sun 6-8 AM = step 15 + submit. Deploy a first version by Sat evening; do not wait.

### ChatGPT advice review (Round-2 decisions)
ADOPTED (cheap, raises score):
- Keep rule + exception together in a chunk; store section/priority/version metadata (Step 4).
- `needs_review` + uncertainty wording; claims with no source = "unverified" (rules 10, contract).
- Violation precision/recall/FALSE-POSITIVE rate, compliant-draft tests, injection test (Step 12).
- 3-system comparison table: plain LLM vs retrieval-only vs full LoomGuard (Step 12). Strongest demo story.
- Recheck after every fix; cap retries; kit-scoped retrieval; honest limitations.
- Demo order: show source understood -> show a violation with evidence -> fix + recheck -> show measured results.
SKIPPED on purpose (not worth it in 47 hours, or conflicts with our plan):
- Content GENERATION (captions etc.): our Round 1 plan says LoomGuard checks, not writes. Building it would drift from the plan and cost points under "progress from Round 1".
- Cross-encoder reranker, HyDE/query expansion, knowledge graph, agentic loops, PostgreSQL/pgvector migration, Ragas library. Only add one if an eval shows a measurable retrieval failure. Custom eval script is enough.
- Full rule-precedence/conflict engine. Minimal version only: if two retrieved rules disagree, set `needs_review:true`. Full engine = future work.
- Visual/logo geometry checks: Round 3 (image checker). Do not claim them in Round 2.
- Multi-brand tenancy: single kit with `kit_version` is enough for the demo.
LATER (Round 3 candidates if time): structured rule extraction with rule_ids, rule-conflict resolution, reranker if evals justify.

## 10. How a new AI should work
- Read sections 3, 4, 6 first. Follow design rules. Do one step at a time.
- After each step, report: what changed, exact verify commands, result. Do not claim done without running the verify.
- Do not add Round 3 features before step 14 passes.
- Never commit `.env` or keys.