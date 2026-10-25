# LoomGuard Independent Verification Dataset (NexusPay)

This directory contains a complete, independent brand governance test kit created to verify all features and edge cases of **LoomGuard** without relying on the default Aurora demo dataset.

---

## 1. Brand Scenario: NexusPay
**NexusPay** is an enterprise cross-border treasury and payments network.
- **Tone**: Authoritative, transparent, precise, professional.
- **Prohibited Words**: `unbreakable`, `disruptive`, `infinitely-scalable`, `rock-solid`, `bulletproof`.
- **Preferred Words**: `process` (instead of `synergize`), `merchants` (instead of `users`).
- **Brand Colors**: `#1E3A8A` (Deep Navy), `#0D9488` (Teal), `#F59E0B` (Amber).

---

## 2. Directory Structure
```
testing_data/
├── README.md               # This documentation
├── make_testing_data.py    # Python generator script (ReportLab)
├── brand_guide.pdf         # 6-page selectable brand & governance PDF
├── approved_facts.csv      # 12 approved facts (with expired & active entries)
├── terms.json              # Custom banned/preferred terminology rules
├── drafts/
│   ├── flawed_1.md         # Test draft with all violation types + security attack
│   ├── flawed_2.md         # Secondary flawed draft (claims, terms, expired fee)
│   ├── flawed_3.md         # Third flawed draft (contradicted claims & banned terms)
│   └── clean.md            # 100% compliant draft (zero false alarms)
└── test_pipeline.py        # Automated end-to-end Python test runner
```

---

## 3. Approved Facts in `approved_facts.csv`
| ID | Claim | Value | Unit | Source | Valid Until | Status |
|----|-------|-------|------|--------|-------------|--------|
| F01 | Network availability uptime | 99.95 | percent | Global SLA Report 2026 | 2027-12-31 | Current |
| F02 | Average settlement speed | 2.4 | seconds | Q3 Latency Audit | 2026-12-31 | Current |
| F03 | Annual transaction volume | 12 | billion USD | Annual Financial Report 2025 | 2026-12-31 | Current |
| F04 | Global partner banks | 65 | banks | Treasury Operations | 2026-12-31 | Current |
| F05 | Active enterprise merchants | 1200 | merchants | Customer Operations | 2026-12-31 | Current |
| F06 | Standard transaction fee | 1.2 | % per transaction | Fee Schedule v4 | 2027-06-30 | Current |
| F07 | Standard transaction fee (old) | 0.8 | % per transaction | Q1 2026 Promo Schedule | 2026-03-31 | **Expired** |
| F08 | Customer satisfaction rating | 4.8 | out of 5 | Enterprise NPS Survey 2026 | 2026-12-31 | Current |
| F09 | Supported currency corridors | 48 | countries | Compliance Directory | 2026-12-31 | Current |
| F10 | Compliance certifications | SOC 2 Type II | status | Deloitte Audit Letter | 2027-09-30 | Current |
| F11 | Direct clearing nodes | 8 | regions | Infrastructure Overview | 2027-12-31 | Current |
| F12 | Founded year | 2020 | year | Corporate Registry | 2099-12-31 | Current |

---

## 4. How to Run the Verification Pipeline

Make sure the LoomGuard backend is running (e.g. `uvicorn app.main:app --port 8000` from `backend/`), then execute:

```bash
python testing_data/test_pipeline.py
```

### What `test_pipeline.py` verifies:
1. **System Health & AI Connectivity**: Confirms `/api/health` and `/api/health/gemini` (embeddings and generation).
2. **Brand Kit Upload**: Multipart upload of `brand_guide.pdf` and `approved_facts.csv` to `POST /api/brand/upload`.
3. **Custom Terms Configuration**: Custom banned/preferred rules to `PUT /api/brand/terms`.
4. **Multi-Category Violation Detection**:
   - `TERMINOLOGY`: Banned (`disruptive`, `unbreakable`) and preferred (`users` -> `merchants`).
   - `CLAIM (CONTRADICTED)`: Uptime 99.99% vs 99.95%, latency 0.5s vs 2.4s.
   - `CLAIM (OUTDATED)`: Expired 0.8% transaction fee with current 1.2% suggested fix.
   - `CLAIM (UNSUPPORTED)`: Superlative `#1 payments network` marked unverified.
   - `TONE`: Casual tone / slang ("Yo bro").
   - `SECURITY`: Prompt-injection attack flagged and isolated.
5. **Interactive Fixes**: Accepting a fix replaces only that phrase in-place, shifts subsequent offsets, and triggers auto-recheck.
6. **Exception Workflow**: Marking an issue as `exception_requested` with custom audit note.
7. **Submission Gate**: Confirms draft submission is blocked (HTTP 409 `OPEN_MANDATORY_ISSUES`) when mandatory issues remain open.
8. **Clean Draft Verification**: Confirms `clean.md` returns **0 false alarms**.
9. **RBAC & Governance**:
   - Creator cannot approve draft (HTTP 403 `MANAGER_ONLY`).
   - Manager approval transitions status to `APPROVED`.
10. **Insights Aggregation**: Verifies `/api/insights` records counts by category, status, and top rules.
