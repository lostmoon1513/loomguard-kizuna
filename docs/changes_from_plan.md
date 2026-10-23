# Changes from the Round 1 plan (keep honest, update as you build)

| Round 1 plan | What we did | Why |
|---|---|---|
| PyMuPDF for PDFs | `pypdf` (pure Python) | Easy install and deploy on free hosts, page numbers still kept |
| ChromaDB vector store + BM25 library | Own small BM25 + numpy cosine index, fused with Reciprocal Rank Fusion; index rebuilt at startup from MongoDB | Free hosts have ephemeral disk, our data is small (tens of chunks), fewer moving parts. Vector part uses Gemini embeddings and falls back to BM25 only if unavailable |
| Cloudinary for assets | Deferred to Round 3 (image checker) | No images in Round 2 |
| Full role auth | Role switch (Creator / Manager) | Time. Manager-only approval still enforced by the API |
| LangGraph pipeline | TBD (asyncio.gather is the fallback) | Decide when Step 8 is built |

Reused code disclosure: none so far. Add anything copied from earlier projects here.
AI assistance disclosure: Claude (code and docs drafting), ChatGPT (planning advice), Gemini 2.5 Flash (runtime AI service).
