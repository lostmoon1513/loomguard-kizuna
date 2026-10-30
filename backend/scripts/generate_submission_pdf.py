"""Generate the publication-grade LoomGuard Round 3 Submission PDF for Team KIZUNA.

Produces: KIZUNA_Round_3_LoomGuard_Submission.pdf in the workspace root.
Designed as a tight, perfectly balanced 4-page executive briefing.
"""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to compute total page count and draw running header/footer."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            if self._pageNumber > 1:
                self.draw_header()
            self.draw_footer(num_pages)
            super().showPage()
        super().save()

    def draw_header(self):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#1E3A8A"))
        self.drawString(18 * mm, 285 * mm, "LOOMGUARD")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(42 * mm, 285 * mm, "|   Round 3 Final Submission — Team KIZUNA (RGUKT Basar)")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.6)
        self.line(18 * mm, 282 * mm, 192 * mm, 282 * mm)
        self.restoreState()

    def draw_footer(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(18 * mm, 11 * mm, "Inkloom AI Hackathon 2026  •  LoomGuard: Pre-Publication Brand Governance")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(192 * mm, 11 * mm, page_text)
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.6)
        self.line(18 * mm, 14 * mm, 192 * mm, 14 * mm)
        self.restoreState()


def build_pdf(out_path: Path):
    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="LoomGuard: Round 3 Final Submission (Team KIZUNA)",
        author="Shruthi Pallemoni & Pradeep Sutrave",
        subject="Inkloom AI Hackathon - Final Round Product Submission",
    )

    base = getSampleStyleSheet()

    c_primary = colors.HexColor("#1E3A8A")     # Indigo/Navy
    c_secondary = colors.HexColor("#0D9488")   # Teal
    c_dark = colors.HexColor("#0F172A")        # Slate 900
    c_body = colors.HexColor("#334155")        # Slate 700
    c_card_bg = colors.HexColor("#F8FAFC")     # Slate 50
    c_border = colors.HexColor("#E2E8F0")

    title_style = ParagraphStyle(
        "CoverTitle",
        parent=base["Title"],
        fontName="Helvetica-Bold",
        fontSize=21,
        leading=24,
        textColor=c_primary,
        alignment=0,
        spaceAfter=2,
    )

    subtitle_style = ParagraphStyle(
        "CoverSubtitle",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=14,
        textColor=c_secondary,
        spaceAfter=8,
    )

    h1_style = ParagraphStyle(
        "CustomH1",
        parent=base["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=c_primary,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True,
    )

    h2_style = ParagraphStyle(
        "CustomH2",
        parent=base["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=12.5,
        textColor=c_dark,
        spaceBefore=6,
        spaceAfter=2,
        keepWithNext=True,
    )

    body_style = ParagraphStyle(
        "CustomBody",
        parent=base["BodyText"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11.5,
        textColor=c_body,
        spaceAfter=4,
    )

    bullet_style = ParagraphStyle(
        "CustomBullet",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=c_body,
        leftIndent=10,
        firstLineIndent=-6,
        spaceAfter=2,
    )

    callout_style = ParagraphStyle(
        "CalloutText",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=c_dark,
    )

    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.white,
    )

    table_cell_style = ParagraphStyle(
        "TableCell",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=c_body,
    )

    table_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=c_dark,
    )

    story = []

    # =========================================================================
    # PAGE 1: TITLE, META, EXECUTIVE SUMMARY, 3 ROUND 3 COMMITMENTS
    # =========================================================================
    story.append(Paragraph("LOOMGUARD", title_style))
    story.append(Paragraph("Pre-Publication Brand Governance & Compliance Platform", subtitle_style))

    # Meta table
    meta_info = [
        [Paragraph("<b>Team:</b> KIZUNA (RGUKT Basar)", table_cell_style),
         Paragraph("<b>Event:</b> Inkloom AI Hackathon (Round 3 — Final)", table_cell_style)],
        [Paragraph("<b>Authors:</b> Shruthi Pallemoni & Pradeep Sutrave", table_cell_style),
         Paragraph("<b>Date:</b> October 30, 2026", table_cell_style)],
        [Paragraph("<b>Live App (Vercel):</b> https://loomguard-kizuna.vercel.app/", table_cell_style),
         Paragraph("<b>Live API (Render):</b> https://loomguard-kizuna-6cra.onrender.com/", table_cell_style)],
        [Paragraph("<b>Source Code (GitHub):</b> https://github.com/lostmoon1513/loomguard-kizuna", table_cell_style),
         Paragraph("<b>API Docs:</b> https://loomguard-kizuna-6cra.onrender.com/docs", table_cell_style)],
    ]
    meta_table = Table(meta_info, colWidths=[87 * mm, 87 * mm])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), c_card_bg),
        ("BOX", (0, 0), (-1, -1), 0.6, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, c_border),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 5))

    # Summary box
    summary_text = (
        "<b>Executive Summary:</b> LoomGuard is an intelligent brand-governance platform that enforces corporate "
        "guidelines before publication. Creators upload multi-format text drafts (.md, .docx, .pdf, text) or banner images "
        "(PNG, JPEG). LoomGuard validates them against uploaded brand guides and approved factual claim sheets. "
        "<b>Core Design Principle:</b> Measurements, rule matches, color distances, and citations are executed strictly in "
        "deterministic Python code. Google Gemini (2.5 Flash / Vision) is utilized strictly for extraction, tone review under "
        "schema constraints, and visual bounding boxes. The system <i>never</i> auto-approves and <i>never</i> rewrites text "
        "unprompted, preserving complete human editorial sovereignty."
    )
    sum_table = Table([[Paragraph(summary_text, callout_style)]], colWidths=[174 * mm])
    sum_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EFF6FF")),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#BFDBFE")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(sum_table)
    story.append(Spacer(1, 6))

    # Commitments
    story.append(Paragraph("1. Delivering the Three Round 3 Commitments", h1_style))
    story.append(Paragraph(
        "At Round 2, Team KIZUNA committed to exactly three core improvements for Round 3. "
        "All three have been engineered, deployed to production, and benchmarked against ground truth:",
        body_style,
    ))

    # Imp 1
    story.append(Paragraph("Improvement 1: Image Banner & WCAG 2.1 AA Accessibility Checker", h2_style))
    story.append(Paragraph("• <b>Dual-Engine Color Science:</b> Deterministic K-Means color clustering in CIELAB space with Sharma et al. (2005) CIEDE2000 color difference (Delta E &le; 6.0 threshold) against official brand palettes.", bullet_style))
    story.append(Paragraph("• <b>WCAG 2.1 AA Contrast Ratio:</b> Computes relative luminance L1/L2 in Python, verifying text and background contrast against standard 4.5:1 (normal text) and 3.0:1 (large text) thresholds.", bullet_style))
    story.append(Paragraph("• <b>Same-Hue Passing Suggestions:</b> When contrast fails, algorithmic lightness stepping computes the closest passing color within the exact same hue angle and saturation.", bullet_style))
    story.append(Paragraph("• <b>Gemini Vision Bounding Boxes & Annotation:</b> Identifies text regions and logos with [ymin, xmin, ymax, xmax] coordinates. The endpoint <code>GET /api/drafts/{id}/image?annotate=true</code> renders high-resolution numbered overlays.", bullet_style))
    story.append(Paragraph("• <b>Safe Re-upload Lifecycle:</b> Banner pixel edits cannot be applied as text strings; LoomGuard returns <code>422 FIX_BY_REUPLOAD</code>, cleanly preserving revision tracking.", bullet_style))

    # Imp 2
    story.append(Paragraph("Improvement 2: Version Diff History & Exception Waiver Lifecycle", h2_style))
    story.append(Paragraph("• <b>Word-Level Diff Engine:</b> High-resolution diffing via Python <code>difflib.SequenceMatcher</code> returning <code>equal</code>, <code>insert</code>, <code>delete</code>, and <code>replace</code> opcodes. Guaranteed 100% mathematical reconstruction invariance.", bullet_style))
    story.append(Paragraph("• <b>Formal Exception Waiver Workflow:</b> Creators request exceptions with required justification notes (<code>exception_requested</code>). Managers/Reviewers can grant or deny waivers with an audit trail.", bullet_style))
    story.append(Paragraph("• <b>Auto-Expiring Waivers:</b> If a creator alters the quoted text of a granted waiver in a subsequent revision, the waiver automatically expires and triggers fresh validation.", bullet_style))
    story.append(Paragraph("• <b>Cryptographic JWT RBAC:</b> 4 distinct roles (<code>creator</code>, <code>creator2</code>, <code>reviewer</code>, <code>manager</code>) secured with HMAC-SHA256 tokens and strict tenant isolation (unauthorized requests yield 404 to block ID enumeration).", bullet_style))

    # Imp 3
    story.append(Paragraph("Improvement 3: Governance Insights Over Time & Pre-LLM Sensitive Data Masking", h2_style))
    story.append(Paragraph("• <b>Empirical Weekly Trend Analytics:</b> Aggregates draft volume, violation frequencies, and approval velocity across 8-week sliding windows. Velocity slope identifies <i>rising</i>, <i>falling</i>, or <i>steady</i> compliance friction.", bullet_style))
    story.append(Paragraph("• <b>Deterministic Policy Recommendations:</b> Automatically surfaces 'Potentially Unclear Rules' based on high repeat violations and granted waiver ratios—without relying on hallucinated LLM feedback.", bullet_style))
    story.append(Paragraph("• <b>Pre-LLM Data Masking Engine:</b> Reversible regex/Luhn engine masks Credit Cards (13-19 digits), API Keys, JWTs, emails, phone numbers, and confidential project codenames before external API transit.", bullet_style))
    story.append(Paragraph("• <b>Fail-Closed Leak Defense & Preview Security:</b> Outgoing prompts are checked against <code>masker.leaked()</code>. Stored drafts and UI inspect screens display only masked previews (e.g. <code>•••• 1111</code>).", bullet_style))
    story.append(Paragraph("• <b>Export Facilities:</b> Formula-injection-safe CSV export and standalone ReportLab compliance PDF generation.", bullet_style))

    story.append(PageBreak())

    # =========================================================================
    # PAGE 2: FULL FEATURES MATRIX & SYSTEM ARCHITECTURE
    # =========================================================================
    story.append(Paragraph("2. Complete Matrix of Built Features", h1_style))

    features_data = [
        [Paragraph("Feature Area", table_header_style), Paragraph("Component & Technical Implementation", table_header_style), Paragraph("Status", table_header_style)],
        [Paragraph("Brand Kit Engine", table_cell_bold), Paragraph("PDF guide parsing (PyMuPDF/pypdf) + Approved Facts CSV parser. Preserves page numbers, priority (mandatory/advisory), and exception clauses.", table_cell_style), Paragraph("Production", table_cell_style)],
        [Paragraph("Draft Intake", table_cell_bold), Paragraph("Accepts plain text, Markdown, .txt, .docx, and digital PDFs. Zero-width character sanitizer and curly quote normalizer.", table_cell_style), Paragraph("Production", table_cell_style)],
        [Paragraph("Terminology Check", table_cell_bold), Paragraph("Strict and fuzzy hyphen/case/plural-aware banned/preferred terms with guide page citations.", table_cell_style), Paragraph("Production", table_cell_style)],
        [Paragraph("Fact Verification", table_cell_bold), Paragraph("Algorithmic fact-sheet verification: CONTRADICTED (numerical delta), OUTDATED (expired), UNSUPPORTED (unverified), plus superlative gating.", table_cell_style), Paragraph("Production", table_cell_style)],
        [Paragraph("Security Guard", table_cell_bold), Paragraph("Prompt-injection defense scanning text and image OCR for adversarial directives ('ignore rules', 'approve this').", table_cell_style), Paragraph("Production", table_cell_style)],
        [Paragraph("AI Tone Review", table_cell_bold), Paragraph("Google Gemini 2.5 Flash bounded by strict Pydantic output schemas, verbatim quote checks, and 10s timeouts.", table_cell_style), Paragraph("Production", table_cell_style)],
        [Paragraph("Image & WCAG", table_cell_bold), Paragraph("CIELAB K-Means, CIEDE2000 Delta E &le; 6.0, WCAG 2.1 AA luminance contrast, Gemini Vision bounding boxes, image annotation.", table_cell_style), Paragraph("Round 3", table_cell_style)],
        [Paragraph("Diff & Waivers", table_cell_bold), Paragraph("Word-level SequenceMatcher diffing, formal waiver lifecycle, auto-expiring waivers on text change.", table_cell_style), Paragraph("Round 3", table_cell_style)],
        [Paragraph("RBAC & Security", table_cell_bold), Paragraph("JWT Bearer tokens (HS256), 4 user roles, tenant isolation, sliding-window IP rate limiter (240/20 req/min).", table_cell_style), Paragraph("Round 3", table_cell_style)],
        [Paragraph("Insights & Trends", table_cell_bold), Paragraph("Weekly time-series aggregation, empirical trend velocity, formula-safe CSV export, PDF compliance summary.", table_cell_style), Paragraph("Round 3", table_cell_style)],
        [Paragraph("Data Masking", table_cell_bold), Paragraph("Local Luhn credit card, API key, email, phone, and codename masking with fail-closed prompt leak interception.", table_cell_style), Paragraph("Round 3", table_cell_style)],
    ]
    feat_table = Table(features_data, colWidths=[34 * mm, 122 * mm, 18 * mm])
    feat_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), c_primary),
        ("BOX", (0, 0), (-1, -1), 0.6, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, c_border),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, c_card_bg]),
    ]))
    story.append(feat_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("3. Technical Architecture & Design Philosophy", h1_style))
    story.append(Paragraph(
        "LoomGuard is architected to decouple deterministic verification from probabilistic AI extraction. "
        "A major failure mode in generative compliance tools is LLM hallucination and non-deterministic scoring. "
        "LoomGuard eliminates this risk through a <b>Python-First Architecture</b>:",
        body_style,
    ))

    # Clean structured architecture table instead of ASCII
    arch_flow = [
        [Paragraph("Client Layer", table_header_style), Paragraph("React (Vite) Single-Page Application: Review Studio, Word-Level Diff View, Review Queue, Governance Insights, and Cryptographic JWT Role Switcher.", table_cell_style)],
        [Paragraph("Gateway & Security", table_header_style), Paragraph("FastAPI + ASGI Gateway: IP Sliding-Window Rate Limiter (240 general / 20 heavy req/min), Unicode zero-width character sanitizer, and CORS security headers.", table_cell_style)],
        [Paragraph("Local Python Rules (Deterministic)", table_header_style), Paragraph("• Terminology Matcher (Banned/preferred words with exact guide citations)<br/>• Fact Verification (CONTRADICTED numeric deltas, OUTDATED expiry, UNSUPPORTED)<br/>• Color Science (CIELAB K-Means clustering + Sharma CIEDE2000 Delta E &le; 6.0)<br/>• WCAG 2.1 AA Accessibility (Relative luminance contrast + same-hue stepping)<br/>• SequenceMatcher Diff Engine (Word-level diff with 100% reconstruction invariance)", table_cell_style)],
        [Paragraph("AI Extractor & Vision (Constrained)", table_header_style), Paragraph("• Sensitive Data Masker: Pre-LLM Luhn regex masking of cards, keys, emails, phones, and codenames<br/>• Google Gemini 2.5 Flash: Tone check bounded by strict Pydantic schemas (verbatim quotes only)<br/>• Gemini Vision: Text and logo bounding box identification [ymin, xmin, ymax, xmax]<br/>• Fail-Closed Prompt Defense: Intercepts and blocks prompt injections or leaked tokens", table_cell_style)],
        [Paragraph("Persistence & Audit Layer", table_header_style), Paragraph("MongoDB Atlas (with automatic in-memory fallback): Immutable draft revision history (v1..vn), formal exception waiver records, and multi-role audit trail.", table_cell_style)],
    ]
    arch_table = Table(arch_flow, colWidths=[42 * mm, 132 * mm])
    arch_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), c_primary),
        ("BOX", (0, 0), (-1, -1), 0.6, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, c_border),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (1, 0), (-1, -1), [colors.white, c_card_bg]),
    ]))
    story.append(arch_table)

    story.append(PageBreak())

    # =========================================================================
    # PAGE 3: TESTING & EVALUATION BENCHMARK
    # =========================================================================
    story.append(Paragraph("4. Testing & Empirical Evaluation Benchmark", h1_style))
    story.append(Paragraph(
        "LoomGuard was subjected to rigorous empirical evaluation against ground truth datasets spanning "
        "text drafts, sensitive entities, color pairs, and contrast ratios (143/143 tests passing in pytest):",
        body_style,
    ))

    eval_table_data = [
        [Paragraph("Evaluation Domain", table_header_style), Paragraph("Benchmark / Ground Truth", table_header_style), Paragraph("LoomGuard Result", table_header_style), Paragraph("Baseline / Target", table_header_style)],
        [Paragraph("Three-System Text Benchmark (56 drafts, 39 gold issues)", table_cell_bold),
         Paragraph("Full golden dataset with terminology, claim contradiction, outdated pricing, and clean drafts.", table_cell_style),
         Paragraph("<b>100% Recall / 100% Prec.</b><br/>0% False Positives (0/23 clean)<br/>100% Citation Accuracy", table_cell_style),
         Paragraph("System A (Hype): 18% Rec<br/>System B (RAG): 46% Rec<br/>Target: >95% Recall", table_cell_style)],
        [Paragraph("Sensitive Data Masking (Improvement 3)", table_cell_bold),
         Paragraph("15 sensitive entities (Luhn cards, API keys, JWTs, emails, phones, codenames) + 13 benign business numbers.", table_cell_style),
         Paragraph("<b>100% Recall (15/15)</b><br/>0% Benign False Positives<br/>100% Roundtrip Unmasking", table_cell_style),
         Paragraph("Zero prompt leakage to external APIs", table_cell_style)],
        [Paragraph("CIEDE2000 Color Metric (Improvement 1)", table_cell_bold),
         Paragraph("23 standard benchmark color pairs from Sharma, Wu, Dalal (2005) reference dataset.", table_cell_style),
         Paragraph("<b>MAE = 0.000022</b><br/>Max Error = 0.000078", table_cell_style),
         Paragraph("Mathematical parity with published standard", table_cell_style)],
        [Paragraph("WCAG 2.1 AA Contrast (Improvement 1)", table_cell_bold),
         Paragraph("Ground-truth luminance test vectors across boundary ratios (4.5:1 normal, 3:0:1 large).", table_cell_style),
         Paragraph("<b>100% Accuracy</b><br/>100% same-hue suggestions pass ratio", table_cell_style),
         Paragraph("Strict WCAG 2.1 AA standard", table_cell_style)],
        [Paragraph("Word-Level Diff Engine (Improvement 2)", table_cell_bold),
         Paragraph("Multi-revision sequence transformations across insertions, deletions, and substitutions.", table_cell_style),
         Paragraph("<b>100% Invariance</b><br/>(equal+del=orig; equal+ins=revised)", table_cell_style),
         Paragraph("Zero character loss or alignment drift", table_cell_style)],
        [Paragraph("Rule-Check Latency", table_cell_bold),
         Paragraph("End-to-end Python rule suite executed over test corpus.", table_cell_style),
         Paragraph("<b>Mean: 1.3 ms / draft</b><br/>P95: 1.6 ms / draft", table_cell_style),
         Paragraph("Sub-15ms real-time typing speed", table_cell_style)],
    ]

    eval_table = Table(eval_table_data, colWidths=[36 * mm, 56 * mm, 46 * mm, 36 * mm])
    eval_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), c_primary),
        ("BOX", (0, 0), (-1, -1), 0.6, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, c_border),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, c_card_bg]),
    ]))
    story.append(eval_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("Comparative Analysis: Why Generic LLMs Fail at Brand Compliance", h2_style))
    story.append(Paragraph(
        "<b>System A (Generic Hype Checker):</b> Achieved only 18% recall because LLMs without grounding overlook subtle "
        "numerical discrepancies (e.g. 'under 200 milliseconds' vs 'under 150 ms' in fact row 4) and miss banned terms "
        "disguised with hyphens or capitalization.",
        body_style,
    ))
    story.append(Paragraph(
        "<b>System B (Vector RAG Only):</b> Improved recall to 46%, but chunking boundaries frequently severed exception "
        "clauses from mandatory rules. Furthermore, vector similarity failed to distinguish between expired pricing facts "
        "and active pricing facts with similar semantic embeddings.",
        body_style,
    ))
    story.append(Paragraph(
        "<b>System C (LoomGuard):</b> Achieves <b>100% precision and 100% recall</b> by combining deterministic chunk extraction "
        "(preserving page numbers, priority, and exception clauses together) with strict algorithmic rule verification. "
        "Zero clean drafts received false alarms (0/23).",
        body_style,
    ))

    story.append(PageBreak())

    # =========================================================================
    # PAGE 4: ROADMAP, TEAM ROLES, VERIFICATION & SMOKE TESTING
    # =========================================================================
    story.append(Paragraph("5. Product Roadmap & Future Development Plan", h1_style))
    story.append(Paragraph(
        "LoomGuard's production trajectory extends beyond the hackathon into an enterprise governance ecosystem:",
        body_style,
    ))

    roadmap_data = [
        [Paragraph("Phase & Timeline", table_header_style), Paragraph("Key Deliverables & Objectives", table_header_style), Paragraph("Target Ecosystem", table_header_style)],
        [Paragraph("Phase 1: CI/CD & Browser Extension<br/><i>(Q1 2027)</i>", table_cell_bold),
         Paragraph("• <b>Browser Extension:</b> Real-time LoomGuard checking directly inside HubSpot, Notion, Google Docs, and WordPress.<br/>• <b>GitHub Action / GitLab CI:</b> Block PRs containing unapproved claims or non-compliant docs in product repos.", table_cell_style),
         Paragraph("Marketing Ops & Content Creators", table_cell_style)],
        [Paragraph("Phase 2: Multi-Modal Video & Audio<br/><i>(Q2 2027)</i>", table_cell_bold),
         Paragraph("• <b>Video Keyframe Sampling:</b> Extract video frames, checking onscreen graphics and lower-thirds for WCAG compliance.<br/>• <b>Podcast / Spoken Audio:</b> Transcription and timestamped fact-checking for spoken claims.", table_cell_style),
         Paragraph("Multimedia & Social Teams", table_cell_style)],
        [Paragraph("Phase 3: Enterprise Federation & SSO<br/><i>(Q3-Q4 2027)</i>", table_cell_bold),
         Paragraph("• <b>SAML / Okta / Azure AD:</b> Enterprise SSO with automated role synchronization.<br/>• <b>Multi-Brand Hierarchy:</b> Support parent corporations managing multiple sub-brands with shared master glossaries.<br/>• <b>SOC 2 Type II Compliance:</b> Immutable tamper-proof audit trails for legal discovery.", table_cell_style),
         Paragraph("Enterprise Legal & Brand Custodians", table_cell_style)],
    ]
    road_table = Table(roadmap_data, colWidths=[40 * mm, 100 * mm, 34 * mm])
    road_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), c_primary),
        ("BOX", (0, 0), (-1, -1), 0.6, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, c_border),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, c_card_bg]),
    ]))
    story.append(road_table)
    story.append(Spacer(1, 6))

    story.append(Paragraph("6. Team Contributions & AI Disclosure", h1_style))
    team_data = [
        [Paragraph("Team Member", table_header_style), Paragraph("Core Responsibilities & Implemented Components", table_header_style)],
        [Paragraph("<b>Shruthi Pallemoni</b><br/>Backend & AI Architecture", table_cell_style),
         Paragraph("Color science engine (CIELAB K-Means, CIEDE2000), WCAG 2.1 AA contrast pipeline, sensitive data masking engine, sliding-window rate limiter, MongoDB persistence layer, and evaluation test suite (<code>evals/run_evals.py</code>).", table_cell_style)],
        [Paragraph("<b>Pradeep Sutrave</b><br/>Frontend & Product Architecture", table_cell_style),
         Paragraph("React Review Studio, Word-level diff viewer, exception waiver request workflow, brand setup dashboard, demo kit creation, and user experience hardening.", table_cell_style)],
    ]
    team_table = Table(team_data, colWidths=[50 * mm, 124 * mm])
    team_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), c_secondary),
        ("BOX", (0, 0), (-1, -1), 0.6, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, c_border),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, c_card_bg]),
    ]))
    story.append(team_table)
    story.append(Spacer(1, 4))

    story.append(Paragraph(
        "<b>AI Assistance Disclosure:</b> Architecture planning and pair programming were conducted with assistance from "
        "Claude and Google Antigravity. Zero code was recycled from external repositories. All runtime AI utilizes official "
        "Google Gemini APIs via <code>google-genai</code> SDK, bounded by strict validation.",
        body_style,
    ))
    story.append(Spacer(1, 4))

    story.append(Paragraph("7. Judge Verification & Smoke Testing", h1_style))
    story.append(Paragraph("1. <b>Live Web Application:</b> Navigate to <code>https://loomguard-kizuna.vercel.app/</code>. Pre-seeded demo brand kits and flawed drafts allow full end-to-end testing immediately.", bullet_style))
    story.append(Paragraph("2. <b>Live API Documentation:</b> Open <code>https://loomguard-kizuna-6cra.onrender.com/docs</code> for interactive OpenAPI Swagger documentation.", bullet_style))
    story.append(Paragraph("3. <b>Automated Smoke Test:</b> Run our standalone smoke test script against production with zero dependencies: <code>python backend/scripts/smoke.py https://loomguard-kizuna-6cra.onrender.com</code>.", bullet_style))
    story.append(Paragraph("4. <b>Local Unit Test Suite:</b> Run <code>pytest tests -q</code> inside <code>backend/</code> to execute all 143 passing unit and integration tests.", bullet_style))

    story.append(Spacer(1, 8))
    closing = Table([[Paragraph("<b>LoomGuard — Brand Protection with Mathematical Certainty.</b><br/>Team KIZUNA • RGUKT Basar • October 2026", ParagraphStyle("Close", parent=base["Normal"], fontName="Helvetica", fontSize=8.5, alignment=1, textColor=c_primary))]], colWidths=[174 * mm])
    closing.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EFF6FF")),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#BFDBFE")),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(closing)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated: {out_path} ({out_path.stat().st_size} bytes)")


if __name__ == "__main__":
    root_dir = Path(__file__).resolve().parent.parent.parent
    target = root_dir / "KIZUNA_Round_3_LoomGuard_Submission.pdf"
    build_pdf(target)
