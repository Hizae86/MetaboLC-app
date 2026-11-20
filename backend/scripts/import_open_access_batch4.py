"""Batch 4 (2026-11-16): four open-access methods (antidepressants,
benzodiazepines, drugs of abuse in CSF) with per-analyte validation, sent to
the review queue as "submitted". Values are as printed in the articles (two
independent readings agreed unless a note says otherwise). Validation rows
store the WORST CASE across QC levels; the range is in each row's note.
Run once from the project root:  python -m backend.scripts.import_open_access_batch4
"""
import sys
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import Method, CompoundValidation
from backend.scripts.import_open_access_batch2 import tr, grad, SUBMITTER, NOTE
from backend.scripts.import_validation_batch import from_levels, rng, worst_acc

# ── 1. Wang et al., Front Pharmacol 2025 — 23 antidepressants in serum ──────
# name, Q1, Q3, DP, CE, CXP, RT, IS, LLOQ
WANG = [
 ("Escitalopram", 325.3, 109.1, 100, 35, 22, 1.82, "Citalopram-d6", 4), ("Sertraline", 306.0, 275.2, 30, 18, 10, 2.15, "Sertraline-d3", 4),
 ("Fluvoxamine", 319.2, 71.1, 60, 32, 20, 1.98, "Fluvoxamine-d3", 10), ("Paroxetine", 330.2, 192.2, 100, 30, 14, 2.00, "Paroxetine-d4", 4),
 ("Duloxetine", 298.0, 154.0, 50, 7, 11, 2.00, "Duloxetine-d7", 4), ("Milnacipran", 246.8, 230.1, 95, 16, 7, 1.67, "Milnacipran-d5", 10),
 ("Fluoxetine", 310.1, 44.0, 75, 40, 8, 2.02, "Fluoxetine-d5", 10), ("Venlafaxine", 278.1, 121.0, 90, 38, 8, 1.70, "Venlafaxine-d6", 10),
 ("O-Desmethylvenlafaxine", 264.1, 246.2, 60, 17, 10, 1.60, "O-Desmethylvenlafaxine-d3", 10), ("Mirtazapine", 266.3, 195.1, 80, 32, 20, 1.63, "Mirtazapine-d3", 4),
 ("Trazodone", 372.1, 148.3, 110, 45, 20, 1.80, "Trazodone-d4", 20), ("Bupropion", 240.1, 184.2, 60, 17, 12, 1.66, "Bupropion-d9", 4),
 ("Hydroxybupropion", 256.2, 139.2, 50, 33, 8, 1.63, "Hydroxybupropion-d6", 20), ("Norfluoxetine", 296.2, 134.2, 50, 11, 10, 2.01, "Norfluoxetine-d5", 10),
 ("Mianserin", 265.1, 208.3, 90, 27, 10, 1.85, "Mianserin-d3", 4), ("Nordoxepin", 265.7, 235.0, 70, 21, 10, None, "Nordoxepin-d3", 10),
 ("Doxepin", 280.3, 106.9, 90, 28, 7, 1.85, "Doxepin-d3", 10), ("Agomelatine", 244.0, 185.0, 96, 21, 11, 2.24, "Agomelatine-d6", 4),
 ("Vortioxetine", 298.9, 150.2, 110, 31, 11, 2.19, "Vortioxetine-d8", 4), ("Clomipramine", 315.2, 86.1, 130, 22, 40, 2.17, "Clomipramine-d3", 10),
 ("Amitriptyline", 278.2, 233.0, 80, 24, 10, 2.03, "Amitriptyline-d6", 10), ("Nortriptyline", 264.2, 233.3, 85, 22, 13, 2.04, "Nortriptyline-d4", 10),
 ("Norclomipramine", 301.1, 72.0, 100, 46, 40, None, "Norclomipramine-d3", 10),
]
WANG_IS = [
 ("Sertraline-d3", 309.1, 275.1, 30, 18, 10), ("Citalopram-d6", 330.6, 109.2, 100, 35, 22), ("Fluvoxamine-d3", 323.3, 70.9, 60, 32, 20),
 ("Paroxetine-d4", 334.3, 196.2, 100, 30, 14), ("Duloxetine-d7", 305.3, 154.0, 50, 7, 11), ("Milnacipran-d5", 252.2, 235.1, 95, 16, 7),
 ("Fluoxetine-d5", 315.2, 44.2, 75, 40, 8), ("Venlafaxine-d6", 284.2, 121.3, 90, 38, 8), ("O-Desmethylvenlafaxine-d3", 267.2, 249.3, 60, 17, 10),
 ("Mirtazapine-d3", 268.7, 195.4, 80, 32, 20), ("Trazodone-d4", 378.3, 150.2, 110, 45, 20), ("Bupropion-d9", 249.2, 185.0, 60, 17, 12),
 ("Hydroxybupropion-d6", 262.2, 139.2, 50, 33, 8), ("Norfluoxetine-d5", 301.0, 139.2, 50, 11, 10), ("Mianserin-d3", 268.5, 208.3, 90, 27, 10),
 ("Nordoxepin-d3", 269.1, 235.3, 70, 21, 10), ("Doxepin-d3", 283.5, 107.0, 90, 28, 7), ("Agomelatine-d6", 250.2, 188.0, 96, 21, 11),
 ("Vortioxetine-d8", 307.2, 153.0, 110, 31, 11), ("Clomipramine-d3", 318.2, 89.2, 130, 22, 40), ("Amitriptyline-d6", 284.2, 233.2, 80, 24, 10),
 ("Nortriptyline-d4", 268.4, 233.9, 85, 22, 13), ("Norclomipramine-d3", 304.0, 75.1, 100, 46, 40),
]
wang_tr = ([tr(n, q1, q3, ce, rt, 1, 0, istd, declustering_potential=dp, cell_exit_potential=cxp) for n, q1, q3, dp, ce, cxp, rt, istd, _ in WANG]
           + [tr(n, q1, q3, ce, None, 1, 1, None, declustering_potential=dp, cell_exit_potential=cxp) for n, q1, q3, dp, ce, cxp in WANG_IS])
wang_val = [dict(compound_name=n, lod=None, loq=loq, r2=None, cv_percent=None, accuracy_percent=None,
                 notes="LLOQ from the linear range given in the text (single reading; r ≥ 0.9979 for all analytes). The article's Table 3 reports "
                       "intra- and inter-day RSD and RE at four levels, but its row labels are ambiguous as published, so it is not transcribed.")
            for n, *_r, loq in WANG]
M_WANG = dict(
    title="High-performance liquid chromatography–tandem mass spectrometry for simultaneous determination of 23 antidepressants and active metabolites in human serum and its application in therapeutic drug monitoring",
    analyte=", ".join(r[0] for r in WANG), matrix="serum", clinical_application="Antidepressants", ionization_mode="ESI+",
    instrument_manufacturer="Sciex", instrument_model="Triple Quad 4500MD",
    column_brand="Agilent", column_name="ZORBAX Eclipse Plus C18", column_stationary_phase="C18",
    column_length_mm=50, column_diameter_mm=2.1, column_particle_size_um=1.7, column_temperature_c=40,
    mobile_phase_a="Water with 0.1% formic acid and 10 mmol/L ammonium acetate", mobile_phase_b="Methanol with 0.1% formic acid",
    injection_volume_ul=2, ion_spray_voltage=4500, source_temperature_c=450, curtain_gas=40, gas1=50, gas2=40, collision_gas="medium",
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("1. 50 µL serum + 250 µL acetonitrile containing all internal standards.\n2. Vortex 1 min.\n"
                         "3. Centrifuge at 15,000 g for 5 min at 4 °C.\n4. Add 200 µL of 8% methanol to 30 µL supernatant.\n5. Vortex 1 min.\n6. Inject 2 µL."),
    validation_units="ng/mL",
    reference="Wang J, Wang J, Zhang C, Li G. Front Pharmacol. 2025;16:1531496. doi:10.3389/fphar.2025.1531496",
    source_type="Journal article", source_authors="Wang J, Wang J, Zhang C, Li G",
    source_url="https://doi.org/10.3389/fphar.2025.1531496", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access, CC BY. LC: Shimadzu-based Jasper HPLC. Flow 0.6 mL/min, run time 3.0 min. Entrance potential 15 V. "
           "Each analyte has its own deuterated internal standard; escitalopram is paired with citalopram-d6. "
           "Linear ranges (ng/mL): 4–1000 for sertraline, mirtazapine, vortioxetine, agomelatine, bupropion, mianserin, escitalopram, paroxetine and duloxetine; "
           "20–5000 for hydroxybupropion and trazodone; 10–2500 for the rest.\n\n"
           "To check when reviewing: one transition per compound; retention times of nordoxepin and norclomipramine are left empty because the two readings disagreed on whether the article gives them; "
           "escitalopram is printed as “Escitralopram” in the MS table; the column is printed with 1.7 µm particles; "
           "the validation table (Table 3) has ambiguous row labels and its QC header says µg/mL while the methods say ng/mL, so precision and accuracy are not stored."),
    gradient_steps=grad([(0, 8), (0.6, 8), (0.61, 50), (1.5, 70), (1.6, 98), (2.5, 98), (2.51, 8), (3.0, 8)], 0.6), mrm_transitions=wang_tr,
)

# ── 2. Gniazdowska et al., Pharmaceuticals 2020 — 21 antidepressants, CPE ───
FLX, SER, VEN = "Fluoxetine-d5", "Sertraline-d3", "Venlafaxine-d6"
# name, Q1, Q3, DP, CE, CXP, IS, recovery, [(intra CV, between CV, intra acc, between acc) at 10, 16, 375, 625 ng/mL]
GNI = [
 ("Amitriptyline", 278, 233, 91, 25, 20, FLX, 85.4, [(1.5,8.2,92,104),(5.5,6.4,107,103),(5.9,2.3,86,88),(5.4,1.5,98,99)]),
 ("Citalopram", 325, 109, 86, 39, 8, VEN, 85.8, [(6.1,2.6,93,93),(4.8,3.4,90,90),(7.7,5.3,89,86),(6.1,10,109,99)]),
 ("Clomipramine", 315, 86, 81, 29, 6, SER, 90.1, [(6.7,9,88,100),(3.7,5.4,98,98),(10,3.3,104,101),(9.1,3,105,108)]),
 ("Desipramine", 267, 72, 81, 31, 12, FLX, 87.7, [(5.1,14,106,102),(5.6,6.9,101,99),(11,3,92,89),(5.6,4.1,95,99)]),
 ("Doxepin", 280, 107, 71, 33, 6, FLX, 89.4, [(3.4,6.2,104,110),(6.8,3,99,96),(7.6,2.5,110,103),(8.4,5,113,109)]),
 ("Fluoxetine", 310, 44, 56, 37, 6, FLX, 94.0, [(6.7,0.8,108,109),(5.4,0.6,109,108),(8.1,0.3,91,91),(0.8,0.4,97,98)]),
 ("Fluvoxamine", 319, 71, 71, 33, 4, FLX, 94.1, [(5.9,11,108,85),(9.6,4.3,102,95),(7.8,1.3,108,100),(5.6,9,109,112)]),
 ("Imipramine", 281, 86, 76, 25, 6, FLX, 95.4, [(4.3,9.3,94,89),(3.3,13,99,92),(7.7,4.3,85,89),(6.7,0.3,104,112)]),
 ("Maprotiline", 278, 250, 86, 27, 16, FLX, 85.0, [(2.7,7.9,96,97),(6.1,5.2,89,88),(12,1.2,92,93),(7.1,0.7,104,105)]),
 ("Mianserin", 265, 208, 96, 31, 12, SER, 87.0, [(3.8,2.9,113,112),(3.9,3.5,101,96),(8.8,14,114,97),(11,11,93,105)]),
 ("Mirtazapine", 266, 195, 46, 37, 10, FLX, 78.9, [(6.2,12,97,102),(13,6.2,101,104),(11,2.8,95,93),(5,7.2,100,107)]),
 ("Moclobemide", 269, 182, 76, 27, 10, SER, 65.4, [(2.4,11,102,110),(4.3,7.9,85,89),(11,4.4,90,86),(11,1.6,98,96)]),
 ("Nortriptyline", 264, 233, 71, 23, 14, SER, 81.3, [(8.7,9.6,93,95),(6.9,14,102,99),(8.1,6.7,102,109),(4.1,0.2,110,110)]),
 ("Opipramol", 364, 171, 91, 31, 14, FLX, 102.5, [(5.6,10,93,101),(5.2,3.6,90,87),(3.2,3.5,92,89),(9.2,4.7,105,110)]),
 ("Paroxetine", 330, 192, 51, 31, 14, FLX, 82.8, [(7.5,4.5,105,106),(7.4,2.9,101,102),(12,0.8,100,99),(11,6.7,91,97)]),
 ("Protriptyline", 264, 191, 96, 41, 14, FLX, 83.3, [(3.7,9.5,94,104),(4.8,8.5,97,95),(11,2.1,90,88),(7.3,6.8,94,100)]),
 ("Sertraline", 306, 159, 51, 35, 12, SER, 87.5, [(4.4,6.1,109,109),(2,2.5,104,101),(3.2,7,107,100),(5.3,1.5,105,107)]),
 ("Tianeptine", 437, 292, 61, 25, 8, VEN, 69.4, [(2,3.2,103,106),(3.2,2.9,93,97),(11,1.8,93,95),(9,5.8,111,105)]),
 ("Trazodone", 372, 176, 81, 37, 10, VEN, 82.0, [(2.4,9,111,103),(4.1,3.3,88,92),(6.1,1.6,89,91),(5.6,2.7,105,102)]),
 ("Trimipramine", 295, 100, 71, 25, 6, FLX, 102.3, [(6.1,11,85,100),(3.7,3.7,98,101),(6,0.2,88,87),(5.3,1.9,100,102)]),
 ("Venlafaxine", 278, 58, 56, 47, 10, VEN, 80.0, [(5.3,3.4,106,102),(2.4,3,100,104),(9.7,6,92,87),(3.3,4.8,103,98)]),
]
gni_tr = ([tr(n, q1, q3, ce, None, 1, 0, istd, declustering_potential=dp, cell_exit_potential=cxp) for n, q1, q3, dp, ce, cxp, istd, _r, _l in GNI]
          + [tr(FLX, 315, 44, 41, None, 1, 1, None, declustering_potential=71, cell_exit_potential=6),
             tr(SER, 309, 275, 17, None, 1, 1, None, declustering_potential=56, cell_exit_potential=16),
             tr(VEN, 284, 64, 49, None, 1, 1, None, declustering_potential=66, cell_exit_potential=10)])
gni_val = [from_levels(n, None, 10, None, lv, extra=f"Intra-run (n = 5) and between-run (n = 15) at 10, 16, 375 and 625 ng/mL. Extraction recovery {rec}%.")
           for n, *_x, rec, lv in GNI]
M_GNI = dict(
    title="Determination of Antidepressants in Human Plasma by Modified Cloud-Point Extraction Coupled with Mass Spectrometry",
    analyte=", ".join(r[0] for r in GNI), matrix="plasma", clinical_application="Antidepressants", ionization_mode="ESI+",
    instrument_manufacturer="Sciex", instrument_model="4000 QTRAP",
    column_brand="Phenomenex", column_name="Kinetex C18", column_stationary_phase="C18",
    column_length_mm=100, column_diameter_mm=4.6, column_particle_size_um=5,
    mobile_phase_a="Water with 0.1% (v/v) formic acid", mobile_phase_b="Methanol with 0.1% (v/v) formic acid", injection_volume_ul=10,
    ion_spray_voltage=5000, source_temperature_c=600, collision_gas="high",
    sample_prep_method="Cloud-point extraction (CPE)",
    sample_prep_details=("1. 250 µL plasma + 50 µL aqueous internal standard solution (500 ng/mL); vortex 30 s.\n"
                         "2. Add 300 µL 20% Triton X-114, 400 µL 25% ammonia solution and 100 mg ammonium acetate (final 10% w/v).\n"
                         "3. Vortex at low speed 5 min; incubate 20 min at 60 °C.\n"
                         "4. Centrifuge at 10,000 g for 5 min at 25 °C; discard the surfactant-lean phase.\n"
                         "5. Add 500 µL ethanol to the surfactant-rich phase; 5 min at −80 °C.\n"
                         "6. Centrifuge at 10,000 g for 5 min at 25 °C.\n7. Dilute 200 µL supernatant with 700 µL water; inject 10 µL."),
    lloq=10, uloq=750, validation_units="ng/mL",
    reference="Gniazdowska E, Korytowska N, Kłudka G, Giebułtowicz J. Pharmaceuticals (Basel). 2020;13(12):458. doi:10.3390/ph13120458",
    source_type="Journal article", source_authors="Gniazdowska E, Korytowska N, Kłudka G, Giebułtowicz J",
    source_url="https://doi.org/10.3390/ph13120458", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access, CC BY. LC: Agilent 1260 Infinity. Flow 0.75 mL/min; total run 11 min including 2 min re-equilibration. "
           "Turbo Ion Spray, positive mode; curtain gas 345 kPa, ion source gas 1 207 kPa, ion source gas 2 276 kPa. "
           "Linear 10–750 ng/mL for all 21 antidepressants (r² > 0.990). Internal standards: fluoxetine-d5, sertraline-d3 and venlafaxine-d6, "
           "assigned to the analytes as the article lists them.\n\n"
           "To check when reviewing: m/z values are printed as whole numbers; one transition per compound; "
           "retention times and column temperature are not given; per-compound r² is in the article but not stored here."),
    gradient_steps=grad([(0, 20), (1, 20), (3, 95), (9, 95)], 0.75), mrm_transitions=gni_tr,
)

# ── 3. Kamal et al., Molecules 2025 — five benzodiazepines in urine ─────────
CLZ = "Clonazepam-d4"
# name, Q1, (Q3, CE), (Q3, CE), RT, r2, [(intra RSD, % recovery) at 2, 6, 100, 200 ng/mL], intermediate precision at 100
KAM = [
 ("Bromazepam", 317.95, (209.05, -28.0), (182.05, -33.0), 6.17, 0.9985, [(3.372,118.188),(3.338,100.870),(1.322,112.253),(3.425,107.795)], 1.85),
 ("Clonazepam", 316.05, (270.10, -25.0), (214.00, -37.0), 7.558, 0.9990, [(6.676,111.044),(5.252,104.750),(1.422,94.961),(1.363,93.734)], 3.05),
 ("Alprazolam", 309.10, (281.15, -26.0), (205.15, -45.0), 7.818, 0.9987, [(4.193,98.156),(3.545,96.520),(1.387,105.240),(2.400,103.905)], 2.38),
 ("Flunitrazepam", 314.10, (268.10, -25.0), (239.15, -36.0), 8.120, 0.999, [(9.459,100.249),(6.529,107.440),(6.825,82.356),(0.821,86.120)], 2.43),
 ("Diazepam", 285.10, (193.15, -30.0), (154.10, -27.0), 9.247, 0.9997, [(7.562,104.655),(6.277,98.591),(2.305,105.282),(2.149,105.407)], 1.21),
]
kam_tr = []
for n, q1, a, b, rt, *_ in KAM:
    kam_tr += [tr(n, q1, a[0], a[1], rt, 1, 0, CLZ), tr(n, q1, b[0], b[1], rt, 0, 0, CLZ)]
kam_tr += [tr(CLZ, 320.25, 274.20, -26.0, 7.520, 1, 1), tr(CLZ, 320.25, 218.10, -39.0, 7.520, 0, 1)]
kam_val = [from_levels(n, 2.0, 6.0, r2, [(cv, None, acc, None) for cv, acc in lv],
                       extra=f"Within-run %RSD and mean % recovery at 2, 6, 100 and 200 ng/mL (n = 3). Intermediate precision at 100 ng/mL: {ip}% RSD.")
           for n, _q1, _a, _b, _rt, r2, lv, ip in KAM]
M_KAM = dict(
    title="Development and Validation of an LC-MS/MS Method for the Simultaneous Determination of Alprazolam, Bromazepam, Clonazepam, Diazepam and Flunitrazpam in Human Urine and Its Application to Samples from Suspected Drug Abusers",
    analyte=", ".join(r[0] for r in KAM), matrix="urine", clinical_application="Benzodiazepines", ionization_mode="ESI+",
    instrument_manufacturer="Shimadzu", instrument_model="LCMS-8050",
    column_brand="ACE", column_name="ACE C18", column_stationary_phase="C18",
    column_length_mm=150, column_diameter_mm=4.6, column_particle_size_um=3, column_temperature_c=50,
    mobile_phase_a="0.1% (v/v) formic acid in 5% acetonitrile", mobile_phase_b="0.1% (v/v) formic acid in 95% acetonitrile",
    injection_volume_ul=1, autosampler_temperature_c=4, interface_temperature=300,
    sample_prep_method="Dilute and Shoot",
    sample_prep_details=("1. 100 µL urine + 25 µL clonazepam-d4 (4 µg/mL) + 100 µL sodium bicarbonate pH 9.5.\n"
                         "2. Add methanol to a total volume of 1 mL.\n3. Vortex 30 s; mechanical shaker 10 min; centrifuge 15 min.\n"
                         "4. Filter the supernatant (0.22 µm PTFE) into an HPLC vial.\n5. Inject 1 µL."),
    lloq=6, uloq=300, validation_units="ng/mL",
    reference="Kamal H, Gandhi V, Akil L, Al-Tannak NF, Rattray NJW, Khadra I. Molecules. 2025;30(17):3451. doi:10.3390/molecules30173451",
    source_type="Journal article", source_authors="Kamal H, Gandhi V, Akil L, Al-Tannak NF, Rattray NJW, Khadra I",
    source_url="https://doi.org/10.3390/molecules30173451", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access (MDPI). LC: Shimadzu Nexera-i LC-2040C. Flow 0.6 mL/min, run time 15 min. "
           "Source settings as printed: interface temperature 300 °C, desolvation temperature 526 °C, heating and drying gas flow 10 L/min. "
           "LOD 2.0 ng/mL, LOQ 6.0 ng/mL and linear range 2.0–300.0 ng/mL for all five analytes. Collision energies are stored with the printed sign.\n\n"
           "To check when reviewing: the article does not say which product ion is the quantifier — stored in the printed order; "
           "it calls the preparation liquid-liquid extraction although the steps are a dilution in methanol; "
           "the centrifuge speed is printed as “130 × 100 RPM”; validation QCs were prepared in a synthetic urine diluent (Sigmatrix); "
           "the column is described as “C18 ACE column from Merck”; the license statement was not in the text read, so confirm it on the article page."),
    gradient_steps=grad([(0.01, 30), (1, 30), (10, 100), (12, 100), (12.1, 30), (15, 30)], 0.6), mrm_transitions=kam_tr,
)

# ── 4. Dimitrova et al., Forensic Sci 2024 — 39 drugs of abuse in CSF ───────
# name, Q1, Q3 quant, Q3 qual, CE quant, CE qual, RT, LOD, LOQ, R2, MRE QC1-3, CV QC1-3, ME, RR
DIM = [
 ("7-Aminoclonazepam", 286, 222, 121, 25, 30, 7.1, 2, 5, 0.9877, (13,2,-18), (18,8,7.5), -15, 87),
 ("7-Aminoflunitrazepam", 284, 227, 135, 25, 28, 8.5, 0.03, 0.05, 0.9900, (3,2,1), (3.7,5,1.3), -20, 71),
 ("7-Aminonitrazepam", 252, 208, 121, 35, 29, 3.9, 0.1, 0.5, 0.9899, (-1,5,3), (2,8,5), -25, 61),
 ("Alprazolam", 309, 281, 205, 40, 25, 12.2, 0.01, 0.5, 0.9989, (-4,2,-4), (5.2,7,5.2), -18, 71),
 ("Bromazepam", 316, 209, 182, 25, 33, 10.6, 1, 5, 0.9919, (-1,7,4), (1.7,8,5.3), -25, 62),
 ("Brotizolam", 393, 314, 279, 21, 29, 11.6, 0.03, 0.1, 0.9875, (13,10,1), (18,16,1), -15, 65),
 ("Clonazepam", 316, 270, 214, 25, 40, 11.4, 1, 5, 0.9989, (-41,-10,-25), (59,18,6), -33, 65),
 ("Chlordiazepoxide", 300, 283, 282, 9, 21, 9.5, 0.3, 0.5, 0.9904, (2,9,1), (3.2,7,1.1), -30, 68),
 ("Delorazepam", 305, 165, 162, 29, 33, 11.7, 0.01, 0.05, 0.9940, (3,1,1), (5,1.7,0.4), -18, 75),
 ("Diazepam", 285, 193, 154, 33, 25, 11.8, 0.03, 0.05, 0.9999, (-12,5,1), (16,16,2), -9, 83),
 ("Flunitrazepam", 314, 268, 239, 25, 37, 11.6, 0.01, 0.05, 0.9911, (-4,-7,1), (1,6,0.4), -32, 66),
 ("Flurazepam", 388, 317, 315, 17, 25, 10.7, 0.01, 0.05, 0.9871, (23,-7,15), (10,12,1.8), -31, 59),
 ("Lorazepam", 321, 303, 275, 13, 17, 11.4, 0.1, 0.5, 0.9999, (2,7,1), (19,20,0.4), -33, 64),
 ("Lormetazepam", 335, 317, 289, 9, 17, 11.8, 0.2, 0.5, 0.9979, (20,9,19), (14,6.8,1.8), -37, 67),
 ("Midazolam", 326, 291, 223, 25, 40, 10.4, 0.1, 0.5, 0.9940, (2,4,1), (3.3,5.6,0.2), -25, 74),
 ("Nordiazepam", 271, 165, 155, 29, 29, 1.6, 0.01, 0.05, 0.9990, (2,1,1), (6,4.8,2.6), 3, 81),
 ("Oxazepam", 287, 269, 241, 9, 21, 11.3, 0.1, 0.5, 0.9999, (2,-1,1), (9,2,4), -33, 66),
 ("Pinazepam", 309, 269, 241, 29, 33, 12.2, 0.01, 0.05, 0.9932, (2,5,1), (5,1,5), -10, 78),
 ("Prazepam", 325, 271, 140, 21, 40, 12.4, 0.1, 0.5, 0.9964, (2,9,1), (9,1,5), -20, 92),
 ("Temazepam", 301, 283, 255, 9, 21, 11.6, 0.05, 0.1, 0.9914, (2,2,1), (17,9,6.3), -18, 79),
 ("Triazolam", 343, 315, 308, 29, 25, 11.5, 0.01, 0.05, 0.9899, (2,2,1), (11.8,3,0.2), -32, 59),
 ("α-Hydroxyalprazolam", 325, 297, 216, 30, 35, 12.4, 0.05, 0.5, 0.9954, (-4,7,4), (16.4,9,15), -20, 83),
 ("α-Hydroxyflunitrazepam", 330, 311, 284, 35, 30, 11.8, 0.1, 0.5, 0.9989, (-5,-3,4), (6.3,10,5), -15, 70),
 ("α-Hydroxymidazolam", 342, 203, 168, 35, 45, 10.6, 0.02, 0.05, 0.9910, (2,5,1), (4.8,3,0.8), -20, 69),
 ("6-MAM", 328, 211, 165, 25, 40, 5.1, 0.01, 0.05, 0.9901, (10,6,-20), (13,12,5.5), -12, 88),
 ("Codeine", 300, 165, 58, 40, 33, 3.7, 0.1, 0.05, 0.9964, (12,10,-18), (15,12,10), 16, 70),
 ("DXM", 272, 171, 147, 42, 30, 10.2, 0.02, 0.05, 0.9967, (-13,-1,4), (18,4,4), -4, 76),
 ("Methadone", 310, 265, 105, 13, 29, 11.2, 0.03, 0.05, 0.9899, (2,2,1), (41,12,0.2), -35, 55),
 ("Morphine", 286, 165, 155, 40, 37, 1.6, 0.1, 0.5, 0.9995, (-8,-3,-2), (16,2.7,10), 20, 70),
 ("Oxycodone", 316, 298, 256, 17, 25, 4.5, 0.1, 0.5, 0.9899, (6,1,5), (20,10,17), 5, 84),
 ("Tramadol", 264, 246, 58, 25, 30, 7.7, 0.01, 0.05, 0.9917, (-13,10,14), (4,8,9), 7, 75),
 ("MDA", 180, 163, 105, 9, 25, 4.1, 0.01, 0.05, 0.9981, (2,12,15), (8,5,2), 10, 81),
 ("MDMA", 194, 163, 105, 9, 25, 4.6, 0.01, 0.05, 0.9999, (10,3,6), (2,4,3), -8, 75),
 ("Methamphetamine", 150, 119, 91, 21, 9, 5.1, 0.01, 0.05, 0.9990, (2,5,8), (10,5,1), 14, 80),
 ("MDPV", 276, 135, 126, 25, 25, 8.2, 0.01, 0.05, 0.9956, (2,2,11), (0.5,3,0.9), -15, 80),
 ("Ketamine", 238, 179, 125, 13, 29, 6.5, 0.01, 0.05, 0.9967, (-5,5,2), (1,1,3), -2, 83),
 ("Norketamine", 224, 207, 125, 9, 25, 6.2, 0.05, 0.5, 0.9998, (2,-4,1), (3,1,0.1), 11, 78),
 ("Cocaine", 304, 182, 82, 17, 33, 8.3, 0.01, 0.05, 0.9859, (5,1,0), (7,10,0.3), -6, 72),
 ("Benzoylecgonine", 290, 168, 105, 17, 29, 6.8, 0.01, 0.05, 0.9991, (9,1,-1), (13.3,10,1.5), -8.5, 75),
]
dim_tr = []
for n, q1, a, b, cea, ceb, rt, *_ in DIM:
    dim_tr += [tr(n, q1, a, cea, rt, 1, 0, None), tr(n, q1, b, ceb, rt, 0, 0, None)]
dim_val = []
for n, _q1, _a, _b, _ca, _cb, _rt, lod, loq, r2, mre, cv, me, rr in DIM:
    acc = [100 + x for x in mre]
    dim_val.append(dict(compound_name=n, lod=lod, loq=loq, r2=r2, cv_percent=max(cv), accuracy_percent=worst_acc(acc),
                        notes=f"Worst case over QC1–QC3. CV {rng(list(cv))}%. Accuracy {rng(acc, 0)}% of nominal (from %MRE). "
                              f"Matrix effect {me}%. Recovery {rr}%."))
M_DIM = dict(
    title="Exploring Cerebrospinal Fluid: Validation of a New Method for Quantification of 39 Drugs of Abuse by LC-MS/MS",
    analyte=", ".join(r[0] for r in DIM), matrix="csf", clinical_application="Forensic Toxicology", ionization_mode="ESI+",
    instrument_manufacturer="Agilent", instrument_model="6460",
    column_brand="Agilent", column_name="ZORBAX Eclipse Plus C18", column_stationary_phase="C18",
    column_length_mm=50, column_diameter_mm=2.1, column_particle_size_um=1.8,
    mobile_phase_a="5 mM aqueous formic acid", mobile_phase_b="Acetonitrile", injection_volume_ul=5,
    capillary_voltage_v=4000, gas_temperature=325, gas_flow_lmin=10, nebulizer_pressure_psi=20,
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("1. 200 µL CSF + 600 µL cold acetonitrile (0 °C) + 30 µL internal standard (halazepam, 0.05 ng/µL).\n"
                         "2. Vortex; centrifuge at 2500 × g for 5 min.\n3. Dry the liquid phase under nitrogen at 40 °C.\n"
                         "4. Reconstitute in 100 µL water.\n5. Inject 5 µL."),
    validation_units="ng/mL",
    reference="Dimitrova A, Croce EB, Iaquinta G, Ferri E, Faccioli S, Chiavacci G, Gualco B, Focardi M, Grassi S, Vaiano F. Forensic Sci. 2024;4(4):546-554. doi:10.3390/forensicsci4040036",
    source_type="Journal article",
    source_authors="Dimitrova A, Croce EB, Iaquinta G, Ferri E, Faccioli S, Chiavacci G, Gualco B, Focardi M, Grassi S, Vaiano F",
    source_url="https://doi.org/10.3390/forensicsci4040036", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access, CC BY. Post-mortem cerebrospinal fluid collected by ventricular puncture (forensic use). "
           "LC: Agilent 1290 Infinity. Flow 0.4 mL/min. Dynamic MRM, two transitions per compound; the first one is the quantifier (bold in the article's Table 1). "
           "QC levels: QC1 0.15, 0.3, 1.5 or 15 ng/mL depending on the compound, QC2 30 ng/mL, QC3 75 ng/mL; calibration from the LOQ to 100 ng/mL. "
           "Internal standard: halazepam.\n\n"
           "To check when reviewing: the gradient sentence ends “from 12–13 min, ramp to 100%B and isocratic hold to 12.5 min”, which is inconsistent — stored up to 13 min; "
           "the initial mobile phase is given as A:B 99:1 while the gradient starts at 0% B; "
           "the internal standard's transition is not in the article, so no internal standard row is stored; column temperature is not given; "
           "nordiazepam is printed with a retention time of 1.6 min; codeine is printed with LOD 0.1 and LOQ 0.05 ng/mL; "
           "clonazepam shows 59% CV and −41% error at QC1."),
    gradient_steps=grad([(0, 0), (6, 10), (10, 25), (12, 70), (13, 100)], 0.4), mrm_transitions=dim_tr,
)

BATCH = [(M_WANG, wang_val), (M_GNI, gni_val), (M_KAM, kam_val), (M_DIM, dim_val)]

if __name__ == "__main__":
    db = SessionLocal()
    client = TestClient(app)
    for payload, val in BATCH:
        if db.query(Method).filter(Method.source_url == payload["source_url"]).first():
            print("already imported:", payload["source_url"]); continue
        analytes = {t["compound_name"] for t in payload["mrm_transitions"] if not t["is_internal_standard"]}
        if {v["compound_name"] for v in val} != analytes or len(val) != len(analytes):
            print("NAME MISMATCH, skipped:", payload["title"][:40]); continue
        r = client.post("/api/methods/", json=payload)
        if r.status_code != 200:
            print("FAILED", r.status_code, r.text[:300]); sys.exit(1)
        m = r.json()
        for v in val:
            db.add(CompoundValidation(method_id=m["id"], matrix=payload["matrix"], **v))
        db.commit()
        print(f"queued id={m['id']} status={m['status']} transitions={len(m['mrm_transitions'])} gradient={len(m['gradient_steps'])} validation={len(val)} | {m['title'][:46]}")
