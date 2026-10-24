# LoomGuard: Pre-Publication Brand Review & Compliance

Team **KIZUNA** (RGUKT Basar) | Problem: *Intelligent Brand-Governance Platform* by Inkloom AI

LoomGuard is a pre-flight check for marketing content. A creator uploads a draft, LoomGuard checks it against the brand guide and approved facts, points to the exact page or row behind each issue, suggests small phrase-level fixes, and passes the draft to a manager for sign-off. It never rewrites a whole document and never decides whether a claim is *true*, only whether it is *supported* by approved sources.

This README is the working guide for the two of us building the Round 2 MVP. Read `ROADMAP.md` for the hour-by-hour plan.

---

## 1. Who owns what

| | Pradeep Sutrave | Shruthi Pallemoni |
|---|---|---|
| Area | Frontend, workflow, UX, demo data | Backend, AI/RAG, data |
| Folders | `frontend/`, `sample_kit/` | `backend/` |
| Builds | Brand Setup UI, Review Studio (split-pane highlighter, issue cards), submit/approve flow, comments, Insights charts | FastAPI routes, Mongo schemas, PDF/DOCX parsing, Chroma indexing, rule checks, claim checker, Gemini tone check, status machine |

**Rule:** only edit your own folder. If you need a change in the other's area, message them or open a short PR. Shared files (`README.md`, `ROADMAP.md`, `docs/contract.md`) are edited by either, in small commits.

## 2. Repository layout

```
loomguard/
├── README.md
├── ROADMAP.md
├── docs/
│   ├── contract.md            # issue object + endpoint list (source of truth)
│   └── changes_from_plan.md   # needed for the Round 2 form
├── sample_kit/
│   ├── brand_guide.pdf
│   ├── approved_facts.csv
│   └── drafts/                # flawed_1.md, flawed_2.md, flawed_3.md, clean.md
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, CORS, routers
│   │   ├── config.py          # env loading
│   │   ├── db.py              # Mongo client
│   │   ├── schemas.py         # Pydantic models (Issue, Draft, Comment...)
│   │   ├── routers/           # brand.py, drafts.py, reviews.py, insights.py
│   │   ├── services/
│   │   │   ├── parsing.py     # PDF / DOCX / MD -> text with offsets
│   │   │   ├── indexing.py    # chunk PDF + CSV -> ChromaDB
│   │   │   ├── rules_check.py # banned/preferred terms, readability (Python only)
│   │   │   ├── claims_check.py# extract claims -> retrieve -> UNSUPPORTED_CLAIM
│   │   │   ├── tone_check.py  # Gemini, phrase-only schema
│   │   │   └── runner.py      # asyncio.gather over all checks
│   ├── mocks/draft_response.json
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── pages/             # BrandSetup, Studio, ReviewQueue, Insights
    │   ├── components/        # Highlighter, IssueCard, DiffView (R3), StatusBadge
    │   ├── api/client.js
    │   └── mocks/
    ├── package.json
    └── .env.example
```

## 3. Setup (both of us, once)

**Prerequisites:** Python 3.11+, Node 20+, Git, a Gemini API key (Google AI Studio), a MongoDB Atlas free cluster.

```bash
git clone <repo-url> loomguard && cd loomguard
```

**Backend**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # then fill in the values
uvicorn app.main:app --reload --port 8000
```
Check: http://localhost:8000/docs should show the API docs.

`.env` values:
```
GEMINI_API_KEY=
MONGO_URI=
MONGO_DB=loomguard
CORS_ORIGINS=http://localhost:5173
SIMILARITY_THRESHOLD=0.55
```

**Frontend**
```bash
cd frontend
npm install
cp .env.example .env               # VITE_API_URL=http://localhost:8000
npm run dev
```
Open http://localhost:5173.

For local full-stack testing, start the backend separately at `http://localhost:8000` and keep the frontend's
`VITE_API_URL` set to that address. The production frontend build uses `frontend/.env.production` and connects to
the deployed Render API.

**Never commit `.env` or API keys.** Add them to `.gitignore` before the first commit.

## 4. The contract (read this before writing code)

The full version lives in `docs/contract.md`. Summary:

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

**Endpoints:** `POST /api/brand/upload`, `PUT /api/brand/terms`, `GET /api/brand`, `POST /api/drafts`, `GET /api/drafts/{id}`, `PATCH /api/drafts/{id}/issues/{iid}`, `POST /api/drafts/{id}/submit`, `POST /api/drafts/{id}/comments`, `POST /api/drafts/{id}/decision`, `GET /api/insights`.

If either of us wants to change the contract, update `docs/contract.md` first and tell the other.

## 5. How the checks work (the part judges will ask about)

1. **Python first.** Banned/preferred terms, readability, and later HEX/WCAG are plain code. They are fast, repeatable, and work even if Gemini is down.
2. **Two-step claim check.** Gemini only *extracts* claim spans (stats, prices, superlatives) from the draft. Our code then searches ChromaDB. If no retrieved chunk passes `SIMILARITY_THRESHOLD`, the claim is marked `UNSUPPORTED_CLAIM` by code, not by the model.
3. **Citations from metadata.** Page numbers and CSV row ids come from chunk metadata. Gemini never writes a citation.
4. **Phrase-only output.** The Pydantic schema accepts `original_phrase` and up to 3 `replacement_options`, so the model cannot return a rewritten document. Validate every response and drop anything that doesn't match the draft text.
5. **Fail soft.** Gemini calls have a 10 s timeout and one retry. On failure, return the Python results plus an "AI check unavailable" notice.
6. **Disclosure.** Every issue carries `source`, and the UI shows an "AI" or "Rule" tag.

## 6. Working agreement

**Git**
- `main` is always deployable. Work on `feat/<name>` branches: `feat/brand-upload`, `feat/studio-highlighter`.
- Commit small and often with clear messages. Judges can inspect commit history and timing, so steady commits from inside the build window matter.
- Open a PR for anything touching the other person's folder; otherwise merge your own work after a quick self-check.
- Pull `main` before starting each block.

**Parallel work trick:** Shruthi commits `backend/mocks/draft_response.json` in the first couple of hours. Pradeep builds the Studio against it. Backend wiring then becomes swapping one import.

**Sync points (10 minutes each):** Fri 9 AM, Fri 6 PM, Sat 9 AM, Sat 6 PM (full end-to-end run together).

**Disclosure (required by the event rules):** note in the final PDF which parts used AI assistance, which libraries/templates were used, and that Gemini 2.5 Flash is the external AI service. Keep a running list in `docs/changes_from_plan.md`.

## 7. MVP acceptance test (run on the deployed link)

1. Open the app. The demo brand kit is already loaded (or click "Load demo kit").
2. As Creator, upload `sample_kit/drafts/flawed_1.md` (or click "Try sample draft").
3. Within about 15 seconds see highlighted issues: a banned term, an unsupported claim, a tone issue, each with a page/row citation and 2 to 3 fix options.
4. Accept one fix: only that phrase changes. Request an exception on another with a note.
5. Submit. Status becomes IN_REVIEW.
6. Switch to Manager. Open the draft, add a comment, Approve. Status becomes APPROVED.
7. Open Insights: counts by category appear.
8. Upload `clean.md`: no (or almost no) issues.

If all eight pass on the live link in an incognito window, you are ready to submit.

## 8. Deployment

| Part | Where | Notes |
|---|---|---|
| Backend | Render or Railway | Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set the `.env` values as service env vars. Free tiers sleep, so open the URL before any demo |
| Frontend | Vercel or Netlify | Production builds use `frontend/.env.production`. Set `VITE_API_URL` in the hosting dashboard to override it. Add the frontend origin to backend `CORS_ORIGINS` if it is not already allowed |
| Database | MongoDB Atlas M0 | Allow the host's IPs (or 0.0.0.0/0 for the hackathon) |
| Vector store | ChromaDB inside the backend | Disk may reset on free hosting. Rebuild the index on startup from the chunks stored in Mongo |

Deploy the backend by Saturday afternoon at the latest. A working local build does not score; the link does.

## 9. Round 2 submission checklist

The form: https://forms.gle/gyRiHtQT3AnC3MdV6 (window closes **Sun 25 Oct, 10:00 AM IST**).

- [ ] Working project link (tested in incognito)
- [ ] Source-code repository link (public or judge-accessible)
- [ ] Updated project PDF (architecture, workflow, screenshots, what was built)
- [ ] List of completed features
- [ ] Technology and implementation details
- [ ] Changes made from the original plan (`docs/changes_from_plan.md`)
- [ ] Three major Round 3 improvements (see `ROADMAP.md` section 8)

## 10. Round 3 improvements (planned)

1. **Image banner and WCAG checker:** K-Means dominant colours, delta-E against brand palette, WCAG 2.1 contrast, Gemini Vision layout checks.
2. **Revision history, diff view and exception waivers:** versioned drafts, word-level side-by-side diff, manager grant/deny of exceptions with a recorded reason.
3. **Governance insights and local data masking:** mask confidential codenames before any AI call, flag "Potentially Unclear" rules from repeated violations and exceptions, export a compliance summary.

## 11. Known limits (be honest in the PDF)

- Scanned/image-only PDFs are not supported in Round 2 (text PDFs only).
- Roles are simplified (role switch or seeded users), not full authentication.
- LoomGuard checks whether a claim is *supported by approved sources*, not whether it is true in the world.
- A human always makes the final approval decision.
