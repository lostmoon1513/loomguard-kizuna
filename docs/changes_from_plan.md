# Changes from the Round 1 plan

| Round 1 plan | What we built | Why |
|---|---|---|
| PyMuPDF for PDFs | `pypdf` (pure Python) | Installs and deploys easily on free hosts. Page numbers are still kept for citations. |
| ChromaDB vector store + BM25 library | Own BM25 + numpy cosine search, joined by Reciprocal Rank Fusion. Index is rebuilt at startup from the saved kit | Free hosts lose local disk; our data is tiny (a few dozen rules and facts); fewer moving parts. Vector search uses Gemini embeddings and falls back to keyword-only if unavailable. |
| "UNSUPPORTED_CLAIM when no similar fact" | Four claim statuses decided by code: SUPPORTED, CONTRADICTED (number differs), OUTDATED (fact expired), UNSUPPORTED | Similarity alone cannot tell a wrong number from a right one. Our evaluation shows retrieval-only finds 46% of issues, full pipeline 100% on our test set. |
| LangGraph pipeline | `asyncio.gather` runs Gemini checks in parallel after the rule checks | Simpler and easier to test; the graph had no branching that needed LangGraph. |
| Cloudinary for assets | Deferred to Round 3 (image checker) | No images in Round 2. |
| Role-based login | Role switch (Creator / Manager) sent as a header; the API enforces manager-only decisions | Time. Real authentication is a Round 3 item. |
| Gemini 2.5 Flash for AI | Model name is a setting (`GEMINI_MODEL`) | Models change; no code edit needed. |
| (not in plan) | Prompt-injection scan, output guard for AI replies, evaluation harness with a 3-system comparison, auto-loading demo kit, one-service deploy | Reliability and trust, which the judging criteria reward. |

## Changes & Additions in Round 3

| Feature / Component | What we built in Round 3 | Why |
|---|---|---|
| Cloudinary / Image store | Local memory + disk + MongoDB storage via Pillow | Avoids external cloud storage dependencies and API costs; keeps images self-contained and clean. |
| Image & Color Science | CIEDE2000 (Sharma 2005) + deterministic K-Means in CIELAB + WCAG 2.1 AA (4.5:1 / 3:1) | Rule N1: Measure strictly in deterministic code, never trust model hallucinations for pixel measurements. Gemini Vision only locates bounding boxes. |
| Role-based authentication | Cryptographic JWT Bearer tokens with 4 roles (`creator`, `creator2`, `manager`, `reviewer`) | Replaces the insecure header-based switch; enforces strict server-side RBAC and 404 anti-enumeration privacy. |
| Versioning & Diffing | Full revision history tree + word-level sequence matching diffing | Mathematical reconstruction invariance (`equal + delete = old`, `equal + insert = new`); tracks who changed what across reviews. |
| Waivers | Formal exception waiver lifecycle with auto-expiration on quote modification | Real-world compliance requires handling valid exceptions without lowering governance standards. |
| Data Masking | Pre-LLM reversible tokenization (cards via Luhn, API keys, emails, phones, codenames) | Privacy first: customer data and confidential project codenames never reach the model; fail-closed leak detector prevents prompt leaks. |
| Governance Insights | Weekly time-series aggregation, empirical trend velocity (*rising*, *falling*), deterministic fixed-rule recommendations, CSV & PDF export | Real compliance monitoring without LLM hallucinations; judges can download an official ReportLab compliance PDF summary. |
| Hardening | Sliding-window IP rate limiting (240 general, 20 heavy AI req/min) + zero-width and lookalike character normalization | Protects API quota against spam/runaway loops and prevents evasion of banned word checks. |