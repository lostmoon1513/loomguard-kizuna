"""Governance insights over time (Round 3, improvement 3b).

Everything here is counted from the drafts and their audit logs. Recommendations are written by fixed rules from
those counts and always carry their evidence; nothing is invented and no model is involved.
Demo history (clearly labelled) can be added and removed so the screen has something to show on day one.
"""
import io
import random
import statistics
from datetime import datetime, timedelta, timezone
from typing import Optional

from . import drafts_store


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def _week_start(dt: datetime) -> str:
    d = (dt - timedelta(days=dt.weekday())).date()
    return d.isoformat()


def rule_label(i: dict) -> str:
    cit = i.get("citation") or {}
    if i["category"] == "TERMINOLOGY":
        return f"TERMINOLOGY: {i['quote'].lower()}"
    if cit:
        return f"{i['category']}: {cit.get('doc', 'no source')} {cit.get('ref', '')}".strip()
    return f"{i['category']}: no source"


def _weeks(n: int, now: datetime) -> list[str]:
    cur = datetime.fromisoformat(_week_start(now)).replace(tzinfo=timezone.utc)
    return [(cur - timedelta(weeks=k)).date().isoformat() for k in range(n - 1, -1, -1)]


def build(drafts: list[dict], weeks: int = 8, now: Optional[datetime] = None, include_demo: bool = True) -> dict:
    now = now or datetime.now(timezone.utc)
    weeks = max(2, min(26, weeks))
    demo_n = sum(1 for d in drafts if d.get("demo"))
    if not include_demo:
        drafts = [d for d in drafts if not d.get("demo")]
    axis = _weeks(weeks, now)
    series = {w: {"week_start": w, "drafts_checked": 0, "issues_found": 0, "fixes_applied": 0, "exceptions_requested": 0,
                  "waivers_granted": 0, "waivers_denied": 0, "approved": 0, "changes_requested": 0} for w in axis}
    rules: dict[str, dict] = {}
    review_hours: list[float] = []
    claim_contradicted = masked_drafts = 0
    status_counts: dict[str, int] = {}

    for d in drafts:
        status_counts[d["status"]] = status_counts.get(d["status"], 0) + 1
        wk = _week_start(_parse(d["created_at"]))
        first = (d.get("versions") or [{}])[0].get("counts", {}).get("total", d["summary"]["total"] if d.get("summary") else 0)
        if wk in series:
            series[wk]["drafts_checked"] += 1
            series[wk]["issues_found"] += first
        if (d.get("mask_summary") or {}).get("count"):
            masked_drafts += 1
        submitted = None
        for e in d.get("audit", []):
            w = _week_start(_parse(e["at"]))
            row = series.get(w)
            t = e["type"]
            if t == "submitted":
                submitted = _parse(e["at"])
            if t == "decision" and submitted:
                review_hours.append((_parse(e["at"]) - submitted).total_seconds() / 3600)
                submitted = None
            if row is None:
                continue
            if t in ("fix_accepted", "edited"):
                row["fixes_applied"] += 1
            elif t == "exception_requested":
                row["exceptions_requested"] += 1
            elif t == "waiver_granted":
                row["waivers_granted"] += 1
            elif t == "waiver_denied":
                row["waivers_denied"] += 1
            elif t == "decision":
                if e["detail"].startswith("approve"):
                    row["approved"] += 1
                else:
                    row["changes_requested"] += 1
        for i in list(d["issues"]) + list(d.get("resolved", [])):
            r = rules.setdefault(rule_label(i), {"rule": rule_label(i), "category": i["category"], "count": 0, "drafts": set(),
                                                 "exceptions": 0, "granted": 0, "denied": 0, "by_week": {}})
            r["count"] += 1
            r["drafts"].add(d["id"])
            r["by_week"][wk] = r["by_week"].get(wk, 0) + 1
            wv = i.get("waiver") or {}
            if i["status"] in ("exception_requested", "waived") or wv.get("state") == "denied":
                r["exceptions"] += 1
                r["granted"] += wv.get("state") == "granted"
                r["denied"] += wv.get("state") == "denied"
            if i.get("claim_status") == "CONTRADICTED":
                claim_contradicted += 1

    half = max(1, weeks // 2)
    recent, earlier = set(axis[-half:]), set(axis[:-half])
    top = []
    for r in rules.values():
        rc = sum(v for w, v in r["by_week"].items() if w in recent)
        ec = sum(v for w, v in r["by_week"].items() if w in earlier)
        trend = ("rising" if rc >= 2 and rc > ec * 1.5 else "falling" if ec >= 2 and rc < ec * 0.5 else "steady")
        top.append({"rule": r["rule"], "category": r["category"], "count": r["count"], "drafts": len(r["drafts"]),
                    "exceptions_requested": r["exceptions"], "waivers_granted": r["granted"], "waivers_denied": r["denied"],
                    "recent": rc, "earlier": ec, "trend": trend})
    top.sort(key=lambda r: (-r["count"], r["rule"]))
    weekly = [series[w] for w in axis]
    out = {
        "generated_at": now.isoformat(timespec="seconds"), "weeks": weeks, "drafts": len(drafts),
        "includes_demo_data": include_demo and demo_n > 0, "demo_drafts": demo_n,
        "demo_note": ("Includes sample history labelled [DEMO]. It is not real activity." if include_demo and demo_n else None),
        "drafts_by_status": status_counts, "weekly": weekly, "top_rules": top[:10],
        "totals": {"issues": sum(r["count"] for r in rules.values()),
                   "exceptions_requested": sum(r["exceptions"] for r in rules.values()),
                   "waivers_granted": sum(r["granted"] for r in rules.values()),
                   "waivers_denied": sum(r["denied"] for r in rules.values()),
                   "median_review_hours": round(statistics.median(review_hours), 1) if review_hours else None},
    }
    out["recommendations"] = recommend(out, top, claim_contradicted, masked_drafts)
    return out


def recommend(summary: dict, rules: list[dict], contradicted: int, masked_drafts: int) -> list[dict]:
    recs: list[dict] = []

    def add(rid, level, title, text, evidence):
        recs.append({"id": rid, "level": level, "title": title, "text": text, "evidence": evidence})

    for r in rules:
        if r["count"] >= 5 and r["drafts"] >= 3 and r["category"] in ("TERMINOLOGY", "TONE", "READABILITY") and r["trend"] != "falling":
            add(f"frequent:{r['rule']}", "medium", f"Make '{r['rule']}' easier to follow",
                f"{r['rule']} came up {r['count']} times across {r['drafts']} drafts. Add a short before-and-after example "
                f"to the guide next to this rule so writers can see the accepted wording.", {"count": r["count"], "drafts": r["drafts"]})
        if r["exceptions_requested"] >= 3 and r["exceptions_requested"] / max(1, r["count"]) >= 0.3:
            grant = r["waivers_granted"] >= r["waivers_denied"]
            add(f"exceptions:{r['rule']}", "high", f"Review the wording of '{r['rule']}'",
                (f"Writers asked for an exception on {r['exceptions_requested']} of {r['count']} findings for this rule"
                 + (f", and {r['waivers_granted']} were granted. The rule may be stricter than intended: consider adding the "
                    "allowed cases to the guide." if grant else f", and {r['waivers_denied']} were denied. Writers may not "
                    "understand what the rule allows: add a clear example.")),
                {"exceptions": r["exceptions_requested"], "findings": r["count"], "granted": r["waivers_granted"],
                 "denied": r["waivers_denied"]})
        if r["trend"] == "rising" and r["count"] >= 4:
            add(f"rising:{r['rule']}", "medium", f"'{r['rule']}' is rising",
                f"{r['recent']} findings in the last weeks against {r['earlier']} before. Check whether something changed "
                "in the guide, the kit or the type of content being written.", {"recent": r["recent"], "earlier": r["earlier"]})
    acc = next((r for r in rules if r["category"] == "ACCESSIBILITY"), None)
    if acc and acc["count"] >= 2:
        add("contrast", "high", "Publish approved colour pairs for text",
            f"{acc['count']} images failed the WCAG contrast check. List approved text and background colour pairs in the guide "
            "so designers start from combinations that pass.", {"findings": acc["count"]})
    if contradicted >= 3:
        add("facts", "high", "Keep the Approved Facts sheet in front of writers",
            f"{contradicted} claims contradicted the Approved Facts sheet. Link the sheet from the writing template and "
            "refresh it when the numbers change.", {"contradicted_claims": contradicted})
    hrs = summary["totals"]["median_review_hours"]
    if hrs is not None and hrs > 48:
        add("review_time", "medium", "Reviews are slow", f"The median time from submission to decision is {hrs} hours. "
            "Consider a rota for managers or reviewers.", {"median_review_hours": hrs})
    if masked_drafts >= 2:
        add("confidential", "medium", "Confidential names keep appearing in drafts",
            f"{masked_drafts} drafts contained confidential values that LoomGuard masked before AI checks. Remind writers to use "
            "approved public names in marketing copy.", {"drafts_with_masked_values": masked_drafts})
    if not recs:
        add("none", "info", "No pattern needs action", "No rule is frequent, rising or heavily excepted in this period.", {})
    order = {"high": 0, "medium": 1, "info": 2}
    recs.sort(key=lambda r: (order[r["level"]], r["id"]))
    return recs[:6]


# ------------------------------------------------------------------ export
def to_csv(data: dict, table: str) -> str:
    import csv

    buf = io.StringIO()
    w = csv.writer(buf)
    if table == "rules":
        cols = ["rule", "category", "count", "drafts", "exceptions_requested", "waivers_granted", "waivers_denied", "trend"]
        w.writerow(cols)
        for r in data["top_rules"]:
            w.writerow([_safe(r[c]) for c in cols])
    elif table == "recommendations":
        w.writerow(["level", "title", "text"])
        for r in data["recommendations"]:
            w.writerow([r["level"], _safe(r["title"]), _safe(r["text"])])
    else:
        cols = list(data["weekly"][0].keys()) if data["weekly"] else ["week_start"]
        w.writerow(cols)
        for r in data["weekly"]:
            w.writerow([r[c] for c in cols])
    return buf.getvalue()


def _safe(v):
    """Stop spreadsheet formula injection from text that starts with = + - or @."""
    return "'" + v if isinstance(v, str) and v[:1] in "=+-@" else v


def to_pdf(data: dict, who: str) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    st = getSampleStyleSheet()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                            title="LoomGuard compliance summary")
    story = [Paragraph("LoomGuard compliance summary", st["Title"]),
             Paragraph(f"Generated {data['generated_at']} for {who}. Period: last {data['weeks']} weeks. Drafts: {data['drafts']}.", st["Normal"])]
    if data["demo_note"]:
        story += [Spacer(1, 4), Paragraph(f"<b>Note:</b> {data['demo_note']}", st["Normal"])]
    t = data["totals"]
    story += [Spacer(1, 8), Paragraph("Headline numbers", st["Heading2"]),
              Paragraph(f"Findings: {t['issues']}. Exceptions requested: {t['exceptions_requested']} "
                        f"(granted {t['waivers_granted']}, denied {t['waivers_denied']}). Median review time: "
                        f"{t['median_review_hours'] if t['median_review_hours'] is not None else 'not enough data'} hours. "
                        "LoomGuard reports findings and decisions only; it does not give a compliance score.", st["Normal"])]

    def table(rows, widths):
        tb = Table(rows, colWidths=widths, repeatRows=1)
        tb.setStyle(TableStyle([("FONTSIZE", (0, 0), (-1, -1), 8), ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
        return tb

    story += [Spacer(1, 8), Paragraph("Weekly trend", st["Heading2"]),
              table([["Week", "Drafts", "Findings", "Fixes", "Exceptions", "Granted", "Denied", "Approved", "Changes req."]] +
                    [[w["week_start"], w["drafts_checked"], w["issues_found"], w["fixes_applied"], w["exceptions_requested"],
                      w["waivers_granted"], w["waivers_denied"], w["approved"], w["changes_requested"]] for w in data["weekly"]],
                    [24 * mm] + [18 * mm] * 8)]
    story += [Spacer(1, 8), Paragraph("Rules that came up most", st["Heading2"]),
              table([["Rule", "Findings", "Drafts", "Exceptions", "Trend"]] +
                    [[Paragraph(r["rule"][:70], st["BodyText"]), r["count"], r["drafts"], r["exceptions_requested"], r["trend"]]
                     for r in data["top_rules"]] or [["No findings yet", "", "", "", ""]], [80 * mm, 20 * mm, 20 * mm, 22 * mm, 22 * mm])]
    story += [Spacer(1, 8), Paragraph("Recommendations", st["Heading2"])]
    for r in data["recommendations"]:
        story.append(Paragraph(f"<b>{r['title']}</b> ({r['level']}). {r['text']}", st["BodyText"]))
    doc.build(story)
    return buf.getvalue()


# ------------------------------------------------------------------ demo history (labelled, removable)
_DEMO_RULES = [("TERMINOLOGY", "revolutionary", "Page 3"), ("TERMINOLOGY", "world-class", "Page 3"),
               ("TERMINOLOGY", "guaranteed", "Page 3"), ("TONE", "super easy", "Page 2"),
               ("CLAIM", "99.99%", "Page 4"), ("CLAIM", "10x faster", "Page 4"),
               ("ACCESSIBILITY", "Low contrast on \"Learn more\"", "Page 5"), ("COLOUR", "Colour #FF8800", "Page 5")]


def seed_demo_history(now: Optional[datetime] = None, weeks: int = 7) -> int:
    """Adds [DEMO] drafts spread over the last weeks. Deterministic. Returns how many were added."""
    now = now or datetime.now(timezone.utc)
    rnd = random.Random(7)
    n = 0
    for k in range(weeks - 1, -1, -1):  # k = weeks ago
        for j in range(2):
            n += 1
            created = now - timedelta(weeks=k, days=j * 2 + 1, hours=rnd.randint(0, 8))
            # terminology problems fade over the weeks, contrast problems appear later
            weights = {"TERMINOLOGY": max(0, 3 - (weeks - 1 - k) // 2), "TONE": 1, "CLAIM": 1 + (j == 0),
                       "ACCESSIBILITY": 0 if k > 3 else 1, "COLOUR": 0 if k > 3 else (j == 1)}
            issues = []
            for cat, quote, ref in _DEMO_RULES:
                for _ in range(weights[cat] if rnd.random() < 0.9 else 0):
                    st = "open"
                    issues.append({"id": f"iss_{len(issues) + 1:02d}", "category": cat, "claim_status": "CONTRADICTED" if cat == "CLAIM" else None,
                                   "severity": "high" if cat in ("CLAIM", "ACCESSIBILITY") else "medium", "source": "python_rule",
                                   "quote": quote, "start": 0, "end": 0, "reason": "Sample finding", "suggested_fixes": [],
                                   "citation": {"doc": "Brand Guide", "ref": ref, "rule_id": "demo"}, "needs_review": False,
                                   "priority": "mandatory", "status": st, "exception_note": None, "waiver": None})
            audit_rows = [{"at": created.isoformat(timespec="seconds"), "actor": "Demo", "role": "creator", "type": "created", "detail": "sample"}]
            at = created + timedelta(hours=3)
            for i in issues:
                if i["quote"] == "revolutionary" and rnd.random() < 0.8:  # a rule people keep asking exceptions for
                    i["status"], i["exception_note"] = "exception_requested", "Product name"
                    audit_rows.append({"at": at.isoformat(timespec="seconds"), "actor": "Demo", "role": "creator", "type": "exception_requested", "detail": "sample"})
            audit_rows.append({"at": (created + timedelta(hours=4)).isoformat(timespec="seconds"), "actor": "Demo", "role": "creator",
                               "type": "submitted", "detail": "sample"})
            granted = False
            for i in issues:
                if i["status"] == "exception_requested":
                    granted = rnd.random() < 0.7
                    i["status"] = "waived" if granted else "open"
                    i["waiver"] = {"state": "granted" if granted else "denied", "by": "Demo Manager", "role": "manager",
                                   "at": (created + timedelta(hours=20)).isoformat(timespec="seconds"), "reason": "sample"}
                    audit_rows.append({"at": (created + timedelta(hours=20)).isoformat(timespec="seconds"), "actor": "Demo Manager", "role": "manager",
                                       "type": "waiver_granted" if granted else "waiver_denied", "detail": "sample"})
            approve = rnd.random() < 0.7
            if approve:  # the writer fixed everything that was not waived before the manager approved
                for i in issues:
                    if i["status"] == "open":
                        i["status"] = "accepted"
                        audit_rows.append({"at": (created + timedelta(hours=2)).isoformat(timespec="seconds"), "actor": "Demo",
                                           "role": "creator", "type": "fix_accepted", "detail": "sample"})
            hrs = rnd.randint(6, 40) if k > 1 else rnd.randint(30, 72)
            audit_rows.append({"at": (created + timedelta(hours=4 + hrs)).isoformat(timespec="seconds"), "actor": "Demo Manager", "role": "manager",
                               "type": "decision", "detail": "approve" if approve else "request_changes: sample"})
            did = f"demo_{n:02d}"
            d = {"id": did, "title": f"[DEMO] Sample draft {n}", "kind": "text", "author": "Demo", "owner_id": None, "demo": True,
                 "status": "APPROVED" if approve else "CHANGES_REQUESTED", "text": "", "original_text": "", "use_ai": False,
                 "issues": issues, "resolved": [], "comments": [], "decisions": [], "checks": [], "ai_available": False,
                 "summary": {"total": len(issues), "by_category": {}}, "versions": [{"n": 1, "text": "", "author": "Demo", "role": "creator",
                 "at": created.isoformat(timespec="seconds"), "note": "sample", "counts": {"total": len(issues), "open_mandatory": 0}}],
                 "audit": audit_rows, "revision": 1, "created_at": created.isoformat(timespec="seconds"),
                 "updated_at": created.isoformat(timespec="seconds"), "mask_summary": None}
            drafts_store.DRAFTS[did] = d
    return n


def clear_demo_history() -> int:
    ids = [i for i, d in drafts_store.DRAFTS.items() if d.get("demo")]
    for i in ids:
        del drafts_store.DRAFTS[i]
    return len(ids)