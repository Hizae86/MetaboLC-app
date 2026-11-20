"""Batch 6 (2026-11-17): open-access methods chosen to fill gaps in the library —
antibiotic/antifungal TDM in ICU (Shimadzu), volumetric absorptive microsampling
(Waters), oncology TDM of kinase inhibitors (Thermo) and underivatized plasma amino
acids for inborn errors of metabolism (Restek application note on Waters).
Sent to the review queue as "submitted". Values are as printed in the sources (two
independent readings agreed unless a note says otherwise). Validation rows store the
WORST CASE across levels; the detail is in each row's note.
Run once from the project root:  python -m backend.scripts.import_open_access_batch6
"""
import sys
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import Method, CompoundValidation
from backend.scripts.import_open_access_batch2 import tr, grad, SUBMITTER, NOTE
from backend.scripts.import_validation_batch import rng, worst_acc

# ── 1. Liu et al., Front Pharmacol 2023 — 14 antibacterial and antifungal agents in ICU serum (Shimadzu LCMS-8050) ──
# abbreviation, name, RT, Q1, [(Q3, CE) quantifier first], range µg/mL, IS, polarity
LIU = [
 ("FLU", "Fluconazole", 3.09, 307.1, [(220.1, -19), (238.1, -16)], "0.1–50", "DAT-IS", "ESI+"),
 ("LIN", "Linezolid", 3.24, 338.1, [(296.1, -18), (148.1, -43)], "0.1–50", "VOR-IS", "ESI+"),
 ("CAS", "Caspofungin", 4.65, 547.4, [(137.1, -30), (131.1, -26)], "0.1–100", "VOR-IS", "ESI+"),
 ("MER", "Meropenem", 2.53, 384.1, [(141.1, -16), (114.0, -36)], "0.1–50", "VOR-IS", "ESI+"),
 ("TIG", "Tigecycline", 2.23, 586.3, [(513.2, -27), (456.15, -35)], "0.1–100", "VOR-IS", "ESI+"),
 ("PIP", "Piperacillin", 3.73, 518.2, [(143.2, -52), (115.1, -52)], "0.1–50", "PI-IS", "ESI+"),
 ("CEF", "Cefoperazone", 3.21, 646.5, [(143.0, -50), (148.1, -50)], "0.1–100", "VOR-IS", "ESI+"),
 ("TEI", "Teicoplanin", 3.35, 940.5, [(316.4, -41), (144.1, -41)], "0.3–100", "DAT-IS", "ESI+"),
 ("POS", "Posaconazole", 4.41, 701.3, [(614.3, -36), (344.2, -47)], "0.1–50", "VOR-IS", "ESI+"),
 ("VOR", "Voriconazole", 4.12, 350.2, [(281.2, -12), (127.2, -12)], "0.1–50", "VOR-IS", "ESI+"),
 ("DAP", "Daptomycin", 4.02, 810.7, [(159.1, -49), (341.1, -24)], "0.3–100", "DAT-IS", "ESI+"),
 ("VAN", "Vancomycin", 2.42, 725.6, [(144.2, -22), (100.1, -33)], "0.1–100", "DAT-IS", "ESI+"),
 ("SUL", "Sulbactam", 2.01, 232.1, [(140.1, 13), (64.0, 35)], "0.1–50", "ETH", "ESI-"),
 ("TAZ", "Tazobactam", 2.12, 299.1, [(137.9, 14), (254.9, 10)], "0.1–50", "ETH", "ESI-"),
]
LIU_IS = [("PI-IS", 3.73, 522.7, [(148.2, -10), (160.2, -20)], "ESI+"), ("VOR-IS", 4.12, 355.3, [(128.2, -20), (284.1, -35)], "ESI+"),
          ("DAT-IS", 4.02, 813.1, [(163.2, -35), (317.2, -35)], "ESI+"), ("ETH", 4.15, 165.15, [(92.00, 35), (136.75, 20)], "ESI-")]
# Table 2: abbreviation -> [(level, nominal µg/mL, %bias, intra-day CV, inter-day CV)]
LIU_V = {
 "FLU": [("LLOQ", 0.10, 5.20, 9.26, 8.78), ("LQC", 0.30, 7.32, 6.98, 10.29), ("MQC", 5.00, 9.52, 9.47, 12.21), ("HQC", 40.00, 9.68, 7.31, 11.17)],
 "LIN": [("LLOQ", 0.10, 13.70, 11.92, 13.19), ("LQC", 0.30, 0.97, 8.93, 5.37), ("MQC", 5.00, -6.36, 6.82, 7.92), ("HQC", 40.00, 5.68, 3.82, 2.62)],
 "CAS": [("LLOQ", 0.10, -6.40, 9.78, 14.26), ("LQC", 0.30, -8.37, 4.01, 7.38), ("MQC", 10.00, 2.52, 11.35, 12.73), ("HQC", 80.00, -2.24, 3.34, 6.26)],
 "MER": [("LLOQ", 0.10, 4.61, 6.72, 8.43), ("LQC", 0.30, -2.47, 8.29, 11.29), ("MQC", 5.00, -1.66, 7.89, 11.95), ("HQC", 40.00, -1.33, 2.57, 8.10)],
 "TIG": [("LLOQ", 0.10, -1.30, 9.74, 12.15), ("LQC", 0.30, 5.70, 6.52, 8.91), ("MQC", 10.00, 8.33, 9.22, 9.26), ("HQC", 80.00, -1.41, 8.91, 9.27)],
 "PIP": [("LLOQ", 0.10, 12.92, 12.96, 14.78), ("LQC", 0.30, 6.07, 9.24, 11.68), ("MQC", 5.00, -4.14, 11.03, 12.82), ("HQC", 40.00, 6.12, 10.21, 8.74)],
 "CEF": [("LLOQ", 0.10, 10.73, 11.83, 13.64), ("LQC", 0.30, -6.21, 10.21, 9.27), ("MQC", 10.00, -3.21, 8.62, 11.24), ("HQC", 80.00, -3.41, 5.28, 12.18)],
 "TEI": [("LLOQ", 0.30, -2.93, 8.82, 11.92), ("LQC", 0.90, 3.01, 6.43, 8.92), ("MQC", 10.00, 12.40, 8.72, 9.26), ("HQC", 80.00, 7.35, 8.20, 9.07)],
 "POS": [("LLOQ", 0.10, 11.23, 12.63, 12.62), ("LQC", 0.30, 7.97, 9.63, 10.71), ("MQC", 5.00, -7.38, 5.92, 9.72), ("HQC", 40.00, 11.82, 5.32, 8.23)],
 "VOR": [("LLOQ", 0.10, 8.61, 7.93, 8.34), ("LQC", 0.30, 7.53, 3.54, 7.63), ("MQC", 5.00, 10.76, 11.82, 6.92), ("HQC", 40.00, 7.03, 4.68, 6.28)],
 "DAP": [("LLOQ", 0.30, 10.47, 9.81, 14.29), ("LQC", 0.90, -0.22, 8.72, 9.46), ("MQC", 10.00, 12.93, 6.83, 11.36), ("HQC", 80.00, 10.68, 8.72, 11.45)],
 "VAN": [("LLOQ", 0.10, 11.80, 5.83, 9.29), ("LQC", 0.30, -5.87, 5.29, 10.82), ("MQC", 10.00, -11.68, 9.72, 11.25), ("HQC", 80.00, 2.95, 9.03, 8.20)],
 "SUL": [("LLOQ", 0.10, 4.82, 8.79, 11.03), ("LQC", 0.30, 5.37, 9.83, 9.31), ("MQC", 5.00, -2.58, 6.72, 9.07), ("HQC", 40.00, 6.22, 8.52, 9.25)],
 "TAZ": [("LLOQ", 0.10, -10.06, 12.66, 10.72), ("LQC", 0.30, 3.57, 6.10, 8.94), ("MQC", 5.00, 4.68, 5.89, 11.26), ("HQC", 40.00, -6.83, 11.45, 10.26)],
}
# Table 3: recovery LQC, HQC (%) and matrix effect LQC, HQC as printed (RSD in brackets)
LIU_RM = {
 "FLU": ("92.37 (12.30)", "86.31 (4.32)", "1.33 (10.91)", "1.59 (4.29)"), "LIN": ("74.23 (13.45)", "61.61 (2.71)", "1.77 (9.38)", "1.52 (5.77)"),
 "CAS": ("91.02 (11.74)", "88.23 (11.72)", "2.24 (12.50)", "0.46 (9.98)"), "MER": ("87.12 (10.24)", "85.47 (4.92)", "1.24 (10.00)", "1.27 (4.42)"),
 "TIG": ("84.64 (12.19)", "79.22 (6.28)", "0.81 (12.33)", "0.79 (3.95)"), "PIP": ("104.27 (9.43)", "98.57 (12.28)", "0.46 (12.97)", "0.73 (9.92)"),
 "CEF": ("69.25 (11.35)", "79.83 (5.38)", "1.62 (12.21)", "1.54 (4.48)"), "TEI": ("114.23 (8.74)", "121.66 (4.97)", "0.76 (9.87)", "0.84 (3.32)"),
 "POS": ("87.65 (9.33)", "79.97 (2.16)", "1.21 (8.42)", "1.32 (2.46)"), "VOR": ("93.63 (10.65)", "115.24 (4.13)", "1.58 (4.99)", "1.47 (4.30)"),
 "DAP": ("84.83 (9.74)", "76.43 (5.86)", "0.67 (13.94)", "0.50 (13.54)"), "VAN": ("108.60 (10.45)", "101.63 (6.87)", "1.30 (9.41)", "1.61 (4.14)"),
 "SUL": ("58.74 (12.09)", "49.42 (1.75)", "1.43 (8.08)", "1.56 (9.84)"), "TAZ": ("110.81 (9.38)", "93.57 (3.88)", "1.56 (14.65)", "1.52 (4.12)"),
}
liu_tr = ([tr(n, q1, q3, ce, rt, 1 if i == 0 else 0, 0, is_, pol) for _a, n, rt, q1, prods, _r, is_, pol in LIU for i, (q3, ce) in enumerate(prods)]
          + [tr(n, q1, q3, ce, rt, 1 if i == 0 else 0, 1, None, pol) for n, rt, q1, prods, pol in LIU_IS for i, (q3, ce) in enumerate(prods)])
liu_val = []
for a, n, _rt, _q1, _p, r, _is, _pol in LIU:
    lv = LIU_V[a]; rec_l, rec_h, me_l, me_h = LIU_RM[a]
    liu_val.append(dict(compound_name=n, lod=None, loq=lv[0][1], r2=None,
                        cv_percent=max(max(l[3], l[4]) for l in lv), accuracy_percent=worst_acc([100 + l[2] for l in lv]),
                        notes=(f"Worst case over 4 levels (LLOQ, LQC, MQC, HQC: {', '.join(f'{l[1]:g}' for l in lv)} µg/mL). "
                               f"Bias {rng([l[2] for l in lv], 2)}%. Intra-day CV {rng([l[3] for l in lv], 2)}%. Inter-day CV {rng([l[4] for l in lv], 2)}%. "
                               f"Linear range {r} µg/mL (1/x² weighting; r² ≥ 0.9085 for all compounds, per-compound values only in a figure). "
                               f"Recovery LQC {rec_l}%, HQC {rec_h}%. Matrix effect LQC {me_l}, HQC {me_h} (as printed, RSD in brackets).")))
M_LIU = dict(
    title="LC–MS/MS-based multiplex antibacterial platform for therapeutic drug monitoring in intensive care unit patients",
    analyte=", ".join(r[1] for r in LIU), matrix="serum", clinical_application="Antibiotics", ionization_mode="ESI+/ESI- (polarity switching 50ms)",
    instrument_manufacturer="Shimadzu", instrument_model="LCMS-8050 with LC-30A",
    column_brand="Waters", column_name="Acquity UPLC C8", column_stationary_phase="C8",
    column_length_mm=50, column_diameter_mm=2.1, column_particle_size_um=1.7, column_temperature_c=40,
    mobile_phase_a="0.1% formic acid in water", mobile_phase_b="0.1% formic acid in acetonitrile", injection_volume_ul=2,
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("1. Thaw serum at room temperature.\n2. 100 µL serum + 20 µL mixed internal standard solution (40 µg/mL).\n"
                         "3. Add 480 µL methanol with 0.1% formic acid.\n4. Vortex 1 min.\n5. Centrifuge 8 min at 12,000 rpm (13,780 g).\n"
                         "6. Transfer 500 µL supernatant to a vial; inject 2 µL."),
    validation_units="µg/mL",
    reference="Liu L, Zhang L, Zheng X, Liu X, Liu W, Wu J. Front Pharmacol. 2023;14:1116071. doi:10.3389/fphar.2023.1116071",
    source_type="Journal article", source_authors="Liu L, Zhang L, Zheng X, Liu X, Liu W, Wu J",
    source_url="https://doi.org/10.3389/fphar.2023.1116071", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access, CC BY. 14 drugs in one run: β-lactams (piperacillin, cefoperazone, meropenem), β-lactamase inhibitors (tazobactam, sulbactam), "
           "glycopeptides and lipopeptides (vancomycin, teicoplanin, daptomycin), linezolid, tigecycline and four antifungals. Flow 0.4 mL/min, run time 10 min. "
           "Collision energies are stored with the sign printed in the article (Shimadzu convention). "
           "Interface settings as printed: “ion transfer tube temperature, 300 °C; sheath gas flow, 3.0 L/min; auxiliary gas flow, 10.0 L/min; vaporizer temperature, 400 °C”, "
           "and desolvation temperature 250 °C. These are not mapped onto the Shimadzu source fields because the article uses other vendors' terms.\n\n"
           "To check when reviewing: the gradient comes from the text; the article also points to a supplementary table (S1) that was not read, and a second passage omits the 0.5 min hold; "
           "sulbactam, tazobactam and the internal standard ETH are stored as ESI− because the article says those two drugs are the exceptions to positive mode — read once; "
           "the internal standards are named only by abbreviation (PI-IS = piperacillin-D5, VOR-IS = voriconazole-D5 and DAT-IS = daptomycin-d5 per the text; ETH is not expanded); "
           "the PI-IS precursor is printed as 522.7; no per-compound r² values in the text; the text's bias range does not match Table 2, which is what is stored."),
    gradient_steps=grad([(0, 5), (0.5, 5), (3, 50), (4, 100), (7, 100), (9, 5), (10, 5)], 0.4), mrm_transitions=liu_tr,
)

# ── 2. Wang et al., Pharmaceutics 2022 — VAMS tacrolimus, mycophenolic acid and creatinine (Waters Xevo TQ-S) ──
WAN = [("Tacrolimus", 821.57, 768.55, 24, 18, 3.87, "Tacrolimus-13C,2H4"), ("Mycophenolic acid", 321.27, 207.15, 10, 22, 3.29, "Mycophenolic acid-d3"),
       ("Creatinine", 114.20, 86.13, 44, 10, 0.85, "Creatinine-d3")]
WAN_IS = [("Tacrolimus-13C,2H4", 826.61, 773.51, 14, 18, 3.87), ("Mycophenolic acid-d3", 324.26, 210.15, 8, 22, 3.29), ("Creatinine-d3", 117.27, 47.20, 38, 14, 0.85)]
# level, nominal, (day1 dev, day1 CV, day2 dev, day2 CV, day3 dev, day3 CV, interbatch CV)
WAN_V = {
 "Tacrolimus": ("ng/mL", "0.50 ng/mL", [("LLOQ", 0.50, (-6.64, 7.74, 0.68, 5.30, -3.12, 5.24, 6.52)), ("LQC", 1.50, (1.79, 5.18, 0.94, 4.39, 2.71, 2.77, 3.98)),
                ("MQC", 20.00, (9.10, 2.47, 10.52, 2.52, 11.87, 2.03, 2.42)), ("HQC", 40.00, (5.38, 4.53, 8.76, 4.27, 9.46, 3.40, 4.15))]),
 "Mycophenolic acid": ("µg/mL", "0.025 µg/mL (25 ng/mL)", [("LLOQ", 0.025, (-8.00, 4.35, -11.20, 2.01, -11.20, 3.96, 3.66)), ("LQC", 0.075, (-0.64, 3.18, -4.33, 4.19, -5.52, 1.82, 3.72)),
                ("MQC", 0.50, (-7.16, 4.12, -8.00, 4.95, -8.92, 5.50, 4.59)), ("HQC", 1.00, (-11.54, 1.42, -12.56, 1.97, -12.66, 1.10, 1.55))]),
 "Creatinine": ("nmol/mL", "10.00 nmol/mL", [("LLOQ", 10.00, (7.27, 5.33, 6.02, 4.80, 1.51, 5.57, 5.42)), ("LQC", 30.00, (1.68, 5.21, 5.28, 6.86, -1.17, 3.08, 5.64)),
                ("MQC", 400.00, (-0.54, 5.30, -1.46, 4.59, -2.15, 4.53, 4.52)), ("HQC", 800.00, (-3.26, 2.82, -6.07, 3.19, -7.02, 3.03, 3.29))]),
}
WAN_LOQ = {"Tacrolimus": 0.5, "Mycophenolic acid": 25.0, "Creatinine": None}   # stored in ng/mL; creatinine left in nmol/mL in the note
WAN_ME = {"Tacrolimus": "IS-normalised matrix factor 0.91–1.13 (low, CV 7.05%), 1.00–1.03 (high, CV 1.00%)",
          "Mycophenolic acid": "IS-normalised matrix factor 0.89–0.98 (low, CV 3.09%), 0.95–1.01 (high, CV 2.06%)",
          "Creatinine": "IS-normalised matrix factor 0.96–1.15 (low, CV 6.15%), 0.98–1.08 (high, CV 3.77%)"}
wan_tr = ([tr(n, q1, q3, ce, rt, 1, 0, is_, "ESI+", cone_voltage=cone) for n, q1, q3, cone, ce, rt, is_ in WAN]
          + [tr(n, q1, q3, ce, rt, 1, 1, None, "ESI+", cone_voltage=cone) for n, q1, q3, cone, ce, rt in WAN_IS])
wan_val = []
for n, (unit, lloq, lv) in WAN_V.items():
    devs = [d for _l, _n, v in lv for d in v[0:6:2]]; cvs = [c for _l, _n, v in lv for c in (*v[1:6:2], v[6])]
    wan_val.append(dict(compound_name=n, lod=None, loq=WAN_LOQ[n], r2=None, cv_percent=max(cvs), accuracy_percent=worst_acc([100 + d for d in devs]),
                        notes=(f"Worst case over 4 levels ({', '.join(f'{l} {nom:g}' for l, nom, _v in lv)} {unit}), 3 days, n = 5, VAMS samples. "
                               f"Mean deviation {rng(devs, 2)}%. Within-day CV {rng([c for _l, _n, v in lv for c in v[1:6:2]], 2)}%. "
                               f"Between-batch CV {rng([v[6] for _l, _n, v in lv], 2)}%. LLOQ {lloq}. R² > 0.99 (1/x weighting). {WAN_ME[n]}. "
                               "Recovery 95.01–105.89% and process efficiency 95.88–109.28% across LQC–HQC (all analytes).")))
M_WAN = dict(
    title="A Volumetric Absorptive Microsampling UPLC-MS/MS Method for Simultaneous Quantification of Tacrolimus, Mycophenolic Acid and Creatinine in Whole Blood of Renal Transplant Recipients",
    analyte="Tacrolimus, Mycophenolic acid, Creatinine", matrix="dried blood spot", clinical_application="Immunosuppressants", ionization_mode="ESI+",
    instrument_manufacturer="Waters", instrument_model="ACQUITY UPLC / Xevo TQ-S",
    column_brand="Waters", column_name="Acquity UPLC BEH C18", column_stationary_phase="C18",
    column_length_mm=100, column_diameter_mm=2.1, column_particle_size_um=1.7, column_temperature_c=50, autosampler_temperature_c=8,
    mobile_phase_a="2 mM ammonium acetate and 0.10% formic acid in water", mobile_phase_b="2 mM ammonium acetate and 0.10% formic acid in methanol",
    injection_volume_ul=2, source_temperature_c=150, desolvation_temperature_c=550,
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("Volumetric absorptive microsampling (Mitra 20 µL, Neoteryx); one shared extraction and a single injection for all three analytes.\n"
                         "1. Touch the tip to the blood at a 45° angle until it turns red, then hold 2 s more.\n2. Dry 3 h.\n"
                         "3. Put the tip in a tube with 200 µL deionized water; vortex 10 min (91× g).\n"
                         "4. Add 300 µL methanol–water (80:20, v/v) with 40 mM zinc sulfate heptahydrate and 50 µL internal standard mix; vortex 3 min (91× g).\n"
                         "5. Centrifuge 5 min at 11,269× g.\n6. Transfer the supernatant to a 96-well plate, seal and inject 2 µL."),
    validation_units="ng/mL",
    reference="Wang X, Dai X, Wan S, Fan Y, Wu L, Xu H, Yan L, Gong X, Li Y, Luo Y, Bai Y, Li Y. Pharmaceutics. 2022;14(12):2547. doi:10.3390/pharmaceutics14122547",
    source_type="Journal article", source_authors="Wang X, Dai X, Wan S, Fan Y, Wu L, Xu H, Yan L, Gong X, Li Y, Luo Y, Bai Y, Li Y",
    source_url="https://doi.org/10.3390/pharmaceutics14122547", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access (MDPI). Dried whole blood collected with VAMS; stored under the dried blood spot matrix. Flow 0.30 mL/min, run time 5 min. "
           "Calibration ranges as printed: tacrolimus 0–50.00 ng/mL, mycophenolic acid 0–1.25 µg/mL, creatinine 0–1000.00 nmol/mL. "
           "Validation LOQs are stored in ng/mL (mycophenolic acid converted from 0.025 µg/mL); the creatinine LLOQ (10.00 nmol/mL) is kept only in its note. "
           "Hematocrit 0.20–0.60 L/L: maximum mean deviations −3.87% and 4.73% (tacrolimus), −5.67% and 10% (mycophenolic acid), −4.65% and 1.75% (creatinine).\n\n"
           "To check when reviewing: the text gives a single cone voltage of 30 V, while Table 1 gives a cone voltage per compound — the table values are stored; "
           "the return to 2% B after 4.20 min is stored as a step at 4.21 min and the end at 5.0 min (run time); capillary voltage and gas flows are not reported; "
           "the column of Table 2 was misaligned in the source and values were mapped by position (day 1–3 deviation and CV, then between-batch CV)."),
    gradient_steps=grad([(0, 2), (1.0, 2), (1.5, 50), (2.5, 90), (4.2, 90), (4.21, 2, "step"), (5.0, 2)], 0.3), mrm_transitions=wan_tr,
)

# ── 3. Bellouard et al., Pharmaceutics 2024 — 12 kinase inhibitors in plasma (Thermo TSQ Altis) ──
BEL = [("Alectinib", 2.7, 483.3, [(381.1, 36), (396.1, 23)]), ("Alectinib M4", 2.6, 457.3, [(381.0, 33), (396.0, 30)]),
       ("AZ5104", 2.1, 486.5, [(72.1, 28), (371.3, 32)]), ("Binimetinib", 2.6, 441.1, [(379.1, 19), (165.0, 33)]),
       ("Cobimetinib", 2.8, 532.0, [(84.0, 29), (249.0, 30)]), ("Crizotinib", 2.2, 450.1, [(177.1, 38), (260.2, 23)]),
       ("Dabrafenib", 3.2, 520.1, [(307.2, 33), (343.2, 26)]), ("Encorafenib", 2.8, 540.2, [(310.1, 38), (371.2, 36)]),
       ("Imatinib", 2.3, 494.3, [(217.3, 25), (394.1, 26)]), ("Lorlatinib", 2.3, 407.2, [(228.1, 2), (180.1, 23)]),
       ("Osimertinib", 2.4, 500.4, [(72.14, 25), (455.2, 21)]), ("Trametinib", 3.1, 616.0, [(226.2, 46), (254.2, 37)])]
BEL_IS = [("Alectinib-D8", 2.7, 491.7, [(396.2, 24), (381.1, 36)]), ("Binimetinib-13CD4", 2.6, 449.1, [(381.0, 19), (165.0, 31)]),
          ("Cobimetinib-13C6", 2.8, 538.1, [(84.0, 29), (255.0, 32)]), ("Crizotinib-13C2D5", 2.2, 457.2, [(177.1, 42), (267.2, 26)]),
          ("Dabrafenib-D9", 3.2, 529.1, [(316.3, 34), (352.3, 28)]), ("Encorafenib-13C2D3", 2.8, 544.2, [(310.0, 34), (371.0, 37)]),
          ("Imatinib-D8", 2.3, 502.4, [(225.1, 26), (394.1, 27)]), ("Osimertinib-13CD3", 2.4, 504.7, [(389.2, 34), (459.2, 21)]),
          ("Trametinib-13C6", 3.1, 622.0, [(232.2, 48), (260.2, 39)])]
# molecule: LOD, LOQ, linearity, R², acc intra, acc inter, CV intra, CV inter, recovery QC2, QC4, NME QC2, QC4  (ng/mL, %)
BEL_V = {
 "Dabrafenib": (0.5, 5, "5–5000", 0.9984, (88.3, 103.7), (89, 102.9), (3.5, 5.5), (2.1, 8.4), "103.5 (14.2)", "70.1 (9.1)", "100 (9.4)", "100 (5.1)"),
 "Trametinib": (0.5, 1, "1–200", 0.9980, (91.8, 111.3), (92.4, 106.3), (4.7, 10.8), (2, 14.9), "94.8 (10.4)", "85.1 (6.4)", "120 (7.9)", "100 (6.3)"),
 "Cobimetinib": (0.4, 2, "2–2000", 0.9986, (88.3, 103.1), (89.6, 102), (4.7, 7.3), (2.5, 4.9), "97.8 (5.8)", "113.8 (7.1)", "120 (3.2)", "100 (5.5)"),
 "Encorafenib": (1, 5, "5–5000", 0.9990, (90.8, 106.3), (92.8, 103.2), (3.9, 7.4), (5.2, 14.8), "88.3 (15.1)", "114.9 (8.8)", "110 (10.8)", "100 (9.9)"),
 "Binimetinib": (0.2, 2, "2–2000", 0.9989, (89.5, 103.1), (92.7, 99.5), (3.4, 6.7), (2.5, 8.4), "110 (11.1)", "107.7 (10)", "100 (8.6)", "100 (6.5)"),
 "Osimertinib": (2, 2, "2–2000", 0.9959, (96.9, 113.7), (100.3, 109.8), (4.3, 8.1), (5.6, 7.9), "106.1 (10)", "98.3 (12.5)", "100 (7.5)", "120 (12.8)"),
 "AZ5104": (0.1, 0.2, "0.2–200", 0.9987, (88.7, 113.6), (93.8, 107.4), (5.8, 9.8), (9.9, 14.6), "109.8 (9)", "112.5 (11.8)", "220 (8.9)", "210 (8.8)"),
 "Crizotinib": (2, 10, "10–2000", 0.9974, (85.1, 109), (87.5, 108.5), (2.8, 6.3), (1, 12.3), "119.7 (17.6)", "118.0 (10.5)", "130 (8.6)", "100 (5.5)"),
 "Alectinib": (0.2, 2, "2–2000", 0.9984, (85.4, 103.9), (89.8, 102.4), (5.3, 8.8), (1.9, 14.4), "106.4 (12.1)", "113.1 (13.8)", "70 (6.7)", "70 (10.9)"),
 "Alectinib M4": (0.2, 2, "2–2000", 1.0, (86.8, 106.3), (91.3, 103.1), (6.4, 10.2), (11.2, 11.8), "107.8 (4)", "113.1 (9.8)", "110 (4.8)", "110 (9.1)"),
 "Imatinib": (2.5, 5, "5–5000", 0.9990, (88.7, 97.5), (92, 94.9), (3.9, 5.9), (6.1, 11), "109.3 (6)", "111.6 (9.2)", "120 (3.3)", "110 (6.7)"),
 "Lorlatinib": (0.2, 2, "2–2000", 0.9980, (89.5, 105.3), (95.7, 99), (3.7, 6.9), (8, 14.6), "104.6 (8.1)", "114.2 (14.5)", "80 (5.3)", "110 (15.1)"),
}
bel_tr = ([tr(n, q1, q3, ce, rt, 1 if i == 0 else 0, 0, None, "ESI+") for n, rt, q1, prods in BEL for i, (q3, ce) in enumerate(prods)]
          + [tr(n, q1, q3, ce, rt, 1 if i == 0 else 0, 1, None, "ESI+") for n, rt, q1, prods in BEL_IS for i, (q3, ce) in enumerate(prods)])
bel_val = [dict(compound_name=n, lod=v[0], loq=v[1], r2=v[3], cv_percent=max(v[6][1], v[7][1]), accuracy_percent=worst_acc([*v[4], *v[5]]),
                notes=(f"Worst case of the printed ranges over the QC levels. Intra-day accuracy {v[4][0]}–{v[4][1]}%, inter-day {v[5][0]}–{v[5][1]}%. "
                       f"Intra-day CV {v[6][0]}–{v[6][1]}%, inter-day CV {v[7][0]}–{v[7][1]}%. Linearity {v[2]} ng/mL (1/x weighting). "
                       f"Recovery QC2 {v[8]}%, QC4 {v[9]}%. IS-normalised matrix effect QC2 {v[10]}%, QC4 {v[11]}% (CV in brackets)."))
           for n, v in BEL_V.items()]
M_BEL = dict(
    title="Validation of Liquid Chromatography Coupled with Tandem Mass Spectrometry for the Determination of 12 Tyrosine Kinase Inhibitors (TKIs) and Their Application to Therapeutic Drug Monitoring in Adult and Pediatric Populations",
    analyte=", ".join(r[0] for r in BEL), matrix="plasma", clinical_application="Therapeutic Drug Monitoring", ionization_mode="ESI+",
    instrument_manufacturer="Thermo Fisher", instrument_model="TSQ Altis with Dionex UltiMate 3000",
    column_brand="Phenomenex", column_name="Kinetex Polar C18", column_stationary_phase="Polar C18",
    column_length_mm=100, column_diameter_mm=2.1, column_particle_size_um=2.6, column_temperature_c=40,
    mobile_phase_a="2 mM ammonium formate in 0.1% formic acid in water", mobile_phase_b="Acetonitrile", injection_volume_ul=10,
    capillary_voltage_pos_v=3.5, sheath_gas_flow_lmin=30, aux_gas_flow=10, ion_transfer_tube_temp_c=350, collision_gas="Argon, 1.5 mTorr",
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("1. 50 µL plasma + 150 µL internal standard solution in methanol (protein precipitation).\n2. Vortex.\n3. Centrifuge 10 min.\n"
                         "4. Transfer the supernatant to vials; inject 10 µL.\nCalibrators: working solution added to blank plasma and evaporated before step 1."),
    validation_units="ng/mL",
    reference="Bellouard M, Donadieu J, Thiebot P, Giroux Leprieur E, Saiag P, Etting I, Dugues P, Abe E, Alvarez J-C, Larabi I-A. Pharmaceutics. 2024;16(1):5. doi:10.3390/pharmaceutics16010005",
    source_type="Journal article", source_authors="Bellouard M, Donadieu J, Thiebot P, Giroux Leprieur E, Saiag P, Etting I, Dugues P, Abe E, Alvarez J-C, Larabi I-A",
    source_url="https://doi.org/10.3390/pharmaceutics16010005", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access (MDPI). Twelve kinase inhibitors and metabolites (AZ5104 is an osimertinib metabolite, alectinib M4 an alectinib metabolite), "
           "used in adult oncology and in children with Langerhans cell histiocytosis. Flow 400 µL/min. Spray voltage +3.5 kV; sheath and auxiliary gas 30 and 10 arbitrary units. "
           "Calibrators in three concentration groups (0.2–200, 2–2000 and 5–5000 ng/mL).\n\n"
           "To check when reviewing: the article does not say which fragment is the quantifier — the first one listed is marked as quantifier; "
           "it does not say which internal standard each analyte uses (the labelled analogues suggest the pairs, and none is listed for AZ5104, alectinib M4 or lorlatinib), so none is assigned; "
           "the lorlatinib CE for m/z 228.1 is printed as 2 eV; the binimetinib internal standard is printed “Bimetinib-13CD4”; "
           "the text calls it a 5 min gradient but then adds 1 min of equilibration, so the program is stored to 6 min; "
           "the LOQ acceptance is printed as 20–80% in one place and 80–120% in another; source settings and the method text come from a single reading."),
    gradient_steps=grad([(0, 10), (1, 40), (2, 90), (4, 90), (5, 10), (6, 10)], 0.4), mrm_transitions=bel_tr,
)

# ── 4. Restek application note — 45 underivatized amino acids in plasma (Waters Xevo TQ-S) ──
# name, RT, Q1, Q3, IS
RES = [
 ("Ethanolamine", 1.06, 62.0, 44.1, "Ethanolamine-d4"), ("Acetyltyrosine", 1.83, 224.1, 136.1, "Acetyltyrosine-d3"),
 ("γ-Aminobutyric acid", 2.25, 104.0, 69.0, "γ-Aminobutyric acid-d4"), ("β-Aminoisobutyric acid", 2.27, 104.1, 30.0, "β-Aminoisobutyric acid-d3"),
 ("β-Alanine", 2.52, 90.0, 30.1, "β-Alanine-d4"), ("Tryptophan", 3.31, 205.1, 146.1, "β-Alanine-d4"),
 ("Leucine", 3.40, 132.1, 86.1, "Leucine-13C6,15N"), ("Phenylalanine", 3.53, 166.1, 120.1, "Phenylalanine-13C9,15N"),
 ("Isoleucine", 3.60, 132.1, 86.1, "Isoleucine-13C6,15N"), ("Alloisoleucine", 3.77, 132.1, 86.1, "Methionine-13C5,15N"),
 ("Methionine", 4.15, 150.1, 104.1, "Methionine-13C5,15N"), ("Tyrosine", 4.27, 182.1, 136.1, "Tyrosine-13C9,15N"),
 ("Valine", 4.27, 118.1, 72.1, "Valine-13C5,15N"), ("Arginine", 4.52, 175.2, 70.1, "Arginine-13C6,15N4"),
 ("α-Aminobutyric acid", 4.57, 104.0, 58.1, "α-Aminobutyric acid-d2"), ("Pipecolic acid", 4.60, 130.0, 84.1, "Pipecolic acid-d9"),
 ("1-Methylhistidine", 4.62, 170.1, 124.1, "1-Methylhistidine-d3"), ("Histidine", 4.65, 156.1, 110.2, "Histidine-13C6,15N3"),
 ("Taurine", 4.65, 126.1, 108.1, "Taurine-d4"), ("Anserine", 4.67, 241.2, 109.1, "Histidine-13C6,15N3"),
 ("Carnosine", 4.67, 227.2, 110.1, "Histidine-13C6,15N3"), ("Lysine", 4.68, 147.1, 84.1, "Lysine-13C6,15N2"),
 ("3-Methylhistidine", 4.68, 170.0, 126.0, "Histidine-13C6,15N3"), ("Ornithine", 4.72, 133.1, 70.0, "Lysine-13C6,15N2"),
 ("Hydroxylysine", 4.84, 163.1, 128.1, "Threonine-13C4,15N"), ("Alanine", 4.86, 90.0, 44.1, "Alanine-13C3,15N"),
 ("Proline", 4.89, 116.1, 70.1, "Proline-13C5,15N"), ("Sarcosine", 5.05, 90.0, 44.1, "Threonine-13C4,15N"),
 ("Threonine", 5.15, 120.1, 74.1, "Threonine-13C4,15N"), ("Glycine", 5.19, 76.1, 30.1, "Threonine-13C4,15N"),
 ("Hydroxyproline", 5.26, 132.1, 86.1, "Threonine-13C4,15N"), ("Adenosylhomocysteine", 5.30, 385.0, 133.7, "Threonine-13C4,15N"),
 ("Glutamine", 5.43, 147.1, 84.1, "Glutamine-d5"), ("Homocitrulline", 5.43, 190.1, 84.1, "Glutamine-d5"),
 ("Serine", 5.46, 106.1, 60.1, "Serine-13C3,15N"), ("α-Aminoadipic acid", 5.53, 162.1, 98.1, "Asparagine-d3"),
 ("Asparagine", 5.54, 133.1, 74.1, "Asparagine-d3"), ("Citrulline", 5.61, 176.1, 159.1, "Asparagine-d3"),
 ("Homocystine", 6.20, 269.1, 136.0, "Homocystine-d8"), ("Glutamic acid", 6.26, 148.1, 84.1, "Glutamic acid-13C5,15N"),
 ("Cystathionine", 6.75, 223.1, 134.0, "Glutamic acid-13C5,15N"), ("Cystine", 6.99, 241.1, 152.0, "Cystine-13C6,15N2"),
 ("Phosphoethanolamine", 7.32, 142.0, 44.1, "Cystine-13C6,15N2"), ("Argininosuccinic acid", 7.41, 291.1, 70.1, "Cystine-13C6,15N2"),
 ("Aspartic acid", 8.00, 134.1, 74.1, "Aspartic acid-13C4,15N"),
]
RES_RANGE = {**{n: "1–500" for n, *_ in RES},
             **{n: "0.5–250" for n in ("Acetyltyrosine", "Argininosuccinic acid", "Cystine", "Pipecolic acid", "Alloisoleucine")},
             **{n: "2.5–250" for n in ("Adenosylhomocysteine", "Homocitrulline")}, "Ethanolamine": "5–250", "Glycine": "25–500",
             **{n: "5–500" for n in ("Alanine", "Citrulline", "Hydroxylysine", "Hydroxyproline", "Isoleucine", "Leucine", "3-Methylhistidine",
                                     "Ornithine", "Phosphoethanolamine", "Serine", "Taurine")}}
# Table II: (nominal range, mean (%RSD)) for levels 1–3; * = above the calibration range
RES_QC = {
 "Acetyltyrosine": [("4.10–6.15", 4.84, 9.76), ("32.5–48.8", 40.5, 9.76), ("58.5–87.7", 73.9, 15.1)],
 "Adenosylhomocysteine": [("2.77–4.16", 3.16, 15.0), ("17.8–26.7", 20.4, 15.4), ("32.5–48.8", 42.9, 9.98)],
 "Alanine": [("159–239", 191, 15.0), ("524–786", "655*", 20.0), ("890–1334", "979*", 19.4)],
 "β-Alanine": [("10.4–15.5", 10.8, 3.13), ("42.7–64.0", 47.9, 3.12), ("74.0–111", 81.1, 3.01)],
 "α-Aminoadipic acid": [("4.98–7.46", 5.74, 7.53), ("9.92–14.9", 11.2, 6.75), ("14.7–22.1", 17.9, 11.7)],
 "α-Aminobutyric acid": [("3.69–5.54", 4.47, 11.4), ("39.5–59.2", 52.1, 10.9), ("73.6–110", 97.7, 7.43)],
 "β-Aminoisobutyric acid": [("3.82–5.73", 4.40, 9.85), ("17.0–25.5", 19.2, 6.10), ("29.7–44.5", 35.3, 7.75)],
 "γ-Aminobutyric acid": [("3.79–5.69", 4.75, 5.35), ("7.98–12.0", 9.60, 3.45), ("12.0–17.9", 14.1, 5.60)],
 "Anserine": [("3.85–5.77", 4.71, 12.5), ("7.65–11.5", 10.8, 5.82), ("11.5–17.3", 15.9, 7.71)],
 "Arginine": [("8.63–12.9", 9.55, 11.5), ("124–186", 133, 3.60), ("237–356", 257, 3.32)],
 "Argininosuccinic acid": [("2.35–3.53", 2.96, 13.3), ("59.7–89.6", 72.3, 11.1), ("115–172", 141, 7.99)],
 "Asparagine": [("21.4–32.1", 31.3, 2.46), ("97.0–145", 143, 1.39), ("173–259", 250, 2.22)],
 "Aspartic acid": [("18.5–27.7", 19.2, 1.83), ("101–152", 105, 3.54), ("182–274", 189, 2.89)],
 "Carnosine": [("7.69–11.5", 10.3, 9.66), ("18.9–28.3", 23.7, 10.1), ("29.2–43.8", 36.6, 10.2)],
 "Citrulline": [("12.7–19.1", 15.6, 13.9), ("83.8–126", 88.8, 4.17), ("153–230", 161, 1.63)],
 "Cystathionine": [("4.86–7.29", 5.76, 6.47), ("20.1–30.1", 23.1, 8.07), ("35.3–52.9", 40.7, 9.63)],
 "Cystine": [("8.54–12.8", 10.3, 9.50), ("62.7–94.0", 78.8, 6.33), ("116–174", 144, 9.05)],
 "Ethanolamine": [("12.3–18.4", 15.2, 11.1), ("98.5–148", 125, 11.3), ("182–273", 206, 3.53)],
 "Glutamic acid": [("45.8–68.7", 53.7, 6.16), ("304–456", 335, 8.12), ("553–829", "593*", 8.49)],
 "Glutamine": [("286–429", 371, 3.58), ("748–1122", "975*", 5.46), ("1209–1814", "1587*", 8.40)],
 "Glycine": [("154–231", 177, 10.2), ("517–775", "613*", 7.54), ("864–1295", "995*", 10.9)],
 "Histidine": [("35.9–53.9", 47.6, 5.27), ("121–182", 157, 7.27), ("210–316", 266, 4.35)],
 "Homocitrulline": [("7.88–11.8", 9.87, 2.05), ("22.6–33.9", 31.3, 3.83), ("37.1–55.6", 53.7, 2.69)],
 "Homocystine": [("3.29–4.93", 3.60, 9.17), ("10.5–15.8", 12.8, 5.69), ("18.0–27.0", 22.0, 4.71)],
 "Hydroxylysine": [("3.97–5.96", 5.50, 7.60), ("14.3–21.4", 16.58, 11.2), ("24.3–36.5", 28.4, 14.2)],
 "Hydroxyproline": [("7.94–11.9", 10.1, 14.2), ("72.8–109", 97.52, 8.40), ("136–204", 198, 5.02)],
 "Alloisoleucine": [("2.86–4.29", 3.55, 3.12), ("65.5–98.2", 79.15, 4.56), ("128–192", 150, 5.87)],
 "Isoleucine": [("18.4–27.6", 20.1, 3.12), ("143–215", 164.41, 3.01), ("260–389", 282, 2.69)],
 "Leucine": [("40.2–60.3", 43.3, 2.57), ("239–358", 288.87, 4.37), ("444–666", "512*", 4.67)],
 "Lysine": [("21.9–32.9", 28.2, 5.79), ("231–346", 315.89, 4.13), ("436–655", "621*", 4.61)],
 "Methionine": [("6.80–10.2", 7.46, 5.29), ("64.8–97.1", 72.02, 3.83), ("121–181", 139, 2.32)],
 "1-Methylhistidine": [("2.06–3.08", 2.52, 8.18), ("6.17–9.25", 7.12, 9.84), ("10.3–15.4", 12.4, 9.84)],
 "3-Methylhistidine": [("5.82–8.73", 8.03, 8.31), ("36.2–54.3", 43.81, 10.2), ("66.3–99.5", 85.1, 4.10)],
 "Ornithine": [("13.6–20.4", 15.2, 3.13), ("161–242", 168.76, 4.35), ("301–452", 322, 5.76)],
 "Phenylalanine": [("32.2–48.3", 36.5, 3.38), ("248–373", 297.96, 1.80), ("461–692", "547*", 4.31)],
 "Phosphoethanolamine": [("8.53–12.8", 9.64, 12.2), ("57.4–86.1", 64.32, 9.09), ("105–158", 127, 9.93)],
 "Pipecolic acid": [("1.62–2.43", 1.85, 9.98), ("13.4–20.0", 17.25, 8.08), ("24.6–36.9", 31.0, 7.45)],
 "Proline": [("50.7–76.1", 58.6, 4.05), ("268–403", 322.45, 3.46), ("482–722", "578*", 4.99)],
 "Sarcosine": [("3.29–4.94", 4.00, 7.35), ("13.5–20.3", 19.59, 6.51), ("23.7–35.5", 34.8, 4.19)],
 "Serine": [("102–153", 126, 3.65), ("295–443", 383.86, 6.51), ("484–726", "627*", 5.89)],
 "Taurine": [("14.7–22.1", 18.2, 6.28), ("173–260", 234.74, 3.51), ("325–488", 433, 6.26)],
 "Threonine": [("36.7–55.1", 42.6, 2.76), ("203–304", 246.86, 7.01), ("366–549", 464, 4.16)],
 "Tryptophan": [("13.5–20.2", 16.9, 11.5), ("88.4–133", 107.52, 7.72), ("158–237", 188, 10.3)],
 "Tyrosine": [("22.3–33.5", 25.4, 5.35), ("129–194", 148.82, 2.58), ("232–348", 264, 3.40)],
 "Valine": [("74.4–112", 91.3, 6.73), ("256–384", 318.69, 7.67), ("442–664", "532*", 9.56)],
}
res_is = sorted({r[4] for r in RES})
res_tr = [tr(n, q1, q3, None, rt, 1, 0, is_, "ESI+") for n, rt, q1, q3, is_ in RES]
res_val = [dict(compound_name=n, lod=None, loq=float(RES_RANGE[n].split("–")[0]), r2=None, cv_percent=max(q[2] for q in RES_QC[n]), accuracy_percent=None,
                notes=(f"Calibration {RES_RANGE[n]} µmol/L (quadratic, 1/x; r² > 0.990). Three commercial plasma controls, n = 9 over 3 days, %RSD averaged across batches: "
                       + "; ".join(f"L{i + 1} labelled {q[0]}, found {q[1]} ({q[2]}%)" for i, q in enumerate(RES_QC[n]))
                       + ". Accuracy was judged as falling within the labelled control ranges; no % bias is printed."
                       + (" * = above the calibration range." if any(isinstance(q[1], str) for q in RES_QC[n]) else "")))
           for n, *_ in RES]
M_RES = dict(
    title="13-Minute, Comprehensive, Direct LC-MS/MS Analysis of Amino Acids in Plasma",
    analyte=", ".join(r[0] for r in RES), matrix="plasma", clinical_application="Amino Acids", ionization_mode="ESI+",
    instrument_manufacturer="Waters", instrument_model="ACQUITY UPLC / Xevo TQ-S",
    column_brand="Restek", column_name="Raptor Polar X (cat. 9311A12) with Raptor Polar X EXP guard (9311A0252)",
    column_stationary_phase="Hybrid (HILIC and ion exchange)", column_length_mm=100, column_diameter_mm=2.1, column_particle_size_um=2.7, column_temperature_c=35,
    mobile_phase_a="Water, 0.5% formic acid, 1 mM ammonium formate", mobile_phase_b="Acetonitrile:water (90:10), 0.5% formic acid, 1 mM ammonium formate",
    injection_volume_ul=5, sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("No derivatization.\n1. 50 µL plasma + 5 µL 30% sulfosalicylic acid.\n2. Centrifuge 10 min at 4200 rpm.\n"
                         "3. 27.5 µL supernatant + 2 µL internal standard working solution + 225 µL mobile phase B.\n4. Inject 5 µL.\n"
                         "Calibrators (1–500 µmol/L in 1x PBS): 25 µL standard + 2.5 µL 30% sulfosalicylic acid + 2 µL internal standard + 225 µL mobile phase B."),
    validation_units="μmol/L",
    reference="Liang S-H. 13-Minute, Comprehensive, Direct LC-MS/MS Analysis of Amino Acids in Plasma. Restek Corporation application note (CFAN3539).",
    source_type="Application note", source_authors="Shun-Hsin Liang (Restek)",
    source_url="https://discover.restek.com/wp-content/uploads/CFAN3539.pdf", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: Restek application note, public PDF, research use only. 45 amino acids and related compounds without derivatization, including the "
           "markers used for inborn errors of metabolism (alloisoleucine for maple syrup urine disease, argininosuccinic acid, homocitrulline, pipecolic acid, homocystine). "
           "Scheduled MRM, positive ESI, flow 0.3 mL/min, 13 min cycle. Leucine, isoleucine and alloisoleucine (all 132.1 → 86.1) are separated by retention time, "
           "as are alanine and sarcosine (90.0 → 44.1). Glutamine and alanine above 500 µmol/L need dilution; glycine has a high LOQ because of poor ionization. "
           f"{len(res_is)} labelled internal standards; their transitions are not printed.\n\n"
           "To check when reviewing: no source parameters, cone voltages or collision energies are printed (the CE field is empty); one transition per analyte; "
           "the internal standard for alloisoleucine is printed as methionine-13C5,15N; %B in the gradient refers to mobile phase B (acetonitrile:water 90:10); "
           "the note says all %RSD values are below 20% but alanine level 2 is printed as 20.0%; the document has no printed date (© 2024 on the page, literature number CFAN3539B-UNV for the guard cartridge)."),
    gradient_steps=grad([(0.00, 96), (2.00, 96), (10.00, 30), (10.01, 5, "step"), (11.00, 5), (11.01, 96, "step"), (13.00, 96)], 0.3), mrm_transitions=res_tr,
)

# M_BEL and M_RES were prepared but are already in the library (methods 122 and 114), so they are not imported.
BATCH = [(M_LIU, liu_val), (M_WAN, wan_val)]

if __name__ == "__main__":
    dry = "--dry" in sys.argv
    db = SessionLocal()
    client = TestClient(app)
    for payload, val in BATCH:
        if db.query(Method).filter((Method.source_url == payload["source_url"]) | (Method.title == payload["title"])).first():
            print("already imported:", payload["source_url"]); continue
        analytes = {t["compound_name"] for t in payload["mrm_transitions"] if not t["is_internal_standard"]}
        if {v["compound_name"] for v in val} != analytes or len(val) != len(analytes):
            print("NAME MISMATCH, skipped:", payload["title"][:40], analytes ^ {v["compound_name"] for v in val}); continue
        if dry:
            print("ok (dry):", len(payload["mrm_transitions"]), len(payload["gradient_steps"]), len(val), max(len(v["notes"]) for v in val), payload["title"][:50]); continue
        r = client.post("/api/methods/", json=payload)
        if r.status_code != 200:
            print("FAILED", r.status_code, r.text[:300]); sys.exit(1)
        m = r.json()
        for v in val:
            db.add(CompoundValidation(method_id=m["id"], matrix=payload["matrix"], **v))
        db.commit()
        print(f"queued id={m['id']} status={m['status']} transitions={len(m['mrm_transitions'])} gradient={len(m['gradient_steps'])} validation={len(val)} | {m['title'][:46]}")
