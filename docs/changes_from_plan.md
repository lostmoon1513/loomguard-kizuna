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