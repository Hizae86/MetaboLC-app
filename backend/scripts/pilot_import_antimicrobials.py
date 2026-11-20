"""Pilot import (2026-11-15): two open-access antimicrobial TDM methods read
from the published articles and sent to the review queue as "submitted".
Every value is as printed in the source; nothing is defaulted or inferred.
Run once from the project root:  python -m backend.scripts.pilot_import_antimicrobials
"""
import sys
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import Method

SUBMITTER = "Andreu Fabregat Rossell"
EXTRACTION_NOTE = ("Transcribed from the published article with AI-assisted extraction (two independent readings agreed); "
                   "awaiting line-by-line check against the source by a reviewer.")


def t(name, q1, q3, ce, rt, quant, is_std=0, assigned=None, **extra):
    return dict(compound_name=name, precursor_mz=q1, product_mz=q3, collision_energy_ev=ce, retention_time_min=rt,
                is_quantifier=quant, is_internal_standard=is_std, assigned_is=assigned, polarity="ESI+", **extra)


# ── 1. Feliu et al., Pharmaceuticals 2021 (CC BY 4.0) ────────────────────────
FELIU_IS = {
    "Amoxicillin": "Amoxicillin-D4", "Aztreonam": "Piperacillin-D5", "Cefazolin": "Cefazolin-13C2,15N",
    "Cefepime": "Cefazolin-13C2,15N", "Cefotaxime": "Cefotaxime-D3", "Cefoxitin": "Cefazolin-13C2,15N",
    "Ceftazidime": "Cefazolin-13C2,15N", "Ciprofloxacin": "Ciprofloxacin-D8", "Clindamycin": "Cefazolin-13C2,15N",
    "Daptomycin": "Cefazolin-13C2,15N", "Ertapenem": "Meropenem-D6", "Linezolid": "Linezolid-D3",
    "Meropenem": "Meropenem-D6", "Ofloxacin": "Ofloxacin-D8", "Piperacillin": "Piperacillin-D5",
}
# name, RT, Q1, Q3 quant, Q3 qual, CE quant, CE qual, RF lens
FELIU_ROWS = [
    ("Amoxicillin", 2.44, 366.125, 114.042, 349.125, 20.00, 8.58, 89),
    ("Aztreonam", 2.61, 436.096, 313.054, 356.125, 14.48, 9.59, 124),
    ("Cefazolin", 3.05, 455.170, 156.113, 323.042, 15.28, 10.43, 111),
    ("Cefepime", 2.40, 241.150, 84.155, 227.071, 18.44, 10.39, 75),
    ("Cefotaxime", 2.82, 456.152, 167.057, 324.125, 19.49, 13.59, 139),
    ("Cefoxitin", 3.29, 445.170, 339.054, 367.042, 12.88, 8.71, 102),
    ("Ceftazidime", 2.56, 274.150, 80.125, 126.042, 13.89, 22.90, 96),
    ("Ciprofloxacin", 2.81, 332.162, 231.125, 314.125, 35.96, 19.91, 154),
    ("Clindamycin", 3.02, 425.300, 126.208, 377.280, 28.63, 19.83, 164),
    ("Daptomycin", 3.58, 811.000, 159.000, 640.667, 46.00, 20.00, 204),
    ("Ertapenem", 2.80, 476.150, 346.208, 432.137, 14.31, 8.71, 117),
    ("Linezolid", 3.20, 338.200, 195.000, 296.083, 22.00, 18.00, 157),
    ("Meropenem", 2.58, 384.200, 141.155, 340.208, 15.19, 10.31, 111),
    ("Ofloxacin", 2.78, 362.205, 261.137, 318.137, 26.10, 18.40, 154),
    ("Piperacillin", 3.52, 518.330, 143.125, 160.125, 19.66, 10.56, 156),
]
FELIU_IS_ROWS = [
    ("Amoxicillin-D4", 2.44, 370.130, 114.042, 353.130, 20.00, 8.58, 89),
    ("Cefazolin-13C2,15N", 3.05, 458.170, 156.113, 326.042, 15.28, 10.43, 111),
    ("Cefotaxime-D3", 2.82, 459.152, 167.054, 327.125, 19.49, 13.59, 139),
    ("Ciprofloxacin-D8", 2.81, 340.160, 235.130, 322.130, 35.96, 19.91, 154),
    ("Linezolid-D3", 3.20, 341.200, 195.000, 296.800, 22.00, 18.00, 157),
    ("Meropenem-D6", 2.58, 390.200, 147.210, 346.208, 15.19, 10.00, 111),
    ("Ofloxacin-D8", 2.78, 370.210, 265.140, 326.140, 26.10, 18.40, 154),
    ("Piperacillin-D5", 3.52, 523.330, 143.125, 160.125, 19.66, 10.56, 156),
]
feliu_transitions = []
for rows, is_std in ((FELIU_ROWS, 0), (FELIU_IS_ROWS, 1)):
    for name, rt, q1, q3a, q3b, cea, ceb, rf in rows:
        assigned = None if is_std else FELIU_IS[name]
        feliu_transitions.append(t(name, q1, q3a, cea, rt, 1, is_std, assigned, rf_lens_v=rf))
        feliu_transitions.append(t(name, q1, q3b, ceb, rt, 0, is_std, assigned, rf_lens_v=rf))

FELIU = dict(
    title="Quantification of 15 Antibiotics Widely Used in the Critical Care Unit with a LC-MS/MS System: An Easy Method to Perform a Daily Therapeutic Drug Monitoring",
    analyte=", ".join(r[0] for r in FELIU_ROWS),
    matrix="plasma", clinical_application="Antibiotics", ionization_mode="ESI+",
    instrument_manufacturer="Thermo Fisher", instrument_model="TSQ Quantis",
    column_brand="Waters", column_name="ACQUITY UPLC HSS T3", column_stationary_phase="HSS T3 (C18)",
    column_length_mm=50, column_diameter_mm=2.1, column_particle_size_um=1.8, column_temperature_c=35,
    mobile_phase_a="Water + 0.1% formic acid (v/v)", mobile_phase_b="Acetonitrile + 0.1% formic acid (v/v)",
    injection_volume_ul=2,
    capillary_voltage_v=4000, ion_transfer_tube_temp_c=325, vaporizer_temp_c=350, aux_gas_flow=7, sweep_gas_flow=2,
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("1. 100 µL plasma + 20 µL internal standard working solution.\n"
                         "2. Add 300 µL methanol.\n3. Vortex 60 s.\n4. Centrifuge at 10,000 × g for 5 min.\n"
                         "5. Transfer 50 µL supernatant and dilute with 200 µL water containing 0.1% formic acid.\n"
                         "6. Inject 2 µL."),
    validation_units="mg/L",
    reference="Feliu C, Konecki C, Candau T, Vautier D, Haudecoeur C, Gozalo C, Cazaubon Y, Djerada Z. Pharmaceuticals (Basel). 2021;14(12):1214. doi:10.3390/ph14121214",
    source_type="Journal article",
    source_authors="Feliu C, Konecki C, Candau T, Vautier D, Haudecoeur C, Gozalo C, Cazaubon Y, Djerada Z",
    source_url="https://doi.org/10.3390/ph14121214",
    submitted_by=SUBMITTER,
    notes=(EXTRACTION_NOTE + "\n\n"
           "Source: open access, CC BY 4.0. HESI source, positive mode. Sheath gas 45 AU, auxiliary gas 7 AU, sweep gas 2 AU. "
           "Q1 resolution 0.7 FWHM, Q3 1.2 FWHM, CID gas 1.5 mTorr. Flow 0.3 mL/min, run time 5.5 min.\n\n"
           "Precursor ion forms as printed in Table 1: [M+NH4]+ for cefoxitin; [M+2H]2+ for ceftazidime and daptomycin; [M+H]+ for the rest "
           "(cefepime is printed as [M+H]+ at m/z 241.150).\n\n"
           "LLOQ / ULOQ (mg/L, Table 2): amoxicillin 1.6/200; aztreonam 3.9/500; cefazolin 1.6/200; cefepime 1.6/200; cefotaxime 1.6/200; "
           "cefoxitin 0.6/100; ceftazidime 1.6/200; ciprofloxacin 0.1/10; clindamycin 0.1/10; daptomycin 1.6/200; ertapenem 0.8/100; "
           "linezolid 0.4/50; meropenem 0.8/100; ofloxacin 0.1/10; piperacillin 1.6/200.\n\n"
           "To check when reviewing: the article's methods section says PRM while the results say MRM; "
           "several LLOQs in Table 2 are below the lowest calibrator listed in section 3.1.3."),
    gradient_steps=[dict(time_min=tm, percent_b=b, flow_rate_ml_min=0.3, curve="linear")
                    for tm, b in [(0, 0), (3.6, 85.5), (3.601, 95), (4.1, 95), (4.11, 0), (5.5, 0)]],
    mrm_transitions=feliu_transitions,
)

# ── 2. Zhang et al., Front Mol Biosci 2026 (CC BY) ───────────────────────────
# name, Q1, Q3, DP, CE, CXP, RT, IS
ZHANG_ROWS = [
    ("Caspofungin", 547.3, 137.2, 110, 35, 10, 1.86, "Caspofungin-d4"),
    ("Imipenem", 299.9, 141.9, 68, 40, 12, 1.42, "Voriconazole-d3"),
    ("Linezolid", 338.2, 296.2, 110, 16, 12, 1.87, "Linezolid-d3"),
    ("Meropenem", 384.3, 141.0, 84, 20, 10, 1.71, "Meropenem-d6"),
    ("Latamoxef", 520.9, 377.0, 90, 20, 15, 1.79, "Voriconazole-d3"),
    ("Piperacillin", 518.3, 143.0, 106, 49, 10, 1.93, "Piperacillin-d5"),
    ("Voriconazole", 350.0, 280.8, 90, 35, 11, 2.12, "Voriconazole-d3"),
    ("Posaconazole", 701.3, 683.4, 1, 43, 22, 2.34, "Voriconazole-d3"),
    ("Cefmetazole", 472.1, 356.0, 17, 12, 11, 1.84, "Piperacillin-d5"),
    ("Tigecycline", 293.7, 257.1, 75, 18, 20, 1.68, "Voriconazole-d3"),
    ("Cefazolin", 455.1, 323.0, 100, 16, 10, 1.80, "Piperacillin-d5"),
]
ZHANG_IS_ROWS = [
    ("Caspofungin-d4", 549.4, 141.0, 105, 45, 10, 1.86),
    ("Linezolid-d3", 341.2, 297.1, 120, 28, 13, 1.87),
    ("Meropenem-d6", 390.0, 147.2, 80, 24, 10, 1.71),
    ("Piperacillin-d5", 523.0, 148.3, 107, 30, 8, 1.93),
    ("Voriconazole-d3", 353.0, 284.0, 90, 23, 13, 2.11),
]
zhang_transitions = (
    [t(n, q1, q3, ce, rt, 1, 0, istd, declustering_potential=dp, cell_exit_potential=cxp)
     for n, q1, q3, dp, ce, cxp, rt, istd in ZHANG_ROWS]
    + [t(n, q1, q3, ce, rt, 1, 1, None, declustering_potential=dp, cell_exit_potential=cxp)
       for n, q1, q3, dp, ce, cxp, rt in ZHANG_IS_ROWS]
)

ZHANG = dict(
    title="A validated LC-ESI-MS/MS assay for simultaneous plasma quantification of 11 antimicrobials to support personalized dosing in critically ill children",
    analyte=", ".join(r[0] for r in ZHANG_ROWS),
    matrix="plasma", clinical_application="Therapeutic Drug Monitoring", ionization_mode="ESI+",
    instrument_manufacturer="Sciex", instrument_model="Triple Quad 4500MD",
    column_brand="Phenomenex", column_name="Kinetex C18", column_stationary_phase="C18",
    column_length_mm=75, column_diameter_mm=2.1, column_particle_size_um=2.6, column_temperature_c=45,
    mobile_phase_a="0.1% formic acid in water", mobile_phase_b="0.1% formic acid in acetonitrile",
    injection_volume_ul=5, autosampler_temperature_c=4,
    needle_wash_solvent="ACN:MeOH:IPA:H2O (4:4:1:1, v/v/v/v)",
    curtain_gas=20, collision_gas="6", source_temperature_c=450, gas1=50, gas2=50, ion_spray_voltage=5500,
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("1. 10 µL plasma + 10 µL methanol, added to 80 µL methanol/formic acid (99.9/0.1, v/v).\n"
                         "2. Vortex 5 min.\n3. Centrifuge 5 min at 4,000 rpm, 4 °C.\n"
                         "4. Transfer 20 µL supernatant and dilute with 180 µL water:acetonitrile (95:5, v/v).\n"
                         "5. Vortex 3 min.\n6. Inject 5 µL."),
    validation_units="µg/mL",
    reference="Zhang Y-Y, Wang J, Guo H-L, Wu S-Y, Zhang H-F, Zheng P-F, Miao H-J, Chen F. Front Mol Biosci. 2026;13:1745458. doi:10.3389/fmolb.2026.1745458",
    source_type="Journal article",
    source_authors="Zhang Y-Y, Wang J, Guo H-L, Wu S-Y, Zhang H-F, Zheng P-F, Miao H-J, Chen F",
    source_url="https://doi.org/10.3389/fmolb.2026.1745458",
    submitted_by=SUBMITTER,
    notes=(EXTRACTION_NOTE + "\n\n"
           "Source: open access, CC BY. Guard column Guard-C18 4 × 2.0 mm. One transition per analyte is listed (Table 2). "
           "Entrance potential (V) as printed: caspofungin 7, imipenem 10, linezolid 11, meropenem 10, latamoxef 7, piperacillin 10, "
           "voriconazole 13, posaconazole 2, cefmetazole 6, tigecycline 11, cefazolin 10. Caspofungin and tigecycline are monitored as [M+2H]2+.\n\n"
           "LLOQ – upper limit (µg/mL): caspofungin 0.5–50; imipenem 1–100; linezolid 0.25–25; meropenem 1–100; latamoxef 1–100; "
           "piperacillin 1–100; voriconazole 0.1–10; posaconazole 0.5–50; cefmetazole 1–100; tigecycline 0.5–50; cefazolin 1–100.\n\n"
           "To check when reviewing: flow rate is given as “0.25 mL/min and 0.5 mL/min, respectively” without saying which applies when, "
           "so no flow is stored; the column is 2.1 × 75 mm in section 2.2 but 2.1 × 100 mm in section 2.1; "
           "posaconazole DP is printed as 1 V; the step where the internal standard is added is not described."),
    gradient_steps=[dict(time_min=tm, percent_b=b, curve="linear")
                    for tm, b in [(0, 8), (0.5, 8), (1, 50), (3.5, 85), (4.2, 90), (4.7, 90), (4.8, 8), (6.5, 8)]],
    mrm_transitions=zhang_transitions,
)

if __name__ == "__main__":
    db = SessionLocal()
    client = TestClient(app)
    for payload in (FELIU, ZHANG):
        if db.query(Method).filter(Method.source_url == payload["source_url"]).first():
            print("already imported:", payload["source_url"]); continue
        r = client.post("/api/methods/", json=payload)
        if r.status_code != 200:
            print("FAILED", r.status_code, r.text[:300]); sys.exit(1)
        m = r.json()
        print(f"queued id={m['id']} status={m['status']} transitions={len(m['mrm_transitions'])} gradient={len(m['gradient_steps'])}")
