"""Batch 7 (2026-11-17): four open-access methods for analytes missing from the library —
plasma lyso-Gb3 for Fabry disease (Sciex), whole-blood vitamin B1/B6 (Agilent), serum 5-HIAA for
neuroendocrine tumours (Waters) and the first-line anti-tuberculosis drugs with six metabolites (Waters).
Sent to the review queue as "submitted". Values as printed in the full text, read twice; discrepancies in
the source are listed under "To check when reviewing". Validation rows store the WORST CASE across levels.
Run once from the project root:  python3 -m backend.scripts.import_open_access_batch7 [--dry]
"""
import sys
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import Method, CompoundValidation
from backend.scripts.import_open_access_batch2 import tr, grad, SUBMITTER, NOTE
from backend.scripts.import_validation_batch import rng, worst_acc

# ── 1. Perrone et al., Molecules 2021 — plasma lyso-Gb3 (Sciex 4500 QTRAP) ─────────────────────
GB3_LV = [("LLOQ", 0.25, 7.7, 2.6, 5.6, 2.1), ("Low", 0.50, 3.8, 5.2, 3.9, 3.1), ("Medium", 50, 2.7, -3.1, 4.8, -1.1), ("High", 100, 2.6, -4.0, 5.8, -5.1)]
gb3_val = [dict(compound_name="Lyso-Gb3", lod=0.10, loq=0.25, r2=None, cv_percent=max(max(l[2], l[4]) for l in GB3_LV),
                accuracy_percent=worst_acc([100 + b for l in GB3_LV for b in (l[3], l[5])]),
                notes=("Worst case over 4 levels (LLOQ 0.25, low 0.5, medium 50, high 100 ng/mL). "
                       f"Intraday (n = 6) CV {rng([l[2] for l in GB3_LV])}%, bias {rng([l[3] for l in GB3_LV])}%; "
                       f"interday (n = 9) CV {rng([l[4] for l in GB3_LV])}%, bias {rng([l[5] for l in GB3_LV])}%. "
                       "Calibration 0.25–100 ng/mL (8 levels, 1/x, background-subtracted), r = 0.99911. LLOD 0.10 ng/mL. "
                       "Absolute recovery > 90%; matrix factor 15.7% at high QC, none at low QC. Diagnostic cut-off 0.6 ng/mL."))]
M_GB3 = dict(
    title="A Rapid and Simple UHPLC-MS/MS Method for Quantification of Plasma Globotriaosylsphingosine (lyso-Gb3)",
    analyte="Globotriaosylsphingosine (lyso-Gb3)", matrix="plasma", clinical_application="Inborn Errors of Metabolism", ionization_mode="ESI+",
    instrument_manufacturer="Sciex", instrument_model="4500 QTRAP with Shimadzu Nexera X2",
    column_brand="Phenomenex", column_name="Kinetex C18 100 Å", column_stationary_phase="C18", column_length_mm=30, column_diameter_mm=4.6, column_particle_size_um=2.6,
    column_temperature_c=30, mobile_phase_a="0.1% formic acid in water", mobile_phase_b="0.1% formic acid in acetonitrile", injection_volume_ul=10,
    ion_spray_voltage=5000, source_temperature_c=450, curtain_gas=30, collision_gas="30 psi (nitrogen)", gas1=40, gas2=40,
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("Assisted protein precipitation with phospholipid removal (Phenomenex Phree cartridges):\n1. 100 µL plasma into a 1 mL Phree cartridge.\n"
                         "2. Add 400 µL 0.1% formic acid in methanol containing lyso-Gb3-D7 (5 ng/mL).\n3. Vortex 2 min.\n"
                         "4. Centrifuge 10 min at 1000× g, 4 °C, into a collection tube.\n5. Inject 10 µL of the filtrate."),
    lloq=0.25, uloq=100, validation_units="ng/mL", laboratory="IRCCS Istituto delle Scienze Neurologiche di Bologna", country="Italy",
    reference="Perrone A, Mohamed S, Donadio V, Liguori R, Contin M. Molecules. 2021;26(23):7358. doi:10.3390/molecules26237358",
    source_type="Journal article", source_authors="Perrone A, Mohamed S, Donadio V, Liguori R, Contin M",
    source_url="https://doi.org/10.3390/molecules26237358", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access (MDPI, CC BY), validated to EMA guidance. Plasma lyso-Gb3 for diagnosis and follow-up of Fabry disease; "
           "applied to 34 patients, 5 carriers of non-relevant GLA variants and 16 controls (cut-off 0.6 ng/mL, sensitivity 97.1%, specificity 100%). "
           "Flow 0.6 mL/min; lyso-Gb3 and the IS elute at 2.95 min. Declustering potential 80 V, collision energy 40 V and entrance potential 13 V "
           "for both transitions. Lithium-heparin plasma. The 184 > 184 transition was monitored qualitatively to follow phospholipid removal.\n\n"
           "To check when reviewing: the text calls the separation a '3 min' gradient but lists steps up to 6.5 min (stored as listed); the collision "
           "gas is printed as 30 psi, the same as the curtain gas."),
    gradient_steps=grad([(0, 30), (1, 30), (4, 95), (5, 95), (5.5, 30), (6.5, 30)], 0.6),
    mrm_transitions=[tr("Lyso-Gb3", 786.46, 282.27, 40, 2.95, assigned="Lyso-Gb3-D7", declustering_potential=80),
                     tr("Lyso-Gb3-D7", 793.56, 289.34, 40, 2.95, is_std=1, declustering_potential=80)],
)

# ── 2. Puts et al., PLoS One 2015 — whole-blood TDP and PLP (Agilent 6460) ─────────────────────
B_PREC = {"TDP": [(44, 4.1, 6.5, 7.7), (104, 3.6, 1.6, 4.0), (157, 2.4, 2.4, 3.5)],   # level nmol/L, intra CV, inter CV, total CV
          "PLP": [(30, 5.5, 8.8, 10.4), (90, 5.9, 1.9, 7.1), (130, 5.5, 2.2, 6.0)]}
B_REC = {"TDP": [100.9, 101.9, 101.2], "PLP": [98.5, 99.7, 100.4]}
b_val = []
for name, key, lod, loq, lin in (("Thiamine diphosphate (TDP)", "TDP", 2.8, 9.4, "linear up to 1153 nmol/L (r = 0.999)"),
                                 ("Pyridoxal 5'-phosphate (PLP)", "PLP", 7.8, 25.9, "linear up to 2864 nmol/L (r = 0.999)")):
    lv = B_PREC[key]
    b_val.append(dict(compound_name=name, lod=lod, loq=loq, r2=None, cv_percent=max(max(l[1:]) for l in lv),
                      accuracy_percent=worst_acc(B_REC[key]),
                      notes=(f"CV is the worst over 3 whole-blood pools ({', '.join(str(l[0]) for l in lv)} nmol/L; n = 40 over 10 days): "
                             f"intra-day {rng([l[1] for l in lv])}%, inter-day {rng([l[2] for l in lv])}%, total {rng([l[3] for l in lv])}%. "
                             f"Accuracy stored = worst spike recovery ({', '.join(map(str, B_REC[key]))}%: two spike levels and half injection volume). "
                             f"LOD/LOQ at S/N 3/10. EP6: {lin}.")))
M_B = dict(
    title="Simultaneous Determination of Underivatized Vitamin B1 and B6 in Whole Blood by Reversed Phase Ultra High Performance Liquid Chromatography Tandem Mass Spectrometry",
    analyte="Thiamine diphosphate (vitamin B1), pyridoxal 5'-phosphate (vitamin B6)", matrix="whole blood", clinical_application="Vitamins", ionization_mode="ESI+",
    instrument_manufacturer="Agilent", instrument_model="6460 with 1290 Infinity",
    column_brand="Agilent", column_name="Zorbax Eclipse Plus C18", column_stationary_phase="C18", column_length_mm=50, column_diameter_mm=2.1, column_particle_size_um=1.8,
    column_temperature_c=5, mobile_phase_a="50 mmol/L ammonium carbonate (4.8 g/L) in 98% water / 2% methanol, pH 9.5 (single isocratic mobile phase)",
    mobile_phase_b="None (isocratic, single mobile phase)", injection_volume_ul=10,
    capillary_voltage_v=3500, gas_temperature=200, gas_flow_lmin=10, nebulizer_pressure_psi=40, sheath_gas_heater_c=350, sheath_gas_flow_lmin=11, nozzle_voltage_v=500,
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("1. 0.5 mL haemolysed K2-EDTA whole blood + 50 µL water (calibrators: 50 µL working standard or water + standard).\n"
                         "2. Add 2 mL cold 5.25% perchloric acid containing TDP-D3 (114 nmol/L) and PLP-D3 (138 nmol/L).\n3. Vortex.\n"
                         "4. Centrifuge 15 min at 3500× g, 4 °C.\n5. Transfer 0.5 mL to a light-protected vial; inject 10 µL (0.2 µm in-line filter after the needle seat, no filtration step)."),
    validation_units="nmol/L", laboratory="Department of Clinical Chemistry and Haematology, Elisabeth-TweeSteden Hospital, Tilburg", country="Netherlands",
    reference="Puts J, de Groot M, Haex M, Jakobs B. PLoS One. 2015;10(7):e0132018. doi:10.1371/journal.pone.0132018",
    source_type="Journal article", source_authors="Puts J, de Groot M, Haex M, Jakobs B",
    source_url="https://doi.org/10.1371/journal.pone.0132018", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access (PLoS One, CC BY). Active forms of vitamin B1 and B6 in whole blood without derivatization or ion-pairing reagent. "
           "Isocratic elution at 0.4 mL/min, column at 5 °C, autosampler at room temperature; PLP 0.67 min, TDP 1.27 min, run 2.5 min; flow to waste "
           "for the first 0.45 min. Collision cell accelerator voltage 3 V. Calibration by standard addition to pooled whole blood (3 levels). "
           "Versus HPLC-fluorescence: TDP y = 0.926x + 3.5 (n = 282, r = 0.910), PLP y = 1.040x − 2.9 (n = 376, r = 0.974). Processed samples stable "
           "48 h at room temperature in the dark.\n\nTo check when reviewing: the article does not say which transition is the quantifier; the one "
           "matching the internal-standard transition (TDP 425 > 122, PLP 248 > 150) is stored as quantifier. The spike levels are given as 75 and "
           "150 nmol/L in Methods but 65 and 150 nmol/L in Table 3. The text gives intra-day PLP CV as '5.5–5.5%' while Table 2 shows 5.5–5.9% (table used)."),
    gradient_steps=grad([(0, 0), (2.5, 0)], 0.4),
    mrm_transitions=[tr("Thiamine diphosphate (TDP)", 425, 122, 20, 1.27, assigned="TDP-D3", cell_accelerator_voltage=3),
                     tr("Thiamine diphosphate (TDP)", 425, 81, 52, 1.27, quant=0, assigned="TDP-D3", cell_accelerator_voltage=3),
                     tr("TDP-D3", 428, 125, 20, 1.27, is_std=1, cell_accelerator_voltage=3),
                     tr("Pyridoxal 5'-phosphate (PLP)", 248, 150, 12, 0.67, assigned="PLP-D3", cell_accelerator_voltage=3),
                     tr("Pyridoxal 5'-phosphate (PLP)", 248, 94, 28, 0.67, quant=0, assigned="PLP-D3", cell_accelerator_voltage=3),
                     tr("PLP-D3", 251, 153, 12, 0.67, is_std=1, cell_accelerator_voltage=3)],
)

# ── 3. Oxelbark & Lövenhamn, Scand J Clin Lab Invest 2021 — serum 5-HIAA (Waters Xevo TQ-S micro) ─
hiaa_val = [dict(compound_name="5-HIAA", lod=None, loq=None, r2=None, cv_percent=9.0, accuracy_percent=96.0,
                 notes=("Total CV 9.0% at 45, 3.3% at 130 and 3.1% at 400 nmol/L; long-term controls 6.0% at 70 and 3.4% at 230 nmol/L. "
                        "Accuracy 96% at 50–100 nmol/L and 99.7% at 500 nmol/L. Linear 5–2000 nmol/L (10 levels, 1/x); dilution to 20,000 nmol/L. "
                        "LLOQ not formally established: 10 nmol/L in serum gave CV 11% (n = 8), S/N about 13. IS-corrected recovery 96–100%."))]
M_HIAA = dict(
    title="Ultrafast LC-MS/MS analysis of 5-hydroxyindoleacetic acid (5-HIAA) in serum",
    analyte="5-Hydroxyindoleacetic acid (5-HIAA)", matrix="serum", clinical_application="Endocrinology", ionization_mode="ESI+",
    instrument_manufacturer="Waters", instrument_model="Xevo TQ-S micro with ACQUITY UPLC I-Class",
    column_brand="Waters", column_name="ACQUITY UPLC HSS T3", column_stationary_phase="C18 (T3)", column_length_mm=100, column_diameter_mm=2.1, column_particle_size_um=1.8,
    column_temperature_c=45, autosampler_temperature_c=6, mobile_phase_a="0.1% formic acid in water", mobile_phase_b="0.3% formic acid in methanol", injection_volume_ul=3,
    capillary_voltage_v=0.7, source_temperature_c=150, desolvation_temperature_c=600, desolvation_gas_flow_lh=800, cone_gas_flow_lh=20,
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("Automated on a Tecan Freedom EVO in a 1 mL 96-well plate:\n1. 100 µL serum, calibrator or control.\n"
                         "2. Add 400 µL methanol containing the internal standard (5-HIAA-D5), stored at −20 °C.\n3. Shake 5 min at 1500 rpm.\n"
                         "4. Incubate 1 h at 4 °C.\n5. Centrifuge 10 min at 4000× g, 8 °C.\n6. Inject 3 µL of supernatant."),
    validation_units="nmol/L",
    reference="Oxelbark J, Lövenhamn A. Scand J Clin Lab Invest. 2021;81(5):401-405. doi:10.1080/00365513.2021.1930141",
    source_type="Journal article", source_authors="Oxelbark J, Lövenhamn A",
    source_url="https://doi.org/10.1080/00365513.2021.1930141", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access (Taylor & Francis). Serum 5-HIAA for neuroendocrine tumours, included in the Swedish national care programme. "
           "Flow 0.4 mL/min; run 3.0 min, 3.6 min injection to injection; 0.2 µm in-line guard filter. Cone voltage 26 V for all transitions. "
           "Calibrators 35, 125 and 1000 nmol/L in water. Matrix effect < 2% after IS correction; carryover < 0.05% after 20,000 nmol/L. "
           "Versus Huslab (n = 22): mean difference 0.44 nmol/L. Reference interval 35–123 nmol/L confirmed on 40 blood donors. Serum stable 3 weeks "
           "refrigerated; extracts 48 h in the autosampler.\n\nTo check when reviewing: retention time is not stated. The internal standard is named "
           "5-hydroxyindole-4,6,7-D3-3-acetic acid-D2 in the reagents and 5-HIAA-D5 in the method (same compound). The abstract gives 3.3% CV at "
           "123 nmol/L, the results 3.3% at 130 nmol/L. The developing laboratory is not named in the text."),
    gradient_steps=grad([(0, 0), (0.2, 0), (2.0, 50), (2.01, 90), (2.5, 90), (2.51, 0, "step"), (3.0, 0)], 0.4),
    mrm_transitions=[tr("5-HIAA", 192.0, 146.0, 14, None, assigned="5-HIAA-D5", cone_voltage=26),
                     tr("5-HIAA", 192.0, 91.0, 36, None, quant=0, assigned="5-HIAA-D5", cone_voltage=26),
                     tr("5-HIAA-D5", 197.0, 151.0, 14, None, is_std=1, cone_voltage=26)],
)

# ── 4. Kivrane et al., J Chromatogr B 2021 — first-line anti-TB drugs + 6 metabolites (Waters Xevo TQ-S) ─
# name, Q1, Q3, cone, CE, RT, cal range, LLOQ, r2, levels [(level, nominal, intra acc, intra CV, inter acc, inter CV)]
TB = [
    ("Isoniazid", 138.3, 121.0, 40, 10, 1.09, "0.16–10.0", 0.16, 0.995, [(0.16, 108.0, 12.8, 101.9, 8.7), (0.40, 98.7, 11.5, 97.0, 7.4), (4.00, 92.9, 6.8, 94.5, 7.4), (8.00, 99.0, 9.2, 95.5, 9.6)]),
    ("Isonicotinic acid", 124.3, 79.9, 30, 16, 1.20, "0.16–10.0", 0.16, 0.991, [(0.16, 95.2, 16.6, 97.2, 12.1), (0.40, 105.4, 8.6, 101.7, 8.3), (4.00, 94.9, 8.4, 97.7, 6.8), (8.00, 97.5, 5.4, 99.6, 4.7)]),
    ("Acetylisoniazid", 180.3, 121.1, 60, 18, 1.32, "0.16–10.0", 0.16, 0.9992, [(0.16, 94.1, 5.3, 91.1, 6.8), (0.40, 93.7, 4.0, 97.4, 5.2), (4.00, 91.1, 3.9, 96.3, 4.3), (8.00, 90.2, 3.7, 92.5, 5.3)]),
    ("Ethambutol", 205.4, 116.0, 40, 18, 0.83, "0.16–10.0", 0.16, 0.9998, [(0.16, 109.3, 4.8, 99.3, 7.6), (0.40, 104.3, 5.4, 97.0, 5.9), (4.00, 97.1, 5.8, None, 5.2), (8.00, 96.2, 4.7, 94.4, 5.2)]),
    ("Rifampicin", 823.4, 791.3, 30, 14, 4.71, "0.47–30.0", 0.47, 0.996, [(0.48, 113.6, 6.1, 109.3, 5.6), (1.20, 104.7, 3.2, 103.5, 5.4), (12.0, 107.1, 3.1, 104.6, 3.5), (24.0, 101.4, 3.3, 100.8, 4.7)]),
    ("25-Desacetylrifampicin", 781.4, 399.2, 50, 15, 4.62, "0.47–30.0", 0.47, 0.989, [(0.48, 100.7, 10.0, 98.7, 13.3), (1.20, 91.1, 12.5, 97.5, 10.0), (12.0, 92.5, 6.0, 98.0, 6.0), (24.0, 102.5, 4.5, 97.1, 6.4)]),
    ("Pyrazinamide", 124.3, 80.9, 20, 12, 3.62, "1.17–75.0", 1.17, 0.998, [(1.20, 96.4, 11.2, 93.7, 8.4), (3.00, 99.0, 9.3, 100.2, 6.6), (30.0, 93.3, 9.4, 96.7, 5.6), (60.0, 89.5, 9.2, 91.7, 6.4)]),
    ("Pyrazine-2-carboxylic acid", 125.1, 80.9, 20, 6, 2.94, "1.17–75.0", 1.17, 0.997, [(1.20, 95.5, 9.5, 93.8, 11.0), (3.00, 103.1, 7.1, 102.4, 7.3), (30.0, 96.9, 3.8, 98.3, 3.8), (60.0, 94.0, 3.3, 93.5, 4.7)]),
    ("5-Hydroxypyrazinamide", 140.1, 122.9, 30, 8, 2.06, "1.17–75.0", 1.17, 0.993, [(1.20, 99.1, 7.9, 93.4, 7.9), (3.00, 107.3, 5.9, 103.9, 5.3), (30.0, 97.2, 4.4, 97.8, 3.8), (60.0, 89.4, 4.5, 91.4, 5.2)]),
    ("5-Hydroxypyrazine-2-carboxylic acid", 141.1, 54.8, 50, 15, 1.71, "1.17–75.0", 2.34, 0.996, [(1.20, 88.0, 14.9, 92.2, 11.5), (3.00, 105.4, 9.9, 102.2, 7.6), (30.0, 102.9, 5.8, 99.3, 4.4), (60.0, 96.3, 5.1, 93.3, 4.8)]),
]
tb_trans, tb_val = [], []
for name, q1, q3, cone, ce, rt, cal, lloq, r2, lv in TB:
    tb_trans.append(tr(name, q1, q3, ce, rt, cone_voltage=cone))
    accs = [a for l in lv for a in (l[1], l[3]) if a is not None]
    cvs = [c for l in lv for c in (l[2], l[4])]
    extra = " Between-run accuracy at MQC is unreadable in the source text ('04.0'); left out." if name == "Ethambutol" else ""
    extra += " LLOQ set at the 2nd calibrator (2.34 µg/mL): signal too low at 1.17; QCs still run at 1.20 µg/mL." if name.startswith("5-Hydroxypyrazine-2") else ""
    tb_val.append(dict(compound_name=name, lod=None, loq=lloq, r2=r2, cv_percent=max(cvs), accuracy_percent=worst_acc(accs),
                       notes=(f"Calibration {cal} µg/mL (7 levels, 1/x or 1/x²). Worst case over LLOQ, LQC, MQC, HQC "
                              f"({', '.join(str(l[0]) for l in lv)} µg/mL): within-run (n = 5) accuracy {rng([l[1] for l in lv])}%, CV {rng([l[2] for l in lv])}%; "
                              f"between-run (3 days) accuracy {rng([l[3] for l in lv if l[3] is not None])}%, CV {rng([l[4] for l in lv])}%.{extra}")))
tb_trans.insert(5, tr("Rifampicin", 821.4, 789.3, 14, 4.57, quant=0, cone_voltage=30))
tb_trans.append(tr("Phenformin (IS)", 206.2, 104.9, 20, 4.10, is_std=1, cone_voltage=30))
M_TB = dict(
    title="LC-MS/MS method for simultaneous quantification of the first-line anti-tuberculosis drugs and six primary metabolites in patient plasma: Implications for therapeutic drug monitoring",
    analyte="Isoniazid, rifampicin, pyrazinamide, ethambutol, acetylisoniazid, isonicotinic acid, 25-desacetylrifampicin, pyrazine-2-carboxylic acid, 5-hydroxypyrazinamide, 5-hydroxypyrazine-2-carboxylic acid",
    matrix="plasma", clinical_application="Therapeutic Drug Monitoring", ionization_mode="ESI+",
    instrument_manufacturer="Waters", instrument_model="Xevo TQ-S with ACQUITY UPLC H-Class",
    column_brand="Waters", column_name="ACQUITY UPLC BEH C8", column_stationary_phase="C8", column_length_mm=75, column_diameter_mm=2.1, column_particle_size_um=1.7,
    column_temperature_c=30, autosampler_temperature_c=5, mobile_phase_a="0.1% formic acid in water", mobile_phase_b="Methanol", injection_volume_ul=1,
    capillary_voltage_v=3.0, source_temperature_c=140, desolvation_temperature_c=600, desolvation_gas_flow_lh=1000, cone_gas_flow_lh=200,
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("1. 50 µL EDTA plasma + 450 µL freshly prepared phenformin solution in methanol (10 µg/mL).\n"
                         "2. Centrifuge 10 min at 10,000 rpm, 5 °C.\n3. Transfer 100 µL supernatant to a glass vial with 900 µL 0.1% formic acid.\n"
                         "4. Vortex briefly; inject 1 µL. Process plasma within 4 h of collection (or store at −20 °C for up to 24 h)."),
    validation_units="μg/mL",
    laboratory="Latvian Institute of Organic Synthesis; Latvian Biomedical Research and Study Centre; Riga East University Hospital", country="Latvia",
    reference="Kivrane A, Grinberga S, Sevostjanovs E, et al. J Chromatogr B. 2021;1185:122986. doi:10.1016/j.jchromb.2021.122986",
    source_type="Journal article",
    source_authors="Kivrane A, Grinberga S, Sevostjanovs E, Igumnova V, Pole I, Viksna A, Bandere D, Krams A, Cirule A, Pugovics O, Ranka R",
    source_url="https://doi.org/10.1016/j.jchromb.2021.122986", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access (Elsevier, CC BY-NC-ND; also on Zenodo, record 5716255). Validated to EMA guidance and applied to 34 "
           "pulmonary TB patients (0, 2 and 6 h after dose). Flow 0.2 mL/min; analytes elute within 5 min, total run 10 min including 5.5 min "
           "re-equilibration. Rifampicin forms rifampicin quinone, giving two peaks: both channels (823.4 > 791.3 at 4.71 min and 821.4 > 789.3 at "
           "4.57 min) are used to quantify rifampicin; the first is stored as quantifier. Matrix factor 0.9–1.1 for most analytes, but < 0.5 for "
           "ethambutol and isoniazid; isonicotinic acid CV 21.8% across six plasma sources at LQC. Isonicotinic acid and 25-desacetylrifampicin are "
           "unstable in the autosampler (71.6–81.3%); isoniazid and isonicotinic acid fall > 15% after 7 days at −20 °C. Dilution of ethambutol and "
           "isoniazid above the ULOQ fails (accuracy 78.4–83.7%).\n\nTo check when reviewing: phenformin is used only to monitor system stability; "
           "quantification uses absolute calibration (peak area, no IS ratio), so no internal standard is assigned to the analytes. The gradient "
           "time for the return to initial conditions is not given (stored up to 4.5 min). Calibration ranges are reported as μg/mL."),
    gradient_steps=grad([(0, 1), (1, 1), (2.5, 98), (4.5, 98)], 0.2),
    mrm_transitions=tb_trans,
)

BATCH = [(M_GB3, gb3_val), (M_B, b_val), (M_HIAA, hiaa_val), (M_TB, tb_val)]

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
