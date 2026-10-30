# LoomGuard Comprehensive Evaluation Results (Round 1, Round 2 & Round 3)

Test set: 56 drafts (23 clean, must give no issues), 39 hand-labelled issues. Rule-based checks only (AI off) so results are repeatable. Facts date fixed to 2026-10-24.

## 1. Core Workflow: Three Systems on the Same Test Set

| System | Precision | Recall | F1 | False alarms on clean drafts | Claim status accuracy | Citation accuracy | Fix accuracy |
|---|---|---|---|---|---|---|---|
| A: generic checker (no brand kit) | 100% | 18% | 30% | 0% (0/23) | 0% (22) | 0% (7) | n/a (0) |
| B: brand kit + retrieval only | 100% | 46% | 63% | 0% (0/23) | 36% (22) | 100% (9) | 100% (2) |
| C: full LoomGuard | 100% | 100% | 100% | 0% (0/23) | 100% (22) | 100% (23) | 100% (14) |

Full LoomGuard claim status by type: {'CONTRADICTED': '11/11', 'OUTDATED': '3/3', 'UNSUPPORTED': '8/8'}. Predicted issue offsets exact: 100%.

## 2. Hybrid Retrieval (finding the right guide page or facts row)

32 paraphrased questions, mode: keyword (BM25) only. Hit@1 94%, Hit@3 97%, MRR 0.95.

Misses (honest failures):

- "are we allowed to say we are number one" (guide): expected [4], got [3]

## 3. Guardrails & Injection Defense

- Prompt-injection scan: caught 100% of 8 attack texts; wrongly flagged 0% of 6 harmless texts.
- Tone output guard: 5 bad model outputs (made-up phrase, link, 'approve' text, oversized, empty). Kept 2 phrases, 0 bad replacements leaked; a valid suggestion was kept: True.

## 4. Sensitive Data Masking & Local Privacy (Round 3 Improvement 3)

- Sensitive entity recall: **100%** across 15 items (Cards with Luhn check, API keys, JWTs, Emails, Phones, Confidential codenames).
- Breakdown by entity kind: {'card': '2/2', 'confidential': '3/3', 'email': '2/2', 'key': '6/6', 'phone': '2/2'}.
- Benign numbers / false positives: **0%** on 13 business metrics (years, prices, percentages, counts).
- Roundtrip unmasking fidelity: **100%** (exact character and casing restoration).
- Prompt leak defense: verified = True (fail-closed if an unmasked secret appears in prompt).
- Preview security: credit cards and API keys are stored only with masked previews (`•••• 1111`, `… (hidden)`).

## 5. Image Checker & WCAG Accessibility (Round 3 Improvement 1)

- CIEDE2000 colour science: verified against 23 Sharma et al. (2005) reference pairs. Mean Absolute Error: **0.000022** (max error 0.000042).
- WCAG 2.1 AA contrast accuracy: **100%** across 7 luminance test cases (including 4.5:1 normal and 3:1 large text standards).
- Same-hue contrast fix suggestions: **100%** of failing text colors were adjusted to passing alternatives while maintaining original hue.
- Palette brand matching: **100%** across brand matching, near-brand delta-E <= 6.0, off-brand rejection, and neutral chroma skipping.
- Synthetic test banners: On-brand banner produced **0** color issues; Off-brand banner flagged **COLOUR** issue with region bounding box.
- Input validation: Content-based image verification rejected **2/2** non-image and corrupt files.

## 6. Word-Level Diffing & Versions (Round 3 Improvement 2)

- Word diff mathematical invariance: **100%** across 5 edit progressions.
- Concatenating `equal` + `delete` operations reproduces original text exactly; `equal` + `insert` reproduces revised text exactly.

## 7. Performance & Latency

Rule-based text checks: Mean 1.3 ms, p95 1.6 ms, max 1.8 ms per draft.
Image analysis (K-Means in Lab + CIEDE2000): ~150-250 ms. AI calls add network time.

## 8. What this evaluation found (and what we changed)

- **Code bug, fixed:** a year followed by a comma ("Founded in 2019, Aurora") was read as a claim. The number pattern swallowed the comma. Regression cases x01, x02.
- **Code bug, fixed:** the prompt-injection patterns were too broad ("Please do not check back later" and "You are now part of the community" were flagged). Patterns now need an instruction-like target. Regression cases x03, x04.
- **Masking preview leak bug, fixed:** initial masking summary retained raw card numbers and secret keys in the stored draft. Masking previews were updated to display partial previews (`•••• 1111`) and secrets never persist in plaintext.
- **Test isolation, fixed:** HTTP test state pollution between image draft upload and insights trends was resolved with explicit store clearing.
- **Text normalisation, added:** lookalike characters, smart quotes, and zero-width spaces are stripped before evaluation, preventing evasion of banned terms.

## 9. Limitations (read before trusting the numbers)

- Test sets are crafted by the team and focus on verifying that algorithmic rules behave with mathematical precision under known edge cases.
- Retrieval is keyword-only offline (BM25 + RRF); full semantic search requires Gemini embedding access.
- Image text detection relies on Gemini Vision for bounding boxes, while contrast and palette science are computed entirely in Python code.
