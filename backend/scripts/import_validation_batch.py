"""Per-analyte validation data (2026-11-16) for the six methods imported from
open-access articles (ids resolved by DOI). Values are as printed in the
articles' validation tables (two independent readings agreed).

The Validation tab holds one CV and one accuracy per analyte, while the
articles report several QC levels, so the WORST CASE is stored (highest CV,
accuracy furthest from 100%) and the full range goes in the row's note.
Bias (RE %) is converted to % of nominal as 100 + bias.
Run once from the project root:  python -m backend.scripts.import_validation_batch
"""
from backend.database import SessionLocal
from backend.models import Method, CompoundValidation


def rng(vals, d=1):
    lo, hi = min(vals), max(vals)
    return f"{lo:.{d}f}" if lo == hi else f"{lo:.{d}f}–{hi:.{d}f}"


def worst_acc(vals):
    return max(vals, key=lambda v: abs(v - 100))


def from_levels(name, lod, loq, r2, levels, bias=False, n_levels=None, extra=""):
    """levels: list of (intraCV, interCV, intraAcc, interAcc); None where not reported."""
    intra = [l[0] for l in levels if l[0] is not None]
    inter = [l[1] for l in levels if l[1] is not None]
    acc = [(100 + a if bias else a) for l in levels for a in l[2:4] if a is not None]
    parts = [f"Worst case over {n_levels or len(levels)} QC levels."]
    if intra: parts.append(f"Intra-day CV {rng(intra)}%.")
    if inter: parts.append(f"Inter-day CV {rng(inter)}%.")
    if acc: parts.append(f"Accuracy {rng(acc)}% of nominal.")
    if extra: parts.append(extra)
    return dict(compound_name=name, lod=lod, loq=loq, r2=r2, cv_percent=max(intra + inter) if intra + inter else None,
                accuracy_percent=round(worst_acc(acc), 1) if acc else None, notes=" ".join(parts)[:500])


# ── Feliu 2021 (mg/L; accuracy as % of nominal; levels low/medium/high) ─────
FELIU = {
 "Amoxicillin": (0.1, 1.6, 0.9990, [(1.3,8.1,109.0,101.8),(1.9,7.1,95.7,106.5),(2.2,6.2,111.1,104.1)]),
 "Aztreonam": (0.1, 3.9, 0.9993, [(1.8,10.2,100.1,90.3),(1.9,9.2,101.2,90.0),(2.4,5.7,103.3,108.5)]),
 "Cefazolin": (0.01, 1.6, 0.9999, [(1.8,5.3,91.6,91.4),(2.5,4.8,91.7,105.3),(2.2,6.1,106.6,104.0)]),
 "Cefepime": (0.01, 1.6, 0.9997, [(2.2,4.5,101.7,97.4),(2.8,4.2,104.3,99.8),(2.5,6.4,101.2,95.5)]),
 "Cefotaxime": (0.1, 1.6, 0.9999, [(1.6,10.3,104.7,104.1),(2.2,8.8,107.8,104.5),(0.9,6.1,112.3,114.4)]),
 "Cefoxitin": (0.01, 0.6, 0.9998, [(1.3,8.9,93.2,95.1),(2.7,9.1,96.0,98.8),(2.0,12.5,99.7,106.3)]),
 "Ceftazidime": (0.02, 1.6, 0.9998, [(2.1,6.6,105.2,104.3),(3.2,5.7,105.1,102.7),(2.7,6.2,100.9,100.3)]),
 "Ciprofloxacin": (0.001, 0.1, 0.9998, [(1.1,6.6,90.9,88.9),(1.9,5.3,94.2,91.1),(2.3,6.3,94.9,91.3)]),
 "Clindamycin": (0.002, 0.1, 0.9998, [(1.6,6.5,110.0,89.4),(2.3,5.3,109.0,91.8),(1.2,6.1,112.7,97.0)]),
 "Daptomycin": (0.3, 1.6, 0.9996, [(1.8,11.3,110.2,92.4),(2.2,10.7,111.5,91.7),(1.2,8.2,110.2,97.6)]),
 "Ertapenem": (0.004, 0.8, 0.9996, [(1.5,8.4,90.7,86.3),(2.6,7.1,103.8,94.7),(1.5,8.1,113.0,100.8)]),
 "Linezolid": (0.004, 0.4, 0.9999, [(2.1,6.1,87.9,89.3),(2.2,5.2,90.9,90.5),(1.1,3.1,91.6,95.3)]),
 "Meropenem": (0.003, 0.8, 0.9998, [(1.9,8.1,111.8,103.3),(2.7,6.6,112.1,107.5),(2.1,8.8,112.4,107.9)]),
 "Ofloxacin": (0.006, 0.1, 0.9998, [(2.1,7.6,110.6,92.7),(2.3,4.9,113.4,89.6),(1.8,5.1,104.1,85.9)]),
 "Piperacillin": (0.03, 1.6, 0.9999, [(2.1,9.6,109.1,98.3),(2.7,7.9,114.4,102.0),(2.9,5.6,113.6,104.0)]),
}
feliu_rows = [from_levels(n, lod, loq, r2, lv, extra=("Recovery about 20% (text)." if n == "Aztreonam" else "Recovery >75% (text)."))
              for n, (lod, loq, r2, lv) in FELIU.items()]

# ── Zhang 2026 (µg/mL; accuracy as bias RE %; levels LLOQ/LQC/MQC/HQC) ──────
# name: (LLOQ, R2, levels, recovery L/M/H, IS-normalised matrix factor L/M/H)
ZHANG = {
 "Caspofungin": (0.5, 0.9972, [(7.1,12.0,-6.6,-3.2),(3.4,4.7,-2.7,-1.3),(4.5,6.3,-4.8,1.3),(5.6,6.7,-5.5,-2.5)], (81.6,88.1,86.3), (98.1,93.2,101.9)),
 "Imipenem": (1, 0.9931, [(9.9,10.4,-1.2,-0.7),(10.2,10.3,7.7,3.3),(6.3,7.2,-0.6,-4.4),(7.9,9.2,-5.0,-6.4)], (38.1,36.1,33.6), (88.0,101.3,107.2)),
 "Linezolid": (0.25, 0.9993, [(6.3,9.1,-11.2,-7.2),(6.9,6.3,0.9,4.5),(9.0,6.1,2.8,6.5),(4.8,6.0,-5.5,-0.5)], (106.4,106.8,103.1), (97.9,97.3,111.8)),
 "Meropenem": (1, 0.9906, [(8.8,9.2,4.4,4.4),(9.0,7.3,-3.7,0.0),(6.6,7.7,-5.0,-3.1),(6.0,6.5,-2.3,-3.1)], (92.1,92.5,94.7), (104.7,93.9,100.2)),
 "Latamoxef": (1, 0.9943, [(9.1,8.9,4.9,6.6),(4.3,6.8,-0.3,-1.3),(4.8,4.3,4.4,1.9),(3.6,5.5,11.8,6.8)], (32.2,31.5,33.5), (106.9,95.9,104.7)),
 "Piperacillin": (1, 0.9931, [(9.4,8.6,-7.2,0.6),(9.7,7.4,3.3,3.3),(8.5,6.2,2.5,1.3),(7.3,7.6,3.9,2.3)], (97.8,96.4,96.9), (93.1,97.5,103.3)),
 "Voriconazole": (0.1, 0.9980, [(12.1,7.9,-0.8,-3.0),(5.5,5.5,3.0,2.3),(7.7,5.6,-2.5,0.0),(4.6,4.0,-2.4,-0.6)], (102.8,103.5,101.9), (100.6,95.5,104.3)),
 "Posaconazole": (0.5, 0.9979, [(10.5,10.0,-6.6,2.0),(7.9,6.2,0.7,-3.3),(6.9,5.8,-6.0,-2.9),(9.1,8.8,-1.3,2.3)], (75.8,84.1,79.2), (95.3,92.0,96.6)),
 "Cefmetazole": (1, 0.9949, [(9.4,9.9,5.0,0.4),(4.6,4.9,9.3,8.3),(2.9,4.7,6.3,6.9),(5.6,6.5,5.0,2.4)], (92.1,100.8,85.7), (108.3,99.1,103.6)),
 "Tigecycline": (0.5, 0.9958, [(10.0,12.0,8.0,1.8),(5.5,7.2,-3.3,1.3),(8.0,7.3,-3.1,-0.5),(4.8,7.5,-10.3,-7.5)], (106.0,97.8,96.2), (102.1,99.1,113.5)),
 "Cefazolin": (1, 0.9955, [(5.8,13.3,-11.5,-10.0),(6.2,9.0,2.0,0.3),(6.0,6.3,-6.3,-0.6),(6.2,6.9,-0.9,-2.4)], (92.8,97.1,93.9), (106.9,97.2,104.4)),
}
zhang_rows = [from_levels(n, None, loq, r2, lv, bias=True,
                          extra=f"Recovery {rng(rec)}%. IS-normalised matrix factor {rng(mf)}%.")
              for n, (loq, r2, lv, rec, mf) in ZHANG.items()]

# ── Li 2023 (µg/mL; one %bias per level; levels LLOQ/LQC/MQC/HQC) ───────────
# name: levels (intraCV, interCV, bias), recovery LQC/HQC, matrix factor LQC/HQC
LI = {
 "Isavuconazole": ([(9.4,12.8,16.1),(6.2,10.2,13.6),(6.3,8.9,7.2),(8.2,13.2,-10.9)], (91.23,87.23), (1.68,2.17)),
 "Amphotericin B": ([(7.9,11.3,9.2),(7.3,9.4,4.2),(3.9,8.6,4.2),(7.5,6.9,8.4)], (95.22,104.34), (2.31,2.21)),
 "Voriconazole": ([(4.8,8.4,4.6),(4.1,9.3,10.7),(3.2,5.7,8.5),(3.5,3.1,1.0)], (94.33,105.24), (1.68,1.81)),
 "Fluconazole": ([(4.4,4.1,2.8),(2.3,5.4,0.8),(1.2,3.2,1.4),(2.1,2.4,10.9)], (92.11,87.35), (1.39,1.47)),
 "Caspofungin": ([(8.9,12.7,4.3),(9.2,11.4,10.8),(6.7,8.3,2.7),(11.2,9.3,-1.4)], (94.23,90.27), (2.14,1.94)),
 "Posaconazole": ([(11.9,13.2,8.9),(6.6,6.7,5.3),(5.6,4.2,8.9),(10.3,12.5,-6.4)], (92.65,82.27), (1.17,1.42)),
 "Micafungin": ([(8.3,10.4,11.9),(8.2,7.9,7.3),(8.2,7.6,7.0),(9.3,13.2,6.3)], (85.34,82.45), (1.29,1.41)),
}
li_rows = [from_levels(n, None, 0.1, None, [(a, b, c, None) for a, b, c in lv], bias=True,
                       extra=f"Recovery {rng(rec, 2)}%. Matrix factor {rng(mf, 2)} (LQC, HQC). No per-compound R² (article: all above 0.9835).")
           for n, (lv, rec, mf) in LI.items()]

# ── Ren 2023 (ng/mL, plasma; inter-day rows; accuracy as bias RE %) ─────────
REN = {
 "Rivaroxaban": (0.9992, [(8.5,-3.6),(4.2,3.7),(2.1,5.1),(3.9,1.1)]),
 "Apixaban": (0.9986, [(11,0.8),(6.0,7.0),(3.0,7.1),(5.0,0.4)]),
 "Edoxaban": (0.9991, [(14,-2.6),(6.0,2.6),(2.0,6.0),(4.0,3.0)]),
 "Betrixaban": (0.9990, [(9,-7),(6.0,1.9),(3.0,5.8),(4.0,-0.4)]),
}
ren_rows = [from_levels(n, None, 1, r2, [(None, cv, None, re) for cv, re in lv], bias=True,
                        extra="Plasma, inter-day rows of Table 3; the per-run intra-day values are not transcribed.")
            for n, (r2, lv) in REN.items()]

# ── Bellouard 2024 (ng/mL; Table 5 gives ranges; accuracy as % of nominal) ──
# name: LOD, LOQ, R2, intraCV range, interCV range, intra accuracy range, inter accuracy range
BEL = {
 "Dabrafenib": (0.5, 5, 0.9984, (3.5,5.5), (2.1,8.4), (88.3,103.7), (89,102.9)),
 "Trametinib": (0.5, 1, 0.9980, (4.7,10.8), (2,14.9), (91.8,111.3), (92.4,106.3)),
 "Cobimetinib": (0.4, 2, 0.9986, (4.7,7.3), (2.5,4.9), (88.3,103.1), (89.6,102)),
 "Encorafenib": (1, 5, 0.9990, (3.9,7.4), (5.2,14.8), (90.8,106.3), (92.8,103.2)),
 "Binimetinib": (0.2, 2, 0.9989, (3.4,6.7), (2.5,8.4), (89.5,103.1), (92.7,99.5)),
 "Osimertinib": (2, 2, 0.9959, (4.3,8.1), (5.6,7.9), (96.9,113.7), (100.3,109.8)),
 "AZ5104": (0.1, 0.2, 0.9987, (5.8,9.8), (9.9,14.6), (88.7,113.6), (93.8,107.4)),
 "Crizotinib": (2, 10, 0.9974, (2.8,6.3), (1,12.3), (85.1,109), (87.5,108.5)),
 "Alectinib": (0.2, 2, 0.9984, (5.3,8.8), (1.9,14.4), (85.4,103.9), (89.8,102.4)),
 "Alectinib M4": (0.2, 2, 1.0, (6.4,10.2), (11.2,11.8), (86.8,106.3), (91.3,103.1)),
 "Imatinib": (2.5, 5, 0.9990, (3.9,5.9), (6.1,11), (88.7,97.5), (92,94.9)),
 "Lorlatinib": (0.2, 2, 0.9980, (3.7,6.9), (8,14.6), (89.5,105.3), (95.7,99)),
}
bel_rows = []
for n, (lod, loq, r2, icv, ecv, iacc, eacc) in BEL.items():
    accs = list(iacc) + list(eacc)
    bel_rows.append(dict(
        compound_name=n, lod=lod, loq=loq, r2=r2, cv_percent=max(icv + ecv), accuracy_percent=worst_acc(accs),
        notes=(f"Worst case of the ranges in Table 5. Intra-day CV {icv[0]}–{icv[1]}%. Inter-day CV {ecv[0]}–{ecv[1]}%. "
               f"Accuracy intra-day {iacc[0]}–{iacc[1]}%, inter-day {eacc[0]}–{eacc[1]}% (column printed as “Bias, %”).")[:500]))

# ── Danese 2020 (ng/mL; only r² in serum is given per compound) ─────────────
DAN = {
 "Tauroursodeoxycholic acid (TUDCA)": 0.999016, "Taurocholic acid (TCA)": 0.999820, "Glycoursodeoxycholic acid (GUDCA)": 0.999103,
 "Glycocholic acid (GCA)": 0.999051, "Taurochenodeoxycholic acid (TCDCA)": 0.998966, "Taurodeoxycholic acid (TDCA)": 0.998822,
 "Cholic acid (CA)": 0.999722, "Ursodeoxycholic acid (UDCA)": 0.999731, "Glycochenodeoxycholic acid (GCDCA)": 0.999806,
 "Hyodeoxycholic acid (HDCA)": 0.999745, "Glycodeoxycholic acid (GDCA)": 0.999870, "Taurolithocholic acid (TLCA)": 0.999418,
 "Chenodeoxycholic acid (CDCA)": 0.999748, "Glycolithocholic acid (GLCA)": 0.998580, "Deoxycholic acid (DCA)": 0.999799,
}
dan_rows = [dict(compound_name=n, lod=None, loq=5, r2=r2, cv_percent=None, accuracy_percent=None,
                 notes="R² in steroid-free serum. No per-compound precision table: the article reports intra- and inter-assay CVs <10%, "
                       "accuracy 85–115% and recovery 92–110% (mean 95.5%) for all bile acids.")
            for n, r2 in DAN.items()]

BATCH = {
    "https://doi.org/10.3390/ph14121214": feliu_rows,
    "https://doi.org/10.3389/fmolb.2026.1745458": zhang_rows,
    "https://doi.org/10.3390/ph16111537": li_rows,
    "https://doi.org/10.3390/molecules28052254": ren_rows,
    "https://doi.org/10.3390/pharmaceutics16010005": bel_rows,
    "https://doi.org/10.3390/diagnostics10070462": dan_rows,
}

if __name__ == "__main__":
    db = SessionLocal()
    for url, rows in BATCH.items():
        m = db.query(Method).filter(Method.source_url == url).first()
        if not m:
            print("method not found:", url); continue
        if db.query(CompoundValidation).filter(CompoundValidation.method_id == m.id).count():
            print(f"id={m.id}: validation already present, skipped"); continue
        analytes = {t.compound_name for t in m.mrm_transitions if not t.is_internal_standard}
        missing = [r["compound_name"] for r in rows if r["compound_name"] not in analytes]
        if missing or len(rows) != len(analytes):
            print(f"id={m.id}: NAME MISMATCH, nothing written", missing, len(rows), len(analytes)); continue
        for r in rows:
            db.add(CompoundValidation(method_id=m.id, matrix=m.matrix, **r))
        db.commit()
        print(f"id={m.id}: {len(rows)} validation rows ({m.validation_units})")
