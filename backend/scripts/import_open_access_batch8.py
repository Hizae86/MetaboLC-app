"""Batch 8 (2026-11-17): three recent open-access methods in areas the library already covers —
plasma-free metanephrines by WCX-SPE and HILIC (Sciex QTRAP 5500, 2025), cenobamate with a CE-IVD
anti-seizure kit (Waters Xevo TQ-XS, 2024) and 8 antiepileptic drugs + 2 metabolites in DBS and VAMS
(Waters Xevo TQ-XS, 2025). Sent to the review queue as "submitted". Values as printed in the full text,
read twice; discrepancies in the source are listed under "To check when reviewing".
Run once from the project root:  python3 -m backend.scripts.import_open_access_batch8 [--dry]
"""
import sys
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import Method, CompoundValidation
from backend.scripts.import_open_access_batch2 import tr, grad, SUBMITTER, NOTE
from backend.scripts.import_validation_batch import rng, worst_acc

# ── 1. Choi et al., Molecules 2025 — plasma-free metanephrines (Sciex QTRAP 5500) ─────────────
# accuracy controls (Table 1), within/between run (Table 2): (nominal, accuracy) and (nominal, within CV, within acc, between CV, between acc)
MN = dict(acc=[(0.30, 101.5), (0.93, 96.5), (4.94, 96.3)], prec=[(0.30, 1.4, 99.8, 1.7, 100.7), (4.94, 1.4, 96.5, 1.5, 96.5)],
          lloq=(0.123, 5.5, 102.8), lin="0.11–13.92")
NMN = dict(acc=[(0.67, 98.1), (1.50, 96.2), (8.26, 95.7)], prec=[(0.67, 4.2, 98.0, 7.0, 93.1), (8.26, 1.8, 98.4, 3.0, 96.3)],
           lloq=(0.432, 11.0, 94.6), lin="0.14–26.43")
met_val = []
for name, d in (("Metanephrine", MN), ("Normetanephrine", NMN)):
    accs = [a for _, a in d["acc"]] + [p[2] for p in d["prec"]] + [p[4] for p in d["prec"]]
    cvs = [p[1] for p in d["prec"]] + [p[3] for p in d["prec"]]
    met_val.append(dict(compound_name=name, lod=None, loq=d["lloq"][0], r2=0.9995, cv_percent=max(cvs), accuracy_percent=worst_acc(accs),
                        notes=(f"Worst case over control levels ({', '.join(str(a[0]) for a in d['acc'])} nmol/L): accuracy {rng(accs)}%; "
                               f"within-run CV {rng([p[1] for p in d['prec']])}% and between-run CV {rng([p[3] for p in d['prec']])}% (n = 20, 5 days). "
                               f"LLOQ {d['lloq'][0]} nmol/L (CV {d['lloq'][1]}%, accuracy {d['lloq'][2]}%, n = 5). Linearity {d['lin']} nmol/L, R² 0.9995 (one value for the regression).")))
M_MET = dict(
    title="Plasma-Free Metanephrine and Normetanephrine Quantification for Clinical Applications Validated by Combining Solid-Phase Extraction and HPLC-MS/MS",
    analyte="Metanephrine, normetanephrine", matrix="plasma", clinical_application="Catecholamines", ionization_mode="ESI+",
    instrument_manufacturer="Sciex", instrument_model="QTRAP 5500 with ExionLC",
    column_brand="Waters", column_name="ACQUITY UPLC BEH Amide", column_stationary_phase="Amide (HILIC)", column_length_mm=100, column_diameter_mm=2.1, column_particle_size_um=1.7,
    column_temperature_c=60, mobile_phase_a="20 mM ammonium formate in 0.1% formic acid", mobile_phase_b="Methanol",
    ion_spray_voltage=2500, source_temperature_c=600, curtain_gas=45, collision_gas="Medium", gas1=50, gas2=55,
    sample_prep_method="Solid Phase Extraction (SPE)",
    sample_prep_details=("Weak cation-exchange SPE (Phenomenex Strata-X-CW 33 µm, 8E-S035-AGB):\n1. Condition with 1 mL methanol, equilibrate with 1 mL water.\n"
                         "2. Dilute EDTA plasma with 0.1% formic acid in water; centrifuge 10 min at 15,000× g.\n3. Load 1 mL of the diluted sample.\n"
                         "4. Wash with 1 mL methanol, then 1 mL water.\n5. Elute with 100 µL 5% formic acid in acetonitrile.\n"
                         "6. Dry under nitrogen (positive pressure, 40 °C, 30 L/min, 1 h).\n7. Reconstitute in A:B 1:9 (initial LC conditions).\n"
                         "Calibrators (6PLUS1), controls and internal standards (metanephrine-d3, normetanephrine-d3) from Chromsystems."),
    validation_units="nmol/L", laboratory="Department of Laboratory Medicine, Korea University Anam Hospital, Seoul", country="South Korea",
    reference="Choi H, Yim J, Yun J, Lee JK, Kim KJ, Nam M, Nam MH, Cho Y, Yun SG. Molecules. 2025;30(19):3847. doi:10.3390/molecules30193847",
    source_type="Journal article", source_authors="Choi H, Yim J, Yun J, Lee JK, Kim KJ, Nam M, Nam MH, Cho Y, Yun SG",
    source_url="https://doi.org/10.3390/molecules30193847", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access (MDPI, CC BY). Laboratory-developed test validated to FDA BMV 2018 and CLSI C62-A for pheochromocytoma and "
           "paraganglioma. HILIC at 0.5 mL/min, column 60 °C, run 5 min; metanephrine 2.16 min, normetanephrine 2.68 min. Entrance potential 10 V. "
           "Only quantifier transitions are used (qualifiers were tried but lacked sensitivity at the LLOQ); identity by RT within ±0.10 min. "
           "IS-normalized recovery 86–112%, matrix factor 98–112%, process efficiency 92–121% (121% for metanephrine at the lowest level). "
           "No carryover. Versus Green Cross (Passing–Bablok): metanephrine slope 0.822, normetanephrine slope 1.132.\n\n"
           "To check when reviewing: the plasma volume, the dilution ratio before SPE and the step at which the internal standard is added are not "
           "stated; injection volume is not stated. The gradient is described as 90% B for 1 min, to 65% B over 1.5 min, then 'decreased to 40% "
           "after 1 min' and returned to 90% (timing of the return not given); stored up to 3.5 min. The normetanephrine LLOQ (0.432 nmol/L) is above "
           "the lowest point of the linearity range (0.14 nmol/L). The precursor m/z are printed as 180.036, 183.051, 166.100 and 169.400."),
    gradient_steps=grad([(0, 90), (1, 90), (2.5, 65), (3.5, 40)], 0.5),
    mrm_transitions=[tr("Metanephrine", 180.036, 148.2, 23, 2.16, assigned="Metanephrine-d3", declustering_potential=136, cell_exit_potential=10),
                     tr("Metanephrine-d3", 183.051, 151.2, 23, 2.16, is_std=1, declustering_potential=141, cell_exit_potential=8),
                     tr("Normetanephrine", 166.100, 134.1, 26, 2.68, assigned="Normetanephrine-d3", declustering_potential=100, cell_exit_potential=7),
                     tr("Normetanephrine-d3", 169.400, 137.2, 26, 2.68, is_std=1, declustering_potential=100, cell_exit_potential=7)],
)

# ── 2. Molteni et al., Molecules 2024 — cenobamate + concomitant ASMs (Waters Xevo TQ-XS) ────────
# Table 3: bias% and CV% — inter-day, then intra-day days 1-5
CNB_LV = {"LLOQ 0.8": ([7.2, 18.4, -11.9, -16.3, -6.7, -1.9], [4.4, 2.6, 10.2, 9.2, 3.4, 14.6]),
          "LQC 3": ([5.4, -1.7, -0.9, 4.5, 12.4, 3.9], [3.4, 3.2, 5.2, 7.4, 6.1, 5.5]),
          "MQC 30": ([-0.6, -5.3, 10.3, 1.4, 4.8, 2.1], [6.1, 5.3, 5.8, 9.3, 7.8, 5.8]),
          "HQC 60": ([-0.2, -13.7, -0.5, -1.2, -1.5, -3.4], [3.6, 5.5, 6.5, 3.2, 7.1, 6.0])}
cnb_bias = [b for v in CNB_LV.values() for b in v[0]]
cnb_cv = [c for v in CNB_LV.values() for c in v[1]]
cnb_val = [dict(compound_name="Cenobamate", lod=None, loq=0.8, r2=0.999, cv_percent=max(cnb_cv), accuracy_percent=worst_acc([100 + b for b in cnb_bias]),
                notes=("Worst case over LLOQ 0.8, LQC 3, MQC 30, HQC 60 mg/L (5 × 5 scheme): bias "
                       f"{rng(cnb_bias)}%, CV {rng(cnb_cv)}%; inter-day bias {rng([v[0][0] for v in CNB_LV.values()])}%, CV {rng([v[1][0] for v in CNB_LV.values()])}%. "
                       "Range 0.8–80 mg/L (1/x), R² 0.999. IS-normalized matrix effect 90–105%, recovery 97–114% (7 matrices). "
                       "Dilution 1:2 and 1:16 within 10.5% bias."))]
M_CNB = dict(
    title="Quantitative Analysis of Cenobamate and Concomitant Anti-Seizure Medications in Human Plasma via Ultra-High Performance Liquid Chromatography–Tandem Mass Spectrometry",
    analyte="Cenobamate (16 concomitant anti-seizure medications measured with a CE-IVD kit; their transitions are in Supplementary Table S5)",
    matrix="plasma", clinical_application="Antiepileptic Drugs", ionization_mode="ESI+",
    instrument_manufacturer="Waters", instrument_model="Xevo TQ-XS with ACQUITY UPLC I-Class",
    column_brand="Agilent", column_name="InfinityLab Poroshell EC-C18", column_stationary_phase="C18", column_length_mm=50, column_diameter_mm=2.1, column_particle_size_um=1.9,
    column_temperature_c=35, autosampler_temperature_c=10, mobile_phase_a="0.1% formic acid in water", mobile_phase_b="0.1% formic acid in acetonitrile", injection_volume_ul=1,
    capillary_voltage_v=1.5, source_temperature_c=150, desolvation_temperature_c=500, desolvation_gas_flow_lh=1000, cone_gas_flow_lh=150,
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("Kit procedure (Eureka 'Plasmatic AEDs in LC-MS — Deuterated Internal Standards'):\n1. 50 µL lithium-heparin plasma + 25 µL mobile phase A.\n"
                         "2. Add 500 µL acetonitrile containing the internal standards (lamotrigine-13C-d3 for cenobamate).\n3. Vortex; incubate 15 min at −20 °C.\n"
                         "4. Centrifuge 15 min at 16,000× g (96-well plate on a Tecan Freedom EVO: 20 min at 3500× g).\n"
                         "5. Dilute 50 µL supernatant in 450 µL mobile phase A; inject 1 µL."),
    validation_units="mg/L", laboratory="SSD Laboratory Medicine, Fondazione IRCCS Istituto Neurologico Carlo Besta, Milan", country="Italy",
    reference="Molteni L, Charlier B, Coglianese A, Izzo V, Assenza G, Menna P, de Grazia U, D'Urso A. Molecules. 2024;29(4):884. doi:10.3390/molecules29040884",
    source_type="Journal article", source_authors="Molteni L, Charlier B, Coglianese A, Izzo V, Assenza G, Menna P, de Grazia U, D'Urso A",
    source_url="https://doi.org/10.3390/molecules29040884", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access (MDPI, CC BY). Cenobamate added to a CE-IVD anti-seizure medication kit; full ICH M10 validation for "
           "cenobamate only (partial validation of the kit compounds in the supplement). Flow 0.5 mL/min, run 7 min, cenobamate 3.32 min. Collision "
           "gas 0.15 mL/min. Lamotrigine-13C-d3 normalizes cenobamate (d4-cenobamate was hard to obtain). Unstable at room temperature (−19.6 to "
           "−27.8% after 72 h); stable 1 week at 4 °C and 24 h in the autosampler. Versus the previous method (n = 99, Passing–Bablok): slope 0.786, "
           "intercept 0.329, mean bias 10.1%. ISR: 80% of 15 samples within ±20%.\n\nTo check when reviewing: the gradient is described as steps "
           "(2→13% B in 0.5 min, hold 1.3 min; →21% in 0.1 min, hold 1 min; →50% in 0.5 min, hold 0.5 min; →80% in 0.1 min, hold 0.3 min; wash at "
           "95% B for 0.6 min; back to 2%), stored up to 4.3 min because the timing of the wash and return is not given. The calibration levels are "
           "listed as 0, 2.4, 5, 10, 20, 40, 80 mg/L, yet the LLOQ of 0.8 mg/L is said to be included in the curve. The internal-standard "
           "transition and the transitions of the other 16 drugs are only in Supplementary Table S5."),
    gradient_steps=grad([(0, 2), (0.5, 13), (1.8, 13), (1.9, 21), (2.9, 21), (3.4, 50), (3.9, 50), (4.0, 80), (4.3, 80)], 0.5),
    mrm_transitions=[tr("Cenobamate", 268.02, 154.99, 14, 3.32, assigned="Lamotrigine-13C-d3", cone_voltage=20),
                     tr("Cenobamate", 268.02, 197.99, 10, 3.32, quant=0, assigned="Lamotrigine-13C-d3", cone_voltage=20)],
)

# ── 3. Cobo-Golpe et al., J Anal Toxicol 2025 — 8 AEDs + 2 metabolites in DBS and VAMS (Waters Xevo TQ-XS) ─
# name, IS, polarity, cal group, [(Q1, Q3, cone, CE, quant)], RT, IS (Q1, Q3, cone, CE, RT)
GROUPS = {"A": (10, 202.5), "B": (2.5, 50.625), "C": (1, 20.25), "D": (0.5, 10.125)}
AED = [
    ("Phenytoin", "Phenytoin-d10", "ESI-", "B", [(251.0, 102.0, 6, 20, 1), (251.0, 77.0, 6, 26, 0)], 1.85, (261.1, 106.0, 32, 22, 1.84)),
    ("Phenobarbital", "Phenobarbital-d5", "ESI-", "C", [(231.1, 42.0, 30, 15, 1), (231.1, 188.1, 30, 10, 0)], 1.57, (236.1, 193.5, 30, 10, 1.56)),
    ("Valproic acid", "Valproic acid-d4", "ESI-", "A", [(143.1, 143.1, 5, 6, 1), (143.1, 143.1, 35, 6, 0)], 2.12, (147.01, 147.01, 25, 5, 2.12)),
    ("Carbamazepine", "Carbamazepine-d10", "ESI+", "C", [(237.2, 179.0, 40, 32, 1), (237.2, 165.1, 40, 36, 0)], 3.43, (247.0, 204.1, 2, 31, 3.40)),
    ("Lamotrigine", "Lamotrigine-d3", "ESI+", "C", [(256.0, 144.9, 2, 32, 1), (256.0, 158.96, 2, 26, 0)], 1.58, (261.1, 191.3, 2, 20, 1.56)),
    ("Lacosamide", "Lacosamide-13C-d3", "ESI+", "C", [(251.0, 91.1, 20, 28, 0), (251.0, 108.1, 20, 28, 1)], 1.68, (255.1, 120.1, 40, 30, 1.66)),
    ("Levetiracetam", "Levetiracetam-d6", "ESI+", "B", [(171.2, 126.1, 15, 13, 1), (171.2, 98.1, 15, 22, 0)], 1.07, (177.25, 132.2, 15, 13, 1.04)),
    ("Oxcarbazepine", "Oxcarbazepine-13C6", "ESI+", "D", [(253.2, 208.0, 50, 27, 1), (253.2, 180.0, 50, 28, 0)], 2.64, (259.2, 171.2, 30, 20, 2.64)),
    ("Carbamazepine-10,11-epoxide", "Carbamazepine-10,11-epoxide-13C6", "ESI+", "D", [(253.2, 180.1, 16, 22, 1), (253.2, 167.1, 16, 32, 0)], 2.41, (259.2, 186.1, 2, 30, 2.41)),
    ("10,11-Dihydro-10-hydroxycarbamazepine", "10,11-Dihydro-10-hydroxycarbamazepine-13C6", "ESI+", "B", [(255.2, 237.2, 18, 8, 1), (255.2, 194.2, 18, 20, 0)], 1.99, (261.1, 243.2, 18, 8, 1.99)),
]
aed_trans, aed_val = [], []
for name, ist, pol, grp, rows, rt, isr in AED:
    for q1, q3, cone, ce, quant in rows:
        aed_trans.append(tr(name, q1, q3, ce, rt, quant=quant, assigned=ist, pol=pol, cone_voltage=cone))
    aed_trans.append(tr(ist, isr[0], isr[1], isr[3], isr[4], is_std=1, pol=pol, cone_voltage=isr[2]))
    lo, hi = GROUPS[grp]
    aed_val.append(dict(compound_name=name, lod=None, loq=lo, r2=None, cv_percent=None, accuracy_percent=None,
                        notes=(f"Calibration {lo}–{hi} µg/mL (group {grp}, 7 levels, 1/x), r² > 0.99 in VAMS and DBS; LOQ = lowest calibrator (Table 1). "
                               "Per-analyte precision and accuracy are only in Supplementary Table S2; across all analytes: accuracy 95.7–102.1% (VAMS), "
                               "93.7–103.6% (DBS); intra-day CV < 11% / < 13.6%, inter-day < 13.3% / < 10.2% (VAMS / DBS).")))
M_AED = dict(
    title="Development and application of an LC-MS/MS method for 8 antiepileptic drugs and 2 metabolites using microsampling techniques (DBS and VAMS)",
    analyte="Valproic acid, levetiracetam, lamotrigine, lacosamide, carbamazepine, carbamazepine-10,11-epoxide, oxcarbazepine, 10,11-dihydro-10-hydroxycarbamazepine, phenytoin, phenobarbital",
    matrix="dried blood spot", clinical_application="Antiepileptic Drugs", ionization_mode="ESI+",
    instrument_manufacturer="Waters", instrument_model="Xevo TQ-XS with ACQUITY UPLC H-Class",
    column_brand="Waters", column_name="ACQUITY UPLC CORTECS T3", column_stationary_phase="C18 (T3)", column_length_mm=100, column_diameter_mm=2.1, column_particle_size_um=1.6,
    column_temperature_c=45, mobile_phase_a="5 mM ammonium acetate in water, pH 4.5", mobile_phase_b="5 mM ammonium acetate in acetonitrile:water 95:5, pH 4.5",
    injection_volume_ul=2, capillary_voltage_v=3.0, source_temperature_c=150, desolvation_temperature_c=250, desolvation_gas_flow_lh=600, cone_gas_flow_lh=150,
    collision_gas="Argon, 0.15 mL/min",
    sample_prep_method="Other",
    sample_prep_details=("Microsamples: 20 µL Mitra VAMS tip, or a 6 mm central punch from a 35 µL DBS (Whatman 903), dried ≥ 2 h at room temperature.\n"
                         "1. Place the tip or punch in a 2 mL tube.\n2. Add 40 µL water, 20 µL internal-standard mix and 140 µL methanol, vortexing after each addition.\n"
                         "3. Shake 30 min (horizontal shaker, room temperature).\n4. Centrifuge 5 min at 14,500 rpm; evaporate the supernatant.\n"
                         "5. Reconstitute in 50 µL A:B 60:40; centrifuge 5 min at 14,500 rpm; inject 2 µL (ESI+) or 5 µL (ESI−)."),
    cv_intra_percent=13.6, cv_inter_percent=13.3, validation_units="μg/mL",
    laboratory="Toxicology Service, Institute of Forensic Sciences, Universidade de Santiago de Compostela", country="Spain",
    reference="Cobo-Golpe M, Paniagua-González L, Lendoiro E, et al. J Anal Toxicol. 2025;50(1):bkaf073. doi:10.1093/jat/bkaf073",
    source_type="Journal article",
    source_authors=("Cobo-Golpe M, Paniagua-González L, Lendoiro E, Blanco-Ces M, López-Rabuñal Á, Abella J, Castro D, Melcón C, Fuentes P, "
                    "Carballeira I, García C, Gómez C, López-Rivadulla Lamas M, Cruz A, de-Castro-Ríos A"),
    source_url="https://doi.org/10.1093/jat/bkaf073", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access (Oxford University Press, CC BY). Validated to EMA guidance plus IATDMCT microsampling criteria "
           "(volume, hematocrit and volcano effects) for both DBS and VAMS; applied to 80 children and adults, compared with venous blood and "
           "routine plasma. Two injections: ESI+ method (6 min, gradient stored) and ESI− method for phenytoin, phenobarbital and valproic acid "
           "(20% B → 60% at 1 min → 98% at 1.5 min, hold to 2.5 min, 20% at 2.6 min, 4 min total; capillary 4 kV). Flow 0.5 mL/min, 45 °C. "
           "Valproic acid does not fragment: the pseudo-transition 143.1 > 143.1 is used at two cone voltages. Quantifier transitions as marked in "
           "bold in Table 2 (for lacosamide the second one). Recovery 88.4–97.1% (VAMS) but 6.2–62.5% (DBS, hematocrit-dependent). Oxcarbazepine is "
           "unstable at room temperature (−33 to −62% in 15 days); lacosamide and oxcarbazepine unstable in the autosampler. Method-level CV values "
           "stored are the upper bounds given in the text.\n\nTo check when reviewing: the lacosamide internal standard is named 'lacosamide "
           "13Cd3' in the reagents and 'LA-13Cd6' in Table 2 (Q1 255.1 = +4 Da, consistent with 13C-d3; stored as 13C-d3). ionization_mode shows "
           "ESI+ but three analytes run in a separate ESI− injection (polarity is stored per transition). The ESI+ gradient says 98% B at 3 min and "
           "'returned to initial conditions at min 3.9'; stored as 98% at 3 min, 10% at 3.9 min."),
    gradient_steps=grad([(0, 10), (0.22, 27), (0.5, 27), (2.22, 31), (3.0, 98), (3.9, 10), (6.0, 10)], 0.5),
    mrm_transitions=aed_trans,
)

BATCH = [(M_MET, met_val), (M_CNB, cnb_val), (M_AED, aed_val)]

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
