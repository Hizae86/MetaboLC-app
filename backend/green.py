"""Green footprint of an LC-MS/MS method: mobile-phase solvent per injection.

Solvent use is integrated from the gradient table (time, %B, flow) and the
composition of mobile phases A and B, which is read from their free-text
description ("0.1% formic acid in acetonitrile", "water/methanol (90:10, v/v)").
Everything that is assumed rather than stated is reported in `notes` and in
each phase's `status`, so the page can say how far the number can be trusted.

Not included: sample preparation solvents (reported separately when the
preparation text states volumes), needle wash, purge and standby flow between
injections.

The AGREE score (Pena-Pereira et al., Anal. Chem. 2020, 92, 10076) is computed
in the frontend (lib/green.ts) from these figures plus inputs the reviewer can edit.
"""
from __future__ import annotations

import re
from statistics import median

SOLVENTS = ("water", "acetonitrile", "methanol", "isopropanol", "ethanol")
ORGANIC = SOLVENTS[1:]
DENSITY = {"water": 0.997, "acetonitrile": 0.786, "methanol": 0.792, "isopropanol": 0.786, "ethanol": 0.789}  # g/mL, 20-25 °C

_PATTERNS = {
    "acetonitrile": r"acetonitrile|\bacn\b|\bmecn\b",
    "methanol": r"methanol|\bmeoh\b",
    "isopropanol": r"isopropanol|isopropyl alcohol|\bipa\b|2-propanol",
    "ethanol": r"\bethanol\b|\betoh\b",
    "water": r"water|\bh2o\b|aqueous|\(aq\)|milli-?q",
}
_AQUEOUS_HINT = r"ammonium|formate|acetate|fluoride|\bnh4|buffer|\bph\b|ammonia|hydroxide|formic|acetic|carbonate|\bmm\b|mmol|mol/l"
_UNKNOWN_HINT = r"not reported|reagent set|\bkit\b|proprietary|\bpump\b|dosimmune|included within"
_ADDITIVE = r"\s*(?:\(v/v\)\s*)?(?:of\s+)?(?:formic|acetic|fa\b|hfba|heptafluoro|trifluoro|tfa\b|ammonia|ammonium hydroxide)"


def _mentions(t: str) -> list[tuple[int, str]]:
    found = []
    for solvent, pat in _PATTERNS.items():
        for m in re.finditer(pat, t):
            found.append((m.start(), solvent))
    found.sort()
    order: list[str] = []
    for _, s in found:
        if s not in order:
            order.append(s)
    return [(i, s) for i, s in enumerate(order)]


def parse_phase(text: str | None) -> dict:
    """Volume fractions of water and organic solvents in one mobile phase.
    status: 'stated' (from the text), 'inferred' (an assumption, see note), 'unknown', 'none'."""
    raw = (text or "").strip()
    t = raw.lower().replace("–", "-").replace("—", "-")
    out = {"text": raw, "fractions": {}, "status": "unknown", "note": None}
    if not t:
        out["note"] = "Composition not given."
        return out
    if t.startswith("none"):
        out.update(status="none", note="Not used.")
        return out
    order = [s for _, s in _mentions(t)]

    # 1. explicit ratio "(90:10, v/v)", "95/5 ACN/water", "30:10:60"
    for m in re.finditer(r"(?<![\d.])(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)(?:\s*[:/]\s*(\d+(?:\.\d+)?))?(?![\d.])", t):
        parts = [float(x) for x in m.groups() if x]
        if len(parts) == len(order) and len(parts) >= 2 and sum(parts) > 0:
            total = sum(parts)
            out["fractions"] = {s: p / total for s, p in zip(order, parts)}
            out["status"] = "stated"
            return out

    # 2. percentages that describe composition: "10% acetonitrile", "90% 3 mM ammonium formate / 10% MeOH"
    assigned: dict[str, float] = {}
    for m in re.finditer(r"(\d+(?:\.\d+)?)\s*%", t):
        pct = float(m.group(1))
        after = t[m.end():m.end() + 45]
        if re.match(_ADDITIVE, after) or pct <= 1:
            continue
        seg = re.split(r"/|\+|,|\bin\b|\bwith\b|\bcontaining\b", after, maxsplit=1)[0]
        hit = next((s for s, pat in _PATTERNS.items() if re.search(pat, seg)), None)
        if hit is None and re.search(_AQUEOUS_HINT, seg):
            hit = "water"
        if hit:
            assigned[hit] = assigned.get(hit, 0) + pct
    if assigned and sum(assigned.values()) <= 100.5:
        rest = max(0.0, 100 - sum(assigned.values()))
        others = [s for s in order if s not in assigned]
        if rest > 0.5:
            target = others[0] if len(others) == 1 else ("water" if not others else None)
            if target is None:
                out["note"] = "Percentages do not say which solvent makes up the rest."
                return out
            assigned[target] = assigned.get(target, 0) + rest
        total = sum(assigned.values())
        out["fractions"] = {s: v / total for s, v in assigned.items()}
        out["status"] = "stated"
        return out

    # 3. no proportions given
    organics = [s for s in order if s != "water"]
    if not organics and ("water" in order):
        out.update(fractions={"water": 1.0}, status="stated")
    elif not organics and re.search(_UNKNOWN_HINT, t):
        out["note"] = "Commercial or unspecified mobile phase: composition not reported."
    elif not organics and re.search(_AQUEOUS_HINT, t):
        out.update(fractions={"water": 1.0}, status="inferred", note="Aqueous buffer assumed (no solvent named).")
    elif len(organics) == 1 and "water" not in order:
        out.update(fractions={organics[0]: 1.0}, status="stated")
    elif organics and "water" not in order:
        out.update(fractions={s: 1 / len(organics) for s in organics}, status="inferred",
                   note=f"Ratio of {' and '.join(organics)} not stated; equal parts assumed.")
    elif organics:
        out["note"] = "Water and organic solvent named without their proportion."
    else:
        out["note"] = "No solvent named."
    return out


def _segments(steps: list) -> tuple[list[tuple[float, float, float, float, float]], list[str]]:
    """(dt, flow0, flow1, B0, B1) per segment, honouring step-type curves."""
    notes = []
    rows = sorted(steps, key=lambda s: s.time_min)
    flows = [s.flow_rate_ml_min for s in rows]
    if not any(f for f in flows):
        return [], ["No flow rate in the gradient table."]
    if not all(flows):
        notes.append("Missing flow values were carried over from the neighbouring step.")
        last = next(f for f in flows if f)
        for i, f in enumerate(flows):
            flows[i] = f if f else last
            last = flows[i]
    segs = []
    for i in range(len(rows) - 1):
        a, b = rows[i], rows[i + 1]
        dt = (b.time_min or 0) - (a.time_min or 0)
        if dt <= 0:
            continue
        curve = (b.curve or "").strip().lower()
        b0, b1 = a.percent_b / 100, b.percent_b / 100
        if curve in ("1", "step"):          # change at the start of the segment
            b0 = b1
        elif curve == "11":                  # change at the end of the segment
            b1 = b0
        segs.append((dt, flows[i], flows[i + 1], b0, b1))
    if any((s.curve or "").strip().lower() not in ("", "1", "6", "11", "linear", "step", "initial", "hold") for s in rows):
        notes.append("Curved gradient segments approximated as linear.")
    return segs, notes


def _integral(dt, f0, f1, c0, c1):
    """∫ flow(t)·c(t) dt with both linear over the segment."""
    return dt * (f0 * c0 / 3 + f0 * c1 / 6 + f1 * c0 / 6 + f1 * c1 / 3)


_SAMPLE_WORDS = r"(?:spiked\s+)?(?:human\s+)?(?:serum|plasma|whole blood|blood|urine|saliva|csf|cerebrospinal|sample|calibrators?|specimen|dbs|dried blood)"
_PREP_SOLVENTS = {
    "acetonitrile": r"acetonitrile|\bacn\b", "methanol": r"methanol|\bmeoh\b",
    "isopropanol": r"isopropanol|isopropyl alcohol|\bipa\b|2-propanol", "ethanol": r"\bethanol\b",
    "ethyl acetate": r"ethyl acetate", "MTBE": r"\bmtbe\b|methyl tert-butyl ether|tert-butyl methyl ether",
    "hexane": r"\bhexane", "heptane": r"\bheptane", "dichloromethane": r"dichloromethane|\bdcm\b|methylene chloride",
    "chloroform": r"chloroform", "acetone": r"\bacetone\b", "diethyl ether": r"diethyl ether",
}
_UL = r"(\d+(?:\.\d+)?)\s*(µl|μl|ul|ml)\b"


def _to_ul(n: str, unit: str) -> float:
    return float(n) * (1000 if unit == "ml" else 1)


def parse_prep(details: str | None) -> dict:
    """Sample volume and organic solvent volumes stated in the preparation text (first mention each)."""
    t = (details or "").lower()
    sample = None
    for m in re.finditer(_UL + r"\s+(?:of\s+)?" + _SAMPLE_WORDS, t):
        sample = {"ul": _to_ul(m.group(1), m.group(2)), "snippet": details[max(0, m.start() - 10): m.end() + 10].strip()}
        break
    solvents = []
    for m in re.finditer(_UL + r"\s+(?:of\s+)?(?:ice-?cold\s+|cold\s+|neat\s+|pure\s+|\d+%\s+)?([a-z][\w\- ]{2,40})", t):
        follow = m.group(3)
        for name, pat in _PREP_SOLVENTS.items():
            if re.match(r"(?:" + pat + r")", follow):
                pct = re.search(r"(\d+)%\s+" + re.escape(follow[:6]), t[m.start():m.end() + 5])
                frac = float(pct.group(1)) / 100 if pct else 1.0
                if _to_ul(m.group(1), m.group(2)) <= 0:
                    break
                solvents.append({"solvent": name, "ul": _to_ul(m.group(1), m.group(2)) * frac,
                                 "snippet": details[max(0, m.start() - 5): m.end() + 5].strip()})
                break
    return {"sample": sample, "solvents": solvents}


def evaluate(m) -> dict:
    """Solvent footprint of one method (ORM object with gradient_steps and mrm_transitions)."""
    phase_a, phase_b = parse_phase(m.mobile_phase_a), parse_phase(m.mobile_phase_b)
    steps = list(m.gradient_steps or [])
    analytes = {(t.compound_name or "").strip().lower() for t in (m.mrm_transitions or []) if not t.is_internal_standard and t.compound_name}
    derivatized = (m.sample_prep_method or "").lower().startswith("deriv") or any(
        (t.is_derivatized or 0) or (t.derivative or "") for t in (m.mrm_transitions or []))
    prep_text = f"{m.sample_prep_method or ''} {m.sample_prep_details or ''}".lower()
    result = {
        "computable": False, "reason": None, "notes": [],
        "phase_a": phase_a, "phase_b": phase_b,
        "run_time_min": None, "total_ml": None, "organic_ml": None, "by_solvent_ml": {},
        "organic_g": None, "n_analytes": len(analytes) or None,
        "derivatized": bool(derivatized),
        "automated": bool(re.search(r"automat|on-?line|clam-?\d|liquid handl|robot", prep_text)),
        "prep_method": m.sample_prep_method,
        "prep": parse_prep(m.sample_prep_details),
    }
    if len(steps) < 2:
        result["reason"] = "No gradient table with at least two time points."
        return result
    segs, notes = _segments(steps)
    result["notes"] += notes
    if not segs:
        result["reason"] = notes[0] if notes else "Gradient table has no duration."
        return result
    run_time = sum(s[0] for s in segs)
    total = sum(_integral(dt, f0, f1, 1, 1) for dt, f0, f1, _, _ in segs)
    result.update(run_time_min=run_time, total_ml=total)

    unknown = [p for p, ph in (("A", phase_a), ("B", phase_b)) if ph["status"] in ("unknown",)]
    # A phase that is never pumped (0 % B throughout or 100 %) does not need a composition.
    used_b = any(b0 > 0 or b1 > 0 for *_, b0, b1 in segs)
    used_a = any(b0 < 1 or b1 < 1 for *_, b0, b1 in segs)
    unknown = [p for p in unknown if (p == "A" and used_a) or (p == "B" and used_b)]
    if unknown:
        result["reason"] = f"Composition of mobile phase {' and '.join(unknown)} not reported, so the organic share cannot be calculated."
        return result
    by = {}
    for s in SOLVENTS:
        fa = phase_a["fractions"].get(s, 0.0)
        fb = phase_b["fractions"].get(s, 0.0)
        v = sum(_integral(dt, f0, f1, (1 - b0) * fa + b0 * fb, (1 - b1) * fa + b1 * fb) for dt, f0, f1, b0, b1 in segs)
        if v > 1e-9:
            by[s] = v
    organic = sum(v for s, v in by.items() if s in ORGANIC)
    result.update(computable=True, by_solvent_ml=by, organic_ml=organic,
                  organic_g=sum(v * DENSITY[s] for s, v in by.items() if s in ORGANIC))
    for p, ph in (("A", phase_a), ("B", phase_b)):
        if ph["status"] == "inferred":
            result["notes"].append(f"Mobile phase {p}: {ph['note']}")
    return result


def repository_stats(methods) -> dict:
    """Organic solvent per injection across the repository, for comparison."""
    vals = sorted(e["organic_ml"] for e in (evaluate(m) for m in methods) if e["computable"])
    return {"n": len(vals), "median_organic_ml": median(vals) if vals else None, "organic_ml": vals}


def with_rank(green: dict, stats: dict) -> dict:
    if green.get("computable") and stats["n"]:
        vals = stats["organic_ml"]
        below = sum(1 for v in vals if v > green["organic_ml"] + 1e-9)
        green["repository"] = {"n": stats["n"], "median_organic_ml": stats["median_organic_ml"],
                               "share_using_more": below / stats["n"]}
    return green
