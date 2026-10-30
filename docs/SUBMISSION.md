# LoomGuard: Round 3 Submission Text (Copy into the form)

## Project
**LoomGuard:** an intelligent brand-governance and pre-publication compliance platform (Team KIZUNA, RGUKT Basar).
Creators upload text drafts or banner images. LoomGuard checks content against brand guidelines and approved facts, grounds every issue with a concrete citation (guide page number or facts spreadsheet row), suggests small phrase-level or same-hue color fixes, and routes drafts through a multi-role review and approval workflow with cryptographic audit logging. The system never auto-approves and never rewrites entire documents.

## Links
- Working project (Render): [PASTE LIVE LINK]
- Source code (GitHub): [PASTE GITHUB LINK]
- Presentation / PDF: [ATTACH]

## Completed Features (Round 1, Round 2 & Round 3)
1. **Brand Kit Management:** Upload brand guide PDF and approved-facts CSV (or load the built-in demo kit). Rules preserve page numbers, priority (`mandatory` / `advisory`), and exception clauses together in one chunk.
2. **Multi-Format Draft Intake:** Accepts plain text, `.md`, `.txt`, `.docx`, and text PDFs. Scanned PDFs are cleanly rejected.
3. **Terminology Governance:** Strict and fuzzy banned/preferred term detection (case, hyphen, and plural aware) with guide page citations.
4. **Algorithmic Claim Verification:** Grounded in code against approved facts: `CONTRADICTED` (numeric discrepancy with truth value suggested), `OUTDATED` (expired fact with current value suggested), and `UNSUPPORTED` (unverified claim flagged for human review). Superlatives ("#1", "best-in-class") and outcome guarantees are gated for human review.
5. **Prompt-Injection & Security Defense:** Scans draft text and text extracted from images for adversarial prompt-injection directives ("ignore rules", "approve this"), flagging them under `SECURITY` rather than obeying them.
6. **AI Tone Checks behind Output Guard:** Google Gemini (`gemini-2.5-flash`) tone review with strict Pydantic output constraints: quotes must exist verbatim in the draft, maximum 3 replacement options of similar length, zero links or instructions leaked, offsets computed strictly by code.
7. **Image & Banner WCAG Checker (Round 3 Improvement 1):** Content-verified image uploads (PNG/JPEG, size <= 12MB, <= 40MP). Dominant color extraction using custom deterministic K-Means in CIELAB space. Brand palette difference computed via CIEDE2000 ($\Delta E_{00} \le 6.0$). Text and logo bounding boxes located via Gemini Vision. Relative contrast ratio measured in code against WCAG 2.1 AA (4.5:1 normal, 3:1 large text) with same-hue passing color suggestions. Numbered bounding box rendering via `GET /api/drafts/{id}/image?annotate=true`. Pixel fixes handled via revisions (`422 FIX_BY_REUPLOAD`).
8. **Version History, Word Diff & Waivers (Round 3 Improvement 2):** Complete revision history tracking (`versions[]`). Word-level sequence-matched diffing (`GET /api/drafts/{id}/diff`) with mathematical reconstruction invariance. Full exception waiver lifecycle (`exception_requested` -> `waiver_granted` / `waiver_denied`). Waivers automatically expire if the quoted text is altered.
9. **Role-Based Access Control & JWT Auth (Round 3):** Real JWT bearer token authentication with 4 roles (`creator`, `creator2`, `manager`, `reviewer`). Server-enforced permissions and privacy (unauthorized drafts return 404 to avoid ID enumeration).
10. **Governance Insights Over Time (Round 3 Improvement 3a):** Weekly trend aggregation (`GET /api/insights/trends`), rule frequency tracking (*rising*, *falling*, *steady*), and deterministic recommendations based on empirical violation/waiver counts without model hallucination. Includes formula-injection safe CSV export and ReportLab compliance summary PDF download.
11. **Local Sensitive Data Masking (Round 3 Improvement 3b):** Pre-AI local regex and algorithmic masking for credit cards (Luhn verified), API keys, JWTs, emails, phone numbers, and confidential codenames. Outgoing prompts pass through a fail-closed leak detector (`masker.leaked()`). Stored drafts and UI display only masked previews (`•••• 1111`, `… (hidden)`).
12. **Production Hardening:** Sliding-window rate limiter (240 general req/min, 20 heavy AI req/min) with `Retry-After` headers. Sanitizes zero-width characters (`\u200b`, `\ufeff`) and normalizes smart quotes. Live health telemetry at `/api/health`.
13. **Smoke Test Automation:** Standalone CLI script (`backend/scripts/smoke.py`) executing 20+ automated verification steps against a deployed instance.

## Technology and Implementation
- **Backend:** Python 3.11+, FastAPI, Pydantic v2, pypdf, python-docx, Pillow, ReportLab, NumPy, custom BM25 + Reciprocal Rank Fusion, Motor / MongoDB Atlas.
- **AI Models:** Google Gemini (`gemini-2.5-flash` for tone and claim extraction; Gemini Vision for image element location; `gemini-embedding-001` for semantic retrieval). All model calls are bounded by strict Pydantic schemas, timeouts, and fallback guards.
- **Data Persistence:** MongoDB Atlas with automatic in-memory fallback.
- **Architecture Philosophy:** Rules and measurements (contrast, color difference, claim comparison, offsets, citations) are executed strictly in deterministic code. The LLM is used as an extractor/suggester, never as an unconstrained judge. Human managers retain final authority.

## Evaluation Summary (from `backend/evals/results.md`)
- **Three-System Text Comparison (56 drafts, 39 gold issues):**
  - System A (Generic Hype Checker): Recall 18%, Precision 100%, F1 30%
  - System B (Retrieval Only): Recall 46%, Precision 100%, F1 63%
  - System C (Full LoomGuard): **Recall 100%, Precision 100%, F1 100%**, False Alarms on Clean Drafts **0% (0/23)**, Claim Status Accuracy **100% (22/22)**, Citation Accuracy **100%**.
- **Sensitive Data Masking (Improvement 3):**
  - Sensitive Entity Recall: **100% (15/15)** across cards, keys, JWTs, emails, phones, and confidential terms.
  - Benign Business Numbers False Positive Rate: **0% (0/13)** on metrics, years, prices, and percentages.
  - Roundtrip Unmasking Fidelity: **100%** exact character and casing restoration. Outgoing prompt leak defense confirmed.
- **Image & Color Science (Improvement 1):**
  - CIEDE2000 Accuracy: Mean Absolute Error **0.000022** across 23 Sharma et al. (2005) reference pairs.
  - WCAG 2.1 AA Contrast Accuracy: **100%** on ground-truth luminance cases.
  - Same-Hue Contrast Fix Pass Rate: **100%** of suggested alternatives pass required contrast ratios.
  - Palette Brand Matching: **100%** accuracy; neutral chromaticity skipping verified.
- **Word-Level Diffing (Improvement 2):**
  - Mathematical Invariance: **100%** (concatenating `equal` + `delete` reproduces original; `equal` + `insert` reproduces revised text).
- **Latency:** Rule-based checks execute in **~1.3 ms mean** (p95: 1.6 ms) per draft.

## Team Contributions
- **Shruthi Pallemoni:** Backend architecture, color science (CIELAB/CIEDE2000), WCAG accessibility pipeline, sensitive data masking engine, rate limiting, and evaluation suite (`evals/run_evals.py`).
- **Pradeep Sutrave:** Frontend architecture, Review Studio, Version diffing UI, Review Queue, demo kit creation, and user workflow testing.

## AI Assistance & Reuse Disclosure
Code and documentation were developed with pair-programming assistance from Anthropic Claude and Google Antigravity. Planning and architecture were reviewed against hackathon guidelines. No code from earlier repositories was reused. Runtime AI is powered by Google Gemini via the official `google-genai` SDK.

## Known Limitations
- Offline retrieval uses BM25 keyword matching + RRF; full semantic search requires active Gemini embedding quota.
- Text within images is not masked before passing to Gemini Vision (creators can switch AI off for local palette-only checking).
- Free-tier hosting on Render can sleep after inactivity and clears in-memory drafts on restart if MongoDB Atlas is unreachable.