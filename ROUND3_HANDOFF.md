# LoomGuard: Round 3 Handoff & Judge Documentation
**Event:** Inkloom AI Hackathon  
**Team:** KIZUNA (RGUKT Basar)  
**Platform:** LoomGuard – Intelligent Brand Governance & Pre-Publication Compliance Platform  

---

## 1. Executive Summary & Round 3 Achievements

All three planned Round 3 backend improvements and system hardening have been fully designed, implemented, and verified:
- **143 / 143 Unit, Integration, and HTTP Test Cases Pass (100%)**
- **Comprehensive Evaluation Suite Passing:** Covers text rules, retrieval, guardrails, sensitive data masking, color science, WCAG accessibility, and diffing invariance.
- **Production-Ready Hardening:** Sliding-window IP rate limiting, zero-width/lookalike text sanitization, health telemetry for AI quota & persistence.
- **Judge Automation:** Single-command end-to-end smoke test script (`backend/scripts/smoke.py`).

| Round 3 Improvement | Status | Key Modules |
|---|:---:|---|
| **Improvement 1: Image & Banner Checker + WCAG 2.1 AA Accessibility** | **COMPLETE** | `backend/app/services/color_science.py`<br>`backend/app/services/image_check.py`<br>`backend/app/services/image_store.py` |
| **Improvement 2: Version History, Word Diff & Exception Waivers** | **COMPLETE** | `backend/app/services/diffing.py`<br>`backend/app/services/accounts.py`<br>`backend/app/services/draft_ops.py` |
| **Improvement 3: Governance Insights over Time & Sensitive Data Masking** | **COMPLETE** | `backend/app/services/insights.py`<br>`backend/app/services/masking.py`<br>`backend/app/routers/drafts.py` |
| **Hardening & Stability** | **COMPLETE** | `backend/app/ratelimit.py`<br>`backend/scripts/smoke.py`<br>`backend/app/main.py` |

---

## 2. Technical Architecture of the Three Improvements

### Improvement 1: Image & Banner Checker with WCAG 2.1 AA Accessibility
- **Content-Based Validation:** Validates PNG and JPEG formats via file headers/magic bytes (not file extensions), prevents decompression bombs (> 40 MP refused), enforces bounds (64px to 1600px).
- **Mathematical Color Science (CIELAB & CIEDE2000):**
  - Converts sRGB to D65-referenced CIELAB space.
  - Implements custom deterministic K-Means clustering in Lab space to extract dominant color palettes.
  - Compares colors to brand hex codes using CIEDE2000 (`color_science.ciede2000`). Distances $\le 6.0\ \Delta E_{00}$ count as on-brand.
  - Ignores neutral chromaticity (`NEUTRAL_CHROMA = 10.0`), preventing white, black, and grey from being flagged as off-brand.
- **WCAG 2.1 AA Accessibility Measurement:**
  - Gemini Vision locates text and logo bounding boxes (`region: {x, y, w, h}`).
  - Color contrast is measured **strictly in Python code** (relative luminance calculation) against WCAG 2.1 AA standards: **4.5:1** for regular text and **3.0:1** for large text ($\ge 24\text{px}$ or $\ge 18.66\text{px}$ bold).
  - Generates same-hue passing replacement suggestions (`suggest_passing_colour`) by adjusting lightness along the same chroma/hue vector.
- **Image Security & Prompt Injection Defense:** Text detected inside image banners is scanned for adversarial prompt injection directives; malicious instructions are flagged under `SECURITY` rather than obeyed.
- **Visual Annotations & Re-upload Workflow:**
  - `GET /api/drafts/{id}/image?annotate=true` returns the PNG banner with numbered bounding box overlays matching issue IDs (`iss_01`, `iss_02`).
  - Pixel modifications cannot be blindly auto-accepted: returns `422 FIX_BY_REUPLOAD`, routing creators to upload a revised image via `POST /api/drafts/{id}/revisions`.

### Improvement 2: Version History, Word Diff & Exception Waiver Workflow
- **Version Tree Tracking:** Every draft maintains a complete revision ledger (`versions[]` storing timestamp, author, role, issue counts, and character lengths). Full text is protected and retrievable via `GET /api/drafts/{id}/versions/{n}`.
- **Mathematical Word-Level Diffing (`diffing.py`):**
  - Token-level sequence matcher generating `equal`, `insert`, and `delete` operations with trimmed common prefix/suffix optimization.
  - **Invariance Guarantee:** Concatenating `equal` + `delete` produces original text; concatenating `equal` + `insert` produces revised text.
- **Formal Exception Waiver Lifecycle:**
  - Creators request an exception (`action: "request_exception"`, reason note required), setting issue status to `exception_requested`.
  - While open mandatory issues block draft submission (`409 OPEN_MANDATORY_ISSUES`), requested exceptions allow submission into `IN_REVIEW`.
  - Managers can grant or deny waivers on any issue; Reviewers can grant/deny waivers on `CLAIM` issues.
  - Denials return issues to `open` with reason recorded; grants set issue to `waived`.
  - **Waiver Expiration:** Waivers bind strictly to the quoted phrase. If a creator subsequently edits the quoted text, the waiver expires (`waiver_expired` in audit log).
- **JWT Authentication & Role-Based Access Control (RBAC):**
  - Real JWT bearer token authentication (`/api/auth/login`, `/api/auth/demo-accounts`).
  - Strict server-side role enforcement for `creator`, `creator2`, `manager`, and `reviewer`.
  - Draft privacy: creators see only their drafts; reviewers and managers see submitted drafts (`404 DRAFT_NOT_FOUND` prevents ID harvesting).

### Improvement 3: Governance Insights over Time & Sensitive Data Masking
- **Sensitive Data Masking & Local Privacy (`masking.py`):**
  - Local regex and algorithmic scanners identify credit card numbers (validated via Luhn algorithm), API keys (Google AIza, OpenAI sk-, GitHub tokens, Slack tokens, AWS keys, JWTs), email addresses, phone numbers, and manager-configured confidential brand terms.
  - Sensitive values are replaced with reversible tokens (`CONF_001`, `CARD_001`, `KEY_001`) before any prompt is dispatched to Gemini.
  - **Fail-Closed Last Line of Defense:** `masker.leaked()` verifies no raw sensitive string exists in outgoing prompts; if a leak is detected, the AI call is aborted.
  - **Safe Previews:** Database summaries and API responses retain only masked previews (`•••• 1111`, `… (hidden)`, `j***@example.com`).
- **Governance Insights Over Time (`insights.py`):**
  - `GET /api/insights/trends` computes weekly volume, issue rates, waiver grants vs denials, and review turnaround times.
  - Classifies rule frequency velocity (*rising*, *falling*, *steady*).
  - Deterministic recommendation engine: outputs actionable guidance based purely on empirical thresholds (e.g. high exception rate on a rule triggers a recommendation to clarify the brand guide). Zero model hallucination.
  - Formula injection-resistant CSV export (`/api/insights/export.csv`) and downloadable compliance PDF summary (`/api/insights/report.pdf`).
  - Demo history generator (`POST` / `DELETE /api/demo/history`) adding/removing 14 labelled `[DEMO]` drafts.

---

## 3. System Hardening & Operational Resilience

1. **Sliding-Window IP Rate Limiter (`backend/app/ratelimit.py`):**
   - General API endpoints: 240 requests/minute per client IP.
   - Heavy AI endpoints (`/api/drafts`, `/api/drafts/image`, `/revisions`, `/recheck`): 20 requests/minute per client IP.
   - Exceeding limit returns `429 RATE_LIMITED` with integer `Retry-After` header.
   - Static assets and read health endpoints are unthrottled.
2. **Text Normalization & Anti-Evasion Sanitization:**
   - Strips zero-width characters (`\u200b`, `\ufeff`, `\u2060`) to prevent banned word evasion (`best​-in-class`).
   - Normalizes lookalikes, non-breaking hyphens (`\u2011`), non-breaking spaces (`\u00a0`), and smart quotes (`“ ” ‘ ’` $\rightarrow$ `" '`).
   - Offsets remain aligned with the sanitized text.
3. **Health & Telemetry Monitoring (`GET /api/health`):**
   - Reports persistence status (`mongodb` or `memory`).
   - Reports AI quota circuit-breaker pause status and last error message.
   - Reports memory footprint (`drafts_in_memory`).

---

## 4. Comprehensive Evaluation Benchmark Results

Evaluations run deterministically offline (no AI dependencies required for scoring):

```
cd backend
python -m evals.run_evals
```

### Key Metrics Summary (from `backend/evals/results.md`)

| Category | Metric | Score / Result | Benchmark / Target |
|---|---|:---:|---|
| **Text Workflow (System C)** | Violation Precision | **100%** | Baseline System A: 18% |
| | Violation Recall | **100%** | Baseline System B: 46% |
| | False Alarms on Clean Drafts | **0% (0/23)** | Must be 0% |
| | Claim Status Accuracy | **100% (22/22)** | Contradicted, Outdated, Unsupported |
| | Citation Accuracy | **100%** | Page number & CSV row |
| **Hybrid Retrieval** | BM25 Hit@1 / Hit@3 | **94% / 97%** | 32 paraphrased queries, MRR 0.95 |
| **Guardrails & Security** | Prompt Injection Recall | **100% (8/8)** | Harmless benign texts flagged: 0% |
| | Tone Guard Replacements Leaked | **0 leaked** | Rejects links, oversized, or prompt injections |
| **Data Masking (R3)** | Sensitive Entity Recall | **100% (15/15)** | Cards, keys, JWTs, emails, phones, codenames |
| | Benign Business Metrics FP Rate | **0% (0/13)** | Preserves prices ($24), years (2019), % (99.99%) |
| | Roundtrip Restoration Accuracy | **100%** | Exact character and casing restoration |
| | Outgoing Prompt Leak Defense | **Verified** | Fail-closed mechanism confirmed |
| **Color Science (R3)** | CIEDE2000 Mean Absolute Error | **0.000022** | Sharma et al. (2005) 23 test pairs |
| | CIEDE2000 Max Error | **0.000042** | Matches published standard to 4 decimals |
| **WCAG Accessibility (R3)**| Contrast Ratio Accuracy | **100%** | Verified against 7 ground-truth luminance cases |
| | Same-Hue Contrast Suggestion | **100% Pass** | Adjusts lightness while preserving hue |
| | Brand Palette & Neutral Rules | **100%** | Flags off-brand, matches near-brand, ignores greys |
| **Diffing (R3)** | Mathematical Invariance | **100%** | `equal` + `delete` = old; `equal` + `insert` = new |
| **Performance** | Rule-Based Draft Latency | **~1.3 ms mean** | p95 = 1.6 ms |

---

## 5. Judge Verification Guide (Smoke Testing)

To verify a running LoomGuard backend instance in one command:

```bash
# Against local instance:
python backend/scripts/smoke.py http://localhost:8000

# Against deployed Render instance (default uses demo credentials):
python backend/scripts/smoke.py https://<your-render-app>.onrender.com

# Optionally test live Gemini calls with active quota:
python backend/scripts/smoke.py https://<your-render-app>.onrender.com --ai
```

### What `smoke.py` Automatically Validates:
1. Health endpoint, persistence status, and `legacy_header_auth == false`.
2. Rejection of unauthenticated requests (`401 UNAUTHENTICATED`).
3. Rejection of fake header authentication (`401`).
4. Rejection of incorrect login credentials (`401 INVALID_CREDENTIALS`).
5. Successful login for all 4 demo personas (`creator`, `creator2`, `manager`, `reviewer`).
6. Kit loading and RBAC protection (creator cannot load kit).
7. Input boundary checking (empty draft, non-image uploads rejected).
8. Text draft creation and isolation (creator2 and manager cannot access private draft).
9. Submission blocked by open mandatory issues (`409 OPEN_MANDATORY_ISSUES`).
10. Exception request flow and optimistic concurrency check (`409 STALE_REVISION`).
11. Double-submission prevention (`409`).
12. Manager approval gates blocked by pending exceptions (`409 PENDING_EXCEPTIONS`).
13. Manager waiver granting and approval transition to `APPROVED`.
14. Audit trail logging of all lifecycle events.
15. Image banner upload, color finding extraction, annotated image generation (`GET ...?annotate=true`), and duplicate re-upload rejection (`409 NO_CHANGE`).
16. Trends retrieval, compliance PDF summary download, and reviewer/creator access controls.

---

## 6. Frontend Integration Guide (for Pradeep)

The updated API contract is fully documented in [`docs/contract_v2.md`](file:///c:/Users/RGUKT/Documents/loomguard-kizuna/docs/contract_v2.md).

### Summary of Frontend Actions:
1. **Authentication:**
   - Update `client.js` to send `Authorization: Bearer <token>` instead of `X-Role` / `X-User`.
   - Add a login view using `GET /api/auth/demo-accounts` for one-click demo logins.
2. **Image Checker Studio:**
   - Support file upload to `POST /api/drafts/image`.
   - Display the image with an annotation toggle (`GET /api/drafts/{id}/image?annotate=true`).
   - Display color palette findings and WCAG contrast issues with same-hue suggested fix swatches.
   - For pixel fixes, route users to upload a revision (`POST /api/drafts/{id}/revisions`) handling `422 FIX_BY_REUPLOAD`.
3. **Versions & Word Diff:**
   - Add version dropdown (`GET /api/drafts/{id}/versions`).
   - Add word-diff viewer using `GET /api/drafts/{id}/diff?from=A&to=B`.
4. **Waiver & Review Workflow:**
   - Creator: "Request Exception" button prompting for a reason note.
   - Manager / Reviewer: "Grant Waiver" and "Deny Waiver" modal (`POST /api/drafts/{id}/issues/{iid}/waiver`).
5. **Data Masking Banner:**
   - When `draft.mask_summary.count > 0`, display a banner: *"N confidential values were masked before AI checks"* with preview chips (`•••• 1111`, `… (hidden)`).
6. **Governance Insights:**
   - Render weekly trends charts (`GET /api/insights/trends`).
   - Display recommendation cards showing evidence counts.
   - Provide "Load Demo History" and "Download Compliance PDF" buttons.

---

## 7. Render Deployment Checklist

1. **Environment Variables on Render:**
   - `JWT_SECRET`: Generate a secure random string (e.g. `openssl rand -hex 32`).
   - `TOKEN_HOURS`: `12`
   - `SEED_DEMO_USERS`: `true`
   - `DEMO_PASSWORD`: `loomguard-demo` (or custom team password).
   - `LEGACY_HEADER_AUTH`: Set to `false` for final submission. *(Can be set to `true` temporarily if frontend is still testing with legacy headers).*
   - `MONGO_URI`: MongoDB Atlas connection string (verify Atlas IP allowlist allows `0.0.0.0/0`).
   - `GEMINI_API_KEY`: API key with active Google GenAI quota.
   - `RATE_LIMIT`: `true`
2. **Post-Deploy Step:**
   Run `python backend/scripts/smoke.py https://<your-render-url>` to confirm clean execution across all 20+ checks.
