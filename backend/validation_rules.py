"""Koiné validation rules engine — koine-rules@1.0.0.

Single source of truth for the Validate module. The rules are the closed specification
"Koiné — Especificación Técnica de Reglas de Validación y Control de Cambios (v1.0 Cerrada)",
20-11-2026 (project doc producto/reglas-validacion-borrador.md). Every rule carries its source:
a guideline section, or "Koiné" when it is a Koiné/laboratory criterion and not a guideline figure.

Everything here is a pure function of its inputs (no database, no I/O), so a dossier can state
the rules version and anyone can recompute the result.

Profiles: bioanalysis_m10, clinical_inhouse, clinical_ceivd, own. Bioanalysis (ICH M10) and
clinical (CLSI / ISO 15189 / IVDR) are two separate rule sets: a study is evaluated against one
profile, never a mix of both.

Defaults chosen by Koiné where the specification gives a window, not a value (listed in the
project doc, section 4): 8 calibrators spaced logarithmically, MQC at 40 % of the range, HQC at
80 % of the ULOQ, 3 replicates per lot for the clinical matrix effect.
"""
from __future__ import annotations

import math
import re
from typing import Iterable, Optional

RULES_VERSION = "koine-rules@1.0.0"

# ── Profiles ─────────────────────────────────────────────────────────────────
PROFILES = {
    "bioanalysis_m10": {
        "label": "Bioanalysis · ICH M10",
        "family": "bioanalysis",
        "use_for": "Pharmacokinetic studies, clinical trials and bioanalytical research",
        "context": "ICH M10 (Step 4, 24-05-2022)",
        "editable": False,
    },
    "clinical_inhouse": {
        "label": "Clinical · in-house / LDT",
        "family": "clinical",
        "use_for": "Clinical diagnosis, therapeutic monitoring and in-house methods used in patient care",
        "context": "CLSI C62 (3rd ed., 30-06-2026), CLSI EP05/EP06/EP07/EP09/EP15/EP17, "
                   "ISO 15189:2022, IVDR (EU) 2017/746 Art. 5(5)",
        "editable": False,
    },
    "clinical_ceivd": {
        "label": "Clinical · CE-IVD kit verification",
        "family": "clinical",
        "use_for": "A CE-IVD kit used for clinical diagnosis or monitoring, verified in your laboratory",
        "context": "CLSI C62 (3rd ed., 30-06-2026), CLSI EP15-A3, ISO 15189:2022",
        "editable": False,
    },
    "own": {
        "label": "Own SOP",
        "family": "clinical",
        "use_for": "Your laboratory's own written criteria, starting from the clinical template",
        "context": "Starts from the Clinical in-house template; the laboratory edits any rule",
        "editable": True,
        "template": "clinical_inhouse",
    },
}


def _base(profile: str) -> str:
    if profile not in PROFILES:
        raise ValueError(f"Unknown profile: {profile}")
    return PROFILES[profile].get("template", profile)


def is_clinical(profile: str) -> bool:
    return _base(profile) in ("clinical_inhouse", "clinical_ceivd")


# ── Acceptance criteria used by the calculations ─────────────────────────────
# Calibration: back-calculated bias limit, wider at the lowest level. r² is never a gate.
CALIBRATION = {
    "bioanalysis_m10": {"limit": 15.0, "limit_lowest": 20.0, "min_levels": 6, "min_pass_fraction": 0.75,
                        "min_passing_levels": 6, "source": "ICH M10 §3.2.4"},
    # Clinical: ±15/±20 % limits from the clinical profile. The ≥6 levels / ≥75 % within rule is a
    # Koiné rule adopted from ICH M10, not a figure attributed to CLSI C62 (confirmed 20-11-2026).
    "clinical": {"limit": 15.0, "limit_lowest": 20.0, "min_levels": 6, "min_pass_fraction": 0.75,
                 "min_passing_levels": 6,
                 "source": "Koiné rule adopted from ICH M10 §3.2.4 (≥6 levels, ≥75 % within); "
                           "limits ±15 % (±20 % at LLMI)"},
}

RUN_ACCEPTANCE = {
    "bioanalysis_m10": [
        {"rule": "QCs in duplicate, at least low, medium and high", "source": "ICH M10 §3.2.5"},
        {"rule": "≥2/3 of all QCs and ≥50 % per level within ±15 % of nominal", "source": "ICH M10 §3.2.5"},
    ],
    "clinical": [
        {"rule": "Retention time (RT/RRT) within ±2.5 % of the run's calibrators", "source": "CLSI C62",
         "rt_tolerance_pct": 2.5},
        {"rule": "Ion ratio within ±20 % (relative) of the mean of the run's calibrators; ±25 % when the "
                 "qualifier is <20 % of the quantifier", "source": "Koiné",
         "ion_ratio_pct": 20.0, "ion_ratio_weak_pct": 25.0, "weak_qualifier_below_pct": 20.0},
        {"rule": "IS area between 50 % and 150 % of the mean IS area of the run's calibrators and QCs",
         "source": "Koiné", "is_area_range_pct": [50.0, 150.0]},
    ],
}


# HIL test levels for clinical interference studies. Indicative and configurable per protocol or
# laboratory: not verified against CLSI EP37 (paid document), so never cited as an EP37 figure.
HIL_DEFAULTS = {"haemoglobin_mg_dl": 500.0, "bilirubin_mg_dl": 20.0, "triglycerides_mg_dl": 1000.0}


# ── Range (ULOQ confirmation, rule 1.14) ─────────────────────────────────────
ULOQ_SUGGESTION_LABEL = ("Valor sugerido desde la publicación fuente — confirmar o editar antes de "
                         "generar protocolos")


def suggest_range(lloq: Optional[float], uloq: Optional[float], unit: Optional[str]) -> dict:
    """What the Library can propose for the measuring interval. Never a validated value.

    The database keeps the published LLOQ/ULOQ, not the list of calibrators, so the suggestion
    exists only when the method stores a published ULOQ."""
    return {
        "lloq": lloq, "uloq": uloq, "unit": unit or None,
        "source": "publication" if (lloq is not None or uloq is not None) else None,
        "label": ULOQ_SUGGESTION_LABEL if uloq is not None else None,
        "needs_confirmation": True,
        "missing": [k for k, v in (("lloq", lloq), ("uloq", uloq)) if v is None],
    }


def _sig(x: float, n: int = 3) -> float:
    if x == 0:
        return 0.0
    return round(x, -int(math.floor(math.log10(abs(x)))) + (n - 1))


def calibrator_levels(lloq: float, uloq: float, n: int = 8) -> list[float]:
    """Suggested calibrators, spaced logarithmically from LLOQ to ULOQ (Koiné default)."""
    if n < 2:
        raise ValueError("At least two calibrators")
    return [_sig(lloq * (uloq / lloq) ** (i / (n - 1))) for i in range(n)]


# ── Plan (hook 2: instant validation plan) ───────────────────────────────────
def _qc_m10(lloq: float, uloq: float) -> list[dict]:
    return [
        {"level": "LLOQ", "conc": _sig(lloq), "limit": 20.0, "rule": "= LLOQ"},
        {"level": "LQC", "conc": _sig(3 * lloq), "limit": 15.0, "rule": "≤ 3 × LLOQ"},
        {"level": "MQC", "conc": _sig(lloq + 0.40 * (uloq - lloq)), "limit": 15.0,
         "rule": "30–50 % of the range (Koiné default 40 %)"},
        {"level": "HQC", "conc": _sig(0.80 * uloq), "limit": 15.0, "rule": "≥ 75 % of ULOQ (Koiné default 80 %)"},
    ]


def _qc_clinical(lloq: float, uloq: float, decision_points: Optional[list[float]]) -> list[dict]:
    if decision_points:
        pts = sorted(p for p in decision_points if lloq <= p <= uloq)
        if len(pts) >= 3:
            return [{"level": f"QC{i + 1}", "conc": _sig(p), "limit": 15.0, "rule": "Clinical decision point"}
                    for i, p in enumerate(pts)]
    # No decision points given: three levels across the interval, to be moved to the decision points.
    return [
        {"level": "Low", "conc": _sig(3 * lloq), "limit": 15.0, "rule": "Move to the low decision point"},
        {"level": "Medium", "conc": _sig(lloq + 0.40 * (uloq - lloq)), "limit": 15.0,
         "rule": "Move to the medium decision point"},
        {"level": "High", "conc": _sig(0.80 * uloq), "limit": 15.0, "rule": "Move to the high decision point"},
    ]


def _exp(key: str, label: str, source: str, *, design: str, criteria: Iterable[str] = (),
         injections: Optional[int] = None, required: bool = True, **extra) -> dict:
    d = {"key": key, "label": label, "required": required, "design": design, "criteria": list(criteria),
         "injections": injections, "source": source}
    d.update(extra)
    return d


def build_plan(profile: str, lloq: Optional[float], uloq: Optional[float], unit: Optional[str] = None, *,
               range_confirmed: bool = False, n_calibrators: int = 8, high_risk: bool = False,
               near_zero: bool = False, dilution_factors: Optional[list[float]] = None,
               matrix: Optional[str] = None, decision_points: Optional[list[float]] = None,
               hil: Optional[dict] = None) -> dict:
    """The experiments, design and acceptance criteria for one profile and measuring interval.

    The plan is a draft until the interval is confirmed by the user (rule 1.14): a draft can be
    read, but protocols and sample labels must not be generated from it."""
    base = _base(profile)
    blockers = []
    if lloq is None:
        blockers.append("LLOQ not set")
    if uloq is None:
        blockers.append("ULOQ not set")
    if lloq is not None and uloq is not None and not (0 < lloq < uloq):
        raise ValueError("The interval must satisfy 0 < LLOQ < ULOQ")
    if not range_confirmed:
        blockers.append("Measuring interval not confirmed by the user")
    plasma = bool(matrix and "plasma" in matrix.lower())
    edta = plasma and "edta" in (matrix or "").lower()
    dil = [f for f in (dilution_factors or []) if f and f > 1]

    has_range = lloq is not None and uloq is not None
    cals = calibrator_levels(lloq, uloq, n_calibrators) if has_range else []
    exps: list[dict] = []

    if base == "bioanalysis_m10":
        if not 6 <= n_calibrators <= 20:
            raise ValueError("ICH M10 needs at least 6 non-zero calibrators")
        qcs = _qc_m10(lloq, uloq) if has_range else []
        exps += [
            _exp("calibration", "Calibration curve", "ICH M10 §3.2.4",
                 design=f"Blank + zero + {n_calibrators} non-zero levels (LLOQ to ULOQ), in each of ≥3 runs on several days",
                 criteria=["Back-calculated ±15 % (±20 % at LLOQ)", "≥75 % of calibrators and ≥6 levels within",
                           "r² reported for information only, never used to accept or reject"],
                 injections=3 * (n_calibrators + 2), levels=cals),
            _exp("accuracy_precision", "Accuracy and precision", "ICH M10 §3.2.5",
                 design="4 QC levels × ≥5 replicates × ≥3 runs, ≥2 days",
                 criteria=["Accuracy ±15 % (±20 % at LLOQ)", "CV ≤15 % (≤20 % at LLOQ), within and between runs"],
                 injections=4 * 5 * 3, qcs=qcs),
            _exp("selectivity", "Selectivity", "ICH M10 §3.2.1",
                 design="≥6 individual blank matrix lots + ≥1 haemolysed (≥2 % v/v blood) + ≥1 lipaemic",
                 criteria=["Interference ≤20 % of the LLOQ response", "≤5 % of the IS response"], injections=8),
            _exp("specificity", "Specificity", "ICH M10 §3.2.2",
                 design="Related substances and metabolites expected in study samples; back-conversion where relevant",
                 criteria=["Interference ≤20 % of the LLOQ response and ≤5 % of the IS response"]),
            _exp("matrix_effect", "Matrix effect", "ICH M10 §3.2.3",
                 design="≥6 individual lots × LQC and HQC × ≥3 replicates",
                 criteria=["Each lot: accuracy ±15 % and CV ≤15 %"], injections=6 * 2 * 3),
            _exp("carryover", "Carry-over", "ICH M10 §3.2.6", design="Blank injected right after the ULOQ calibrator, in each A&P run",
                 criteria=["≤20 % of the LLOQ response", "≤5 % of the IS response"], injections=3),
            _exp("stability", "Stability", "ICH M10 §3.2.8",
                 design="LQC and HQC, ≥3 aliquots per condition: freeze-thaw (≥3 cycles, ≥12 h frozen), bench-top, "
                        "long-term, processed sample / autosampler, stock and working solutions"
                        + (", whole blood (plasma matrix)" if plasma else ""),
                 criteria=["Mean within ±15 % of nominal"], injections=2 * 3 * (6 if plasma else 5)),
            _exp("reinjection", "Reinjection reproducibility", "ICH M10 §3.2.9",
                 design="Calibrators + ≥5 replicates of LQC, MQC and HQC reinjected after storage in the autosampler",
                 criteria=["Accuracy and precision of the reinjected QCs"], injections=n_calibrators + 15),
        ]
    else:
        if not 6 <= n_calibrators <= 8:
            raise ValueError("The clinical profiles use 6 to 8 calibrators")
        clinical_qcs = _qc_clinical(lloq, uloq, decision_points) if has_range else []
        nlev = max(3, len(clinical_qcs))
        if base == "clinical_ceivd":
            ap = _exp("accuracy_precision", "Precision verification", "CLSI EP15-A3",
                      design=f"5 days × 5 replicates at {nlev} levels",
                      criteria=["Repeatability and within-laboratory CV meet the manufacturer's claims, "
                                "or the upper verification limit from the ANOVA"],
                      injections=25 * nlev, qcs=clinical_qcs)
        elif high_risk:
            ap = _exp("accuracy_precision", "Accuracy and precision · Full EP05 / High-Risk", "CLSI EP05-A3",
                      design=f"20 days × 2 runs × 2 replicates at {nlev} levels near the clinical decision points",
                      criteria=["Bias ±15 % and CV ≤15 % (±20 % / ≤20 % at LLMI)", "s_r, s_Rw by nested ANOVA"],
                      injections=80 * nlev, qcs=clinical_qcs)
        else:
            ap = _exp("accuracy_precision", "Accuracy and precision", "CLSI EP15-A3 (extended)",
                      design=f"5 days × 5 replicates (n = 25 per level) at {nlev} levels near the clinical decision points",
                      criteria=["Bias ±15 % and CV ≤15 % (±20 % / ≤20 % at LLMI)",
                                "Repeatability s_r and intermediate precision s_Rw by one-way ANOVA"],
                      injections=25 * nlev, qcs=clinical_qcs)
        h = dict(HIL_DEFAULTS, **{k: float(v) for k, v in (hil or {}).items() if k in HIL_DEFAULTS and v and v > 0})
        custom = h != HIL_DEFAULTS
        selectivity_items = [
            f"HIL indices: haemolysis ≥{h['haemoglobin_mg_dl']:g} mg/dL Hb, icterus ≥{h['bilirubin_mg_dl']:g} mg/dL "
            f"bilirubin, lipaemia ≥{h['triglycerides_mg_dl']:g} mg/dL triglycerides or Intralipid "
            f"({'set by the laboratory' if custom else 'indicative values, configurable'}; "
            "not verified against CLSI EP37)",
            "Common drugs: paracetamol, ibuprofen, acetylsalicylic acid, caffeine, omeprazole + drugs of the "
            "same therapeutic class",
            "Isobaric compounds and phase I/II metabolites from the Panel builder / Interference checker, "
            "including in-source fragmentation of glucuronides and sulfates to the parent",
        ]
        if edta:
            selectivity_items.insert(1, "Alternative anticoagulants: lithium heparin and citrate, "
                                        "or an explicit exclusion stated in the dossier")
        exps += [
            _exp("calibration", "Calibration curve", "CLSI C62",
                 design=f"Blank + zero + {n_calibrators} calibrators in equivalent matrix, covering LLMI, ULMI "
                        "and the clinical decision points",
                 criteria=["Back-calculated bias ±15 % (±20 % at LLMI)",
                           "r² reported for information only, never used to accept or reject"],
                 injections=n_calibrators + 2, levels=cals),
            ap,
            _exp("trueness", "Trueness", "Koiné design criterion, aligned with the metrological traceability and "
                                         "method validation principles of ISO 15189:2022 · CLSI EP09",
                 design="At least one route: (1) CRM or EQA samples with reference-method values; "
                        "(2) method comparison, ≥40 patient samples across the interval; "
                        "(3) recovery in real matrix when neither is available",
                 criteria=["Comparison by Passing-Bablok or Deming + Bland-Altman difference plot; "
                           "not ordinary least squares"],
                 routes=["crm_eqa", "method_comparison", "recovery"], min_comparison_samples=40),
            _exp("linearity", "Measuring interval and linearity", "CLSI EP06",
                 design="≥5 levels or pools of mixed real matrix (high + low), in duplicate or triplicate",
                 criteria=["Deviation from linearity within the allowable clinical goal"], injections=5 * 2),
            _exp("lloq", "LLMI / functional LLOQ", "CLSI C62 · CLSI EP17",
                 design="Lowest concentration meeting bias ≤ ±20 % and CV ≤20 % over ≥3 days",
                 criteria=["Bias ≤ ±20 %", "CV ≤20 %"]),
        ]
        if near_zero:
            exps.append(_exp("lob_lod", "LoB and LoD", "CLSI EP17",
                             design="≥4 blank samples × ≥2 replicates × ≥3 days, then low-level samples for LoD",
                             criteria=["LoB and LoD calculated as in CLSI EP17"], injections=4 * 2 * 3))
        exps += [
            _exp("selectivity", "Selectivity and interferences", "CLSI EP07",
                 design="Structured interference study", criteria=selectivity_items, hil=h),
            _exp("matrix_effect", "Matrix effect", "CLSI C62",
                 design="≥5 individual patient lots, spiked after extraction vs neat solvent, low and high "
                        "(3 replicates per lot and level: Koiné default)",
                 criteria=["IS-normalised matrix factor: CV ≤15 % between lots"], injections=5 * 2 * 3),
            _exp("carryover", "Carry-over", "ICH M10 §3.2.6 + clinical consensus",
                 design="Blank injected right after the ULMI",
                 criteria=["≤20 % of the LLMI response", "≤5 % of the IS response"], injections=2),
            _exp("stability", "Stability and pre-analytics", "ICH M10 §3.2.8 structure + Koiné",
                 design="Low and high, ≥3 aliquots per condition: freeze-thaw, bench-top, long-term, processed "
                        "sample / autosampler, stock and working solutions" + (", whole blood" if plasma else ""),
                 criteria=["Mean within ±15 % of t = 0",
                           "Pre-analytics documented: validated tube type, maximum time to centrifugation, "
                           "transport temperature"],
                 injections=2 * 3 * (6 if plasma else 5)),
            _exp("reinjection", "Reinjection", "ICH M10 §3.2.9", required=False,
                 design="Optional: calibrators + ≥5 replicates of low, medium and high after storage",
                 criteria=["Recommended to set the maximum recovery time after an instrument stop"]),
            _exp("uncertainty", "Measurement uncertainty", "ISO 15189:2022 §7.3.4",
                 design="From intermediate precision (s_Rw) and bias",
                 criteria=["u_c = √(u_Rw² + u_bias²)", "U = k · u_c, k = 2 (95 %)", "U compared with the TEa"]),
        ]
        if base == "clinical_inhouse":
            exps.append(_exp("ivdr_justification", "IVDR Art. 5(5)(d) justification", "IVDR (EU) 2017/746 Art. 5(5)(d)",
                             design="Editable template", criteria=[
                                 "Documents that no equivalent CE-IVD device on the market meets the laboratory's "
                                 "specific clinical need"]))

    if dil:
        exps.append(_exp("dilution", "Dilution integrity", "ICH M10 §3.2.7",
                         design=f"≥5 replicates per dilution factor ({', '.join(f'×{f:g}' for f in dil)}), "
                                "spiked above the upper limit and diluted with blank matrix",
                         criteria=["Accuracy ±15 %", "CV ≤15 %"], injections=5 * len(dil)))

    run_rules = RUN_ACCEPTANCE["bioanalysis_m10" if base == "bioanalysis_m10" else "clinical"]
    return {
        "rules_version": RULES_VERSION,
        "profile": profile, "profile_label": PROFILES[profile]["label"], "editable": PROFILES[profile]["editable"],
        "family": PROFILES[profile]["family"], "use_for": PROFILES[profile]["use_for"],
        "range": {"lloq": lloq, "uloq": uloq, "unit": unit, "confirmed": bool(range_confirmed) and has_range},
        "status": "draft" if blockers else "ready",
        "blockers": blockers,
        # Rule 1.14: no definitive protocol or sample labels until the interval is confirmed.
        "can_generate_protocols": not blockers,
        "experiments": exps,
        "run_acceptance": run_rules,
        "total_injections": sum(e["injections"] or 0 for e in exps),
    }


# ── Calibration (rule 1.1, no r² gate) ───────────────────────────────────────
def _wls(x: list[float], y: list[float], w: str):
    wt = [1.0 if w == "1" else (1 / v if w == "1/x" else 1 / (v * v)) for v in x]
    sw = sum(wt)
    mx = sum(a * b for a, b in zip(wt, x)) / sw
    my = sum(a * b for a, b in zip(wt, y)) / sw
    sxy = sum(a * (xi - mx) * (yi - my) for a, xi, yi in zip(wt, x, y))
    sxx = sum(a * (xi - mx) ** 2 for a, xi in zip(wt, x))
    slope = sxy / sxx
    return slope, my - slope * mx


def evaluate_calibration(profile: str, nominal: list[float], response: Optional[list[float]] = None,
                         measured: Optional[list[float]] = None, weighting: str = "auto") -> dict:
    """Back-calculated accuracy of one calibration run.

    Give either the instrument responses (area ratios: the engine fits the curve) or the
    back-calculated concentrations from the quantitation software. The verdict never uses r²."""
    crit = CALIBRATION["bioanalysis_m10" if _base(profile) == "bioanalysis_m10" else "clinical"]
    n = len(nominal)
    if n < 2 or any(v <= 0 for v in nominal):
        raise ValueError("Nominal concentrations must be positive, at least two")
    if (response is None) == (measured is None):
        raise ValueError("Give either responses or back-calculated concentrations")
    fit = None
    if response is not None:
        if len(response) != n:
            raise ValueError("One response per calibrator")
        options = ["1", "1/x", "1/x2"] if weighting == "auto" else [weighting]
        if any(o not in ("1", "1/x", "1/x2") for o in options):
            raise ValueError("Weighting must be 1, 1/x, 1/x2 or auto")
        best = None
        for w in options:
            slope, icpt = _wls(nominal, response, w)
            back = [(r - icpt) / slope for r in response]
            sre = sum(abs(100 * (b / x - 1)) for b, x in zip(back, nominal))
            if best is None or sre < best[0]:
                best = (sre, w, slope, icpt, back)
        _, w, slope, icpt, measured = best
        fit = {"weighting": w, "slope": slope, "intercept": icpt,
               "chosen_by": "lowest sum of |relative error|" if weighting == "auto" else "user"}
    elif len(measured) != n:
        raise ValueError("One back-calculated value per calibrator")

    order = sorted(range(n), key=lambda i: nominal[i])
    lowest = order[0]
    levels = []
    for i in range(n):
        bias = 100 * (measured[i] / nominal[i] - 1)
        lim = crit["limit_lowest"] if i == lowest else crit["limit"]
        levels.append({"nominal": nominal[i], "measured": measured[i], "bias_pct": bias, "limit_pct": lim,
                       "pass": abs(bias) <= lim + 1e-9})
    passing = sum(l["pass"] for l in levels)
    need = max(crit["min_passing_levels"], math.ceil(crit["min_pass_fraction"] * n))
    reasons = []
    if n < crit["min_levels"]:
        reasons.append(f"{n} calibrators; at least {crit['min_levels']} non-zero levels are needed")
    if passing < need:
        reasons.append(f"{passing} of {n} calibrators within limits; at least {need} needed")

    # Informative only (rule 1.1): plain Pearson r² of response (or measured) against nominal.
    ys = response if response is not None else measured
    mx, my = sum(nominal) / n, sum(ys) / n
    sxy = sum((x - mx) * (y - my) for x, y in zip(nominal, ys))
    sxx = sum((x - mx) ** 2 for x in nominal)
    syy = sum((y - my) ** 2 for y in ys)
    r2 = (sxy * sxy / (sxx * syy)) if sxx and syy else None
    return {
        "rules_version": RULES_VERSION, "source": crit["source"], "fit": fit, "levels": levels,
        "passing": passing, "required_passing": need, "pass": not reasons, "reasons": reasons,
        "r2": {"value": r2, "used_for_verdict": False,
               "note": "Shown for information. A high r² can hide large errors at the low end of a weighted curve."},
    }


# ── Measurement uncertainty (rule 1.13) ──────────────────────────────────────
def uncertainty_budget(u_rw_pct: float, *, u_bias_pct: Optional[float] = None, bias_pct: Optional[float] = None,
                       u_cref_pct: Optional[float] = None, k: float = 2.0, tea_pct: Optional[float] = None) -> dict:
    """u_c = √(u_Rw² + u_bias²), U = k·u_c (ISO 15189:2022 §7.3.4), compared with the TEa.

    u_bias can be given directly, or from the bias found and the uncertainty of the reference value:
    u_bias = √(bias² + u_cref²) (Koiné calculation)."""
    if u_rw_pct is None or u_rw_pct < 0:
        raise ValueError("u_Rw must be ≥ 0")
    how = "given"
    if u_bias_pct is None:
        if bias_pct is None:
            raise ValueError("Give u_bias, or the bias (and optionally the reference uncertainty)")
        u_bias_pct = math.sqrt(bias_pct ** 2 + (u_cref_pct or 0) ** 2)
        how = "√(bias² + u_cref²)"
    uc = math.sqrt(u_rw_pct ** 2 + u_bias_pct ** 2)
    U = k * uc
    out = {"rules_version": RULES_VERSION, "source": "ISO 15189:2022 §7.3.4", "u_rw_pct": u_rw_pct,
           "u_bias_pct": u_bias_pct, "u_bias_from": how, "u_c_pct": uc, "k": k, "U_pct": U,
           "tea_pct": tea_pct, "pass": None}
    if tea_pct is not None:
        out["pass"] = U <= tea_pct
    return out


# ── Change control (Table B) ─────────────────────────────────────────────────
LEVELS = ["routine", "verification", "partial", "partial_broad", "full"]
LEVEL_LABEL = {"routine": "Routine control", "verification": "Verification", "partial": "Partial",
               "partial_broad": "Broad partial", "full": "Full validation"}

EXPERIMENT_LABEL = {
    "run_acceptance": "Run acceptance criteria", "selectivity": "Selectivity", "specificity": "Specificity",
    "matrix_effect": "Matrix effect", "carryover": "Carry-over", "accuracy_precision": "Accuracy and precision",
    "lloq": "LLOQ", "calibration": "Calibration", "linearity": "Linearity / calibration", "trueness": "Trueness",
    "transition_optimization": "Transition optimisation (CE / voltages)", "ion_ratio": "Ion ratio",
    "recovery": "Recovery", "processed_stability": "Processed-sample stability", "stability": "Stability",
    "dilution": "Dilution integrity", "in_source_fragmentation": "In-source fragmentation check",
    "reagent_blank": "Reagent blank (Na/K adducts)", "reprocess_dataset": "Reprocess the validated reference dataset",
}


def _E(key: str, runs: Optional[int] = None, note: Optional[str] = None) -> dict:
    return {"key": key, "runs": runs, "note": note}


# separation: changes to the chromatographic separation; matrix_prep: changes to the matrix or sample
# preparation. One of each together escalates to a full validation (combination rule 3).
CHANGES = [
    {"id": "1", "label": "New lot of the same column", "level": "routine", "ref": "Koiné",
     "experiments": [_E("run_acceptance", note="RT, critical resolution, IS area")]},
    {"id": "2", "label": "Column of the same chemistry, other dimensions (scaling)", "level": "partial", "ref": "Koiné",
     "tags": ["separation"],
     "experiments": [_E("selectivity", note="resolution from the critical isobar"), _E("matrix_effect"),
                     _E("carryover"), _E("accuracy_precision", 1)]},
    {"id": "3", "label": "Column of another chemistry (e.g. C18 → Biphenyl / HILIC)", "level": "full", "ref": "Koiné",
     "tags": ["separation"], "experiments": [],
     "why": "Selectivity and phospholipid elution change"},
    {"id": "4", "label": "Mobile phase (organic composition or additive / pH)", "level": "partial_broad", "ref": "Koiné",
     "tags": ["separation"],
     "experiments": [_E("selectivity"), _E("matrix_effect"), _E("lloq"), _E("accuracy_precision", 3)]},
    {"id": "5", "label": "Gradient or flow (same column and phases)", "level": "partial", "ref": "Koiné",
     "tags": ["separation"],
     "experiments": [_E("selectivity", note="isobars"), _E("matrix_effect"), _E("accuracy_precision", 1)]},
    {"id": "6", "label": "Same MS model, another unit or site", "level": "partial",
     "ref": "ICH M10 §6.1 (type of change) + Koiné (experiments)",
     "experiments": [_E("accuracy_precision", 3, "3 runs or 5×5"), _E("lloq"), _E("carryover")]},
    {"id": "7", "label": "Another MS model from the same manufacturer", "level": "partial_broad",
     "ref": "ICH M10 §6.1 (type of change) + Koiné (experiments)",
     "experiments": [_E("transition_optimization"), _E("calibration"), _E("accuracy_precision", 3), _E("lloq"),
                     _E("matrix_effect"), _E("carryover")]},
    {"id": "8", "label": "MS from another manufacturer", "level": "full",
     "ref": "ICH M10 §6.1 (type of change) + Koiné (full validation)", "experiments": []},
    {"id": "9a", "label": "IS change between stable isotopes (²H ↔ ¹³C)", "level": "partial", "ref": "Koiné",
     "experiments": [_E("selectivity", note="interference on the IS"),
                     _E("matrix_effect", note="IS-normalised"), _E("accuracy_precision", 1)]},
    {"id": "9b", "label": "IS change from labelled to structural analogue", "level": "partial_broad", "ref": "Koiné",
     "experiments": [_E("matrix_effect", note="complete, 6 lots"), _E("linearity"), _E("trueness"),
                     _E("accuracy_precision", 3)]},
    {"id": "10", "label": "Transition change (quantifier or qualifier)", "level": "partial", "ref": "Koiné",
     "experiments": [_E("selectivity"), _E("specificity"), _E("lloq"), _E("ion_ratio"), _E("accuracy_precision", 1)]},
    {"id": "11", "label": "Sample preparation (extraction / precipitation)", "level": "partial_broad",
     "ref": "ICH M10 §6.1 (type of change) + Koiné (experiments)", "tags": ["matrix_prep"],
     "experiments": [_E("accuracy_precision", 3), _E("matrix_effect"), _E("recovery"), _E("lloq"),
                     _E("processed_stability")]},
    {"id": "12", "label": "Sample volume", "level": "partial",
     "ref": "ICH M10 §6.1 (type of change) + Koiné (experiments)",
     "experiments": [_E("accuracy_precision", 1), _E("lloq"), _E("carryover")]},
    {"id": "13", "label": "Calibration interval (extended or reduced)", "level": "partial",
     "ref": "ICH M10 §6.1 (type of change) + Koiné (experiments)",
     "experiments": [_E("calibration"), _E("accuracy_precision", note="at the new limits"),
                     _E("dilution", note="if the ULOQ goes up")]},
    {"id": "14", "label": "Matrix (serum ↔ plasma) or anticoagulant", "level": "partial_broad",
     "ref": "ICH M10 §6.1 (type of change) + Koiné (experiments)", "tags": ["matrix_prep"],
     "experiments": [_E("selectivity"), _E("matrix_effect"), _E("accuracy_precision", 3),
                     _E("stability", note="whole blood if plasma")]},
    {"id": "15", "label": "Tube type (e.g. plain → SST gel tube)", "level": "partial", "ref": "Koiné",
     "tags": ["matrix_prep"],
     "experiments": [_E("matrix_effect", note="suppression by gel polymers"), _E("selectivity"), _E("stability")]},
    {"id": "16", "label": "Ion source parameters (temperature, gas, capillary voltage)", "level": "partial",
     "ref": "Koiné",
     "experiments": [_E("in_source_fragmentation"), _E("lloq"), _E("accuracy_precision", 1)]},
    {"id": "17", "label": "Column oven temperature (Δ > 2 °C)", "level": "partial", "ref": "Koiné",
     "tags": ["separation"],
     "experiments": [_E("selectivity", note="resolution of isobars"), _E("accuracy_precision", 1)]},
    {"id": "18", "label": "Sample storage conditions", "level": "partial",
     "ref": "ICH M10 §6.1 (type of change) + Koiné (experiments)",
     "experiments": [_E("stability", note="in the new conditions")]},
    {"id": "19", "label": "Supplier or grade of solvents or additives", "level": "routine", "ref": "Koiné",
     "experiments": [_E("reagent_blank"), _E("lloq", note="sensitivity in the first run")]},
    {"id": "20", "label": "Acquisition or processing software update", "level": "verification", "ref": "Koiné",
     "experiments": [_E("reprocess_dataset", note="verify equivalent results")]},
]
CHANGE_BY_ID = {c["id"]: c for c in CHANGES}


def next_version(current: str, level: str) -> str:
    m = re.fullmatch(r"v?(\d+)\.(\d+)", (current or "").strip())
    if not m:
        raise ValueError("Version must look like v1.0")
    major, minor = int(m.group(1)), int(m.group(2))
    if level in ("routine", "verification"):
        return f"v{major}.{minor}"
    if level == "full":
        return f"v{major + 1}.0"
    return f"v{major}.{minor + 1}"


def change_impact(change_ids: list[str], profile: str = "clinical_inhouse", current_version: str = "v1.0") -> dict:
    """What a set of simultaneous changes requires (Table B and its combination rules)."""
    _base(profile)
    ids = list(dict.fromkeys(change_ids))
    unknown = [i for i in ids if i not in CHANGE_BY_ID]
    if unknown:
        raise ValueError(f"Unknown change: {', '.join(unknown)}")
    if not ids:
        raise ValueError("Select at least one change")
    changes = [CHANGE_BY_ID[i] for i in ids]
    level = max((c["level"] for c in changes), key=LEVELS.index)
    escalations = []
    broad = [c["id"] for c in changes if c["level"] == "partial_broad"]
    if len(broad) >= 3:
        escalations.append({"rule": "≥3 broad partial changes", "changes": broad})
    sep = [c["id"] for c in changes if "separation" in c.get("tags", [])]
    prep = [c["id"] for c in changes if "matrix_prep" in c.get("tags", [])]
    if sep and prep:
        escalations.append({"rule": "Chromatographic separation and matrix / sample preparation changed together",
                            "changes": sep + prep})
    if escalations:
        level = "full"

    merged: dict[str, dict] = {}
    for c in changes:
        for e in c["experiments"]:
            m = merged.setdefault(e["key"], {"key": e["key"], "label": EXPERIMENT_LABEL[e["key"]], "runs": None,
                                             "notes": [], "from": []})
            if e["runs"]:
                m["runs"] = max(m["runs"] or 0, e["runs"])
            if e["note"] and e["note"] not in m["notes"]:
                m["notes"].append(e["note"])
            m["from"].append(c["id"])
    experiments = list(merged.values())
    full_plan = None
    if level == "full":
        # A full validation repeats every experiment of the profile; the measuring interval is
        # whatever the method has, so the experiments are listed without concentrations.
        full_plan = [{"key": e["key"], "label": e["label"], "required": e["required"], "source": e["source"]}
                     for e in build_plan(profile, None, None)["experiments"]]
    return {
        "rules_version": RULES_VERSION, "profile": profile,
        "changes": [{"id": c["id"], "label": c["label"], "level": c["level"], "ref": c["ref"]} for c in changes],
        "level": level, "level_label": LEVEL_LABEL[level],
        "escalations": escalations,
        "experiments": experiments if level != "full" else [],
        "full_validation": full_plan,
        "current_version": current_version, "next_version": next_version(current_version, level),
    }


# ── IVDR Art. 5(5)(d) justification (rule 1.13, clinical in-house only) ─────
IVDR_5_5_D = ("the health institution justifies in its documentation that the target patient group's specific "
              "needs cannot be met, or cannot be met at the appropriate level of performance by an equivalent "
              "device available on the market")

# Specific needs. The first three are the examples given in MDCG 2023-1 §3.6.1; the rest are common
# LC-MS/MS reasons offered by Koiné.
IVDR_NEEDS = [
    {"id": "paediatric", "source": "MDCG 2023-1 §3.6.1 (example)",
     "text": "Paediatric patients: the available CE-IVD devices are intended for adults and the reference values differ."},
    {"id": "sensitivity", "source": "MDCG 2023-1 §3.6.1 (example)",
     "text": "The clinical decision needs concentrations below what the available CE-IVD devices measure reliably "
             "(e.g. oestradiol in patients on aromatase inhibitors)."},
    {"id": "multiplex", "source": "MDCG 2023-1 §3.6.1 (example)",
     "text": "One test replaces two or more CE-IVD tests, so the patient needs fewer specimen collections."},
    {"id": "specimen", "source": "Koiné (MDCG 2023-1 §3.6.2: approved specimen material)",
     "text": "The specimen type used for these patients is not approved for the available CE-IVD devices."},
    {"id": "no_device", "source": "Koiné",
     "text": "No CE-IVD device for this analyte is available on the market of the Member State."},
    {"id": "specificity", "source": "Koiné",
     "text": "The cross-reactivity of the available immunoassays is not acceptable for this patient group."},
]
# Grounds of non-equivalence listed in MDCG 2023-1 §3.6.2.
IVDR_NON_EQUIVALENCE = [
    "Intended purpose", "Clinical condition", "Patient group", "Conditions of use", "Operating principle",
    "Approved specimen material", "Critical performance characteristics", "Critical technical specifications",
]
IVDR_MARKET_SOURCES = ["EUDAMED", "Manufacturers", "Distributors", "Scientific conferences"]


def ivdr_template(analyte: Optional[str] = None, matrix: Optional[str] = None, title: Optional[str] = None) -> dict:
    """Pre-filled, editable Article 5(5)(d) justification. Koiné drafts; the laboratory decides and signs."""
    what = analyte or "[analyte]"
    where = (matrix or "[specimen]").lower()
    return {
        "rules_version": RULES_VERSION,
        "source": "IVDR (EU) 2017/746 Art. 5(5)(d) · MDCG 2023-1 §3.6",
        "legal_text": IVDR_5_5_D,
        "regulatory_note": "A revision of Article 5(5) has been proposed (2025/0404 COD). Check the text in force "
                           "before signing.",
        "sections": [
            {"id": "device", "title": "In-house test",
             "text": f"Quantification of {what} in {where} by LC-MS/MS"
                     + (f", based on the published method \u201c{title}\u201d" if title else "") + ".",
             "help": "What the test measures, in which specimen, and for which clinical purpose."},
            {"id": "patient_group", "title": "Target patient group", "text": "",
             "help": "Patients who share the same disease, condition or characteristics and benefit from the test "
                     "(MDCG 2023-1 §3.6.1)."},
            {"id": "need", "title": "Specific need", "text": "", "options": IVDR_NEEDS,
             "help": "A need for a specific device, or for a specified level of performance (MDCG 2023-1 §3.6.1)."},
            {"id": "market", "title": "Market search", "text": "", "sources": IVDR_MARKET_SOURCES,
             "non_equivalence": IVDR_NON_EQUIVALENCE,
             "help": "CE-IVD devices available in your Member State, and why each one is not equivalent or does not "
                     "reach the performance needed (MDCG 2023-1 §3.6.2–3.6.4). Record the date and the sources."},
            {"id": "not_economic", "title": "Clinical, not economic, reasons",
             "text": "This test is manufactured in-house for the clinical reasons above, not for economic motives "
                     "or financial interest.",
             "help": "Devices made in-house purely for economic motives are not in-house devices (MDCG 2023-1 §3.2.3)."},
            {"id": "review", "title": "Review", "text": "This justification is reviewed at least once a year and "
                     "whenever a new CE-IVD device for this analyte becomes available. If an equivalent device meets "
                     "the patients' needs at the appropriate level of performance, a transition to it is started.",
             "help": "Keep checking the market and update the justification (MDCG 2023-1 §3.6.3)."},
        ],
    }


def rules_catalog() -> dict:
    """Everything the interface needs to show the rules, with their sources."""
    return {
        "rules_version": RULES_VERSION,
        "profiles": [{"id": k, **v} for k, v in PROFILES.items()],
        "calibration": CALIBRATION,
        "run_acceptance": RUN_ACCEPTANCE,
        "uloq_label": ULOQ_SUGGESTION_LABEL,
        "hil_defaults": dict(HIL_DEFAULTS, note="Indicative, configurable; not verified against CLSI EP37"),
        "changes": [dict({k: c[k] for k in ("id", "label", "level", "ref")}, tags=c.get("tags", []),
                         experiments=[{"key": e["key"], "label": EXPERIMENT_LABEL[e["key"]], "runs": e["runs"],
                                       "note": e["note"]} for e in c["experiments"]], why=c.get("why"))
                    for c in CHANGES],
        "levels": [{"id": l, "label": LEVEL_LABEL[l]} for l in LEVELS],
        "combination_rules": [
            "Union of the experiments of every change; the most severe level prevails",
            "≥3 broad partial changes → full validation",
            "A chromatographic-separation change (2, 3, 4, 5, 17) together with a matrix / sample-preparation "
            "change (11, 14, 15) → full validation",
        ],
        "versioning": {"routine": "keeps the version", "verification": "keeps the version",
                       "partial": "minor +1", "partial_broad": "minor +1", "full": "major +1"},
    }
