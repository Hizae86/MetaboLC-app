"""Batch 3 (2026-11-16): four open-access (CC BY) methods with their
per-analyte validation data, sent to the review queue as "submitted".
Values are as printed in the articles (two independent readings agreed).
Validation rows store the WORST CASE across QC levels (highest CV, accuracy
furthest from 100%); the full range is in each row's note. Bias (RE %) is
converted to % of nominal as 100 + bias.
Run once from the project root:  python -m backend.scripts.import_open_access_batch3
"""
import sys
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import Method, CompoundValidation
from backend.scripts.import_open_access_batch2 import tr, grad, SUBMITTER, NOTE
from backend.scripts.import_validation_batch import from_levels, rng

# ── 1. Greibe et al., Pharmaceuticals 2026 — six TKIs + two metabolites ─────
# name, Q1, Q3, fragmentor, CE, assigned IS
GRE = [("Cabozantinib", 502.0, 391.0, 220, 40, None), ("Pazopanib", 438.0, 357.0, 200, 35, "Pazopanib-d3"),
       ("Sorafenib", 465.1, 252.0, 180, 42, "Sorafenib-d3"), ("Sorafenib N-oxide", 481.0, 286.0, 180, 30, None),
       ("Axitinib", 387.0, 356.0, 120, 20, "Axitinib-d3"), ("Tivozanib", 455.0, 341.0, 140, 58, None),
       ("Sunitinib", 399.0, 326.0, 130, 23, "Sunitinib-d4"), ("Desethyl-sunitinib", 371.0, 283.0, 100, 30, None)]
GRE_IS = [("Pazopanib-d3", 441.0, 360.0, 200, 35), ("Sorafenib-d3", 468.1, 211.1, 180, 42),
          ("Axitinib-d3", 390.0, 356.1, 120, 20), ("Sunitinib-d4", 403.0, 330.0, 130, 23)]
gre_tr = ([tr(n, q1, q3, ce, None, 1, 0, istd, declustering_potential=fr, cell_accelerator_voltage=4) for n, q1, q3, fr, ce, istd in GRE]
          + [tr(n, q1, q3, ce, None, 1, 1, None, declustering_potential=fr, cell_accelerator_voltage=4) for n, q1, q3, fr, ce in GRE_IS])
# name: (LLOQ, r2, [(inter CV, RE) at LLOQ, low, middle, high])
GRE_VAL = {
 "Pazopanib": (300, 0.9996, [(5.8,-0.9),(3.9,3.9),(2.9,7.5),(14.5,6.6)]),
 "Cabozantinib": (100, 0.9997, [(14.2,12.6),(4.9,5.9),(4.9,5.3),(10.1,0.8)]),
 "Sorafenib": (75, 0.9997, [(14.1,-4.2),(4.7,6.8),(2.8,4.8),(7.6,-2.1)]),
 "Sorafenib N-oxide": (100, 0.9992, [(30.5,-2.2),(16.2,6.9),(16.4,-0.3),(14.9,1.1)]),
 "Axitinib": (5, 0.9999, [(10.2,13.5),(3.2,3.7),(3.4,-0.3),(10.9,7.4)]),
 "Tivozanib": (5, 0.9997, [(13.0,15.4),(5.2,4.5),(4.8,-0.5),(13.6,7.7)]),
 "Sunitinib": (5, 0.9998, [(10.2,5.2),(3.9,1.4),(3.0,-3.0),(9.8,4.9)]),
 "Desethyl-sunitinib": (5, 0.9996, [(7.8,7.5),(4.5,2.6),(2.7,-1.7),(9.5,8.4)]),
}
gre_val = [from_levels(n, None, loq, r2, [(None, cv, None, re) for cv, re in lv], bias=True,
                       extra="Inter-assay values (LLOQ, low, middle, high QC); intra-assay, recovery and matrix effect are not reported.")
           for n, (loq, r2, lv) in GRE_VAL.items()]
M_GRE = dict(
    title="Development and Validation of an LC–MS/MS Method for Simultaneous Quantification of Pazopanib, Cabozantinib, Sorafenib, Axitinib, Tivozanib, Sunitinib, and the Metabolites Sorafenib N-Oxide and Desethyl-Sunitinib in Human Plasma",
    analyte=", ".join(r[0] for r in GRE), matrix="plasma", clinical_application="Therapeutic Drug Monitoring", ionization_mode="ESI+",
    instrument_manufacturer="Agilent", instrument_model="6470",
    column_brand="Phenomenex", column_name="Kinetex EVO C18", column_stationary_phase="C18",
    column_length_mm=150, column_diameter_mm=2.1, column_particle_size_um=2.6, column_temperature_c=35,
    mobile_phase_a="10 mM ammonium acetate with 0.1% formic acid", mobile_phase_b="Acetonitrile", injection_volume_ul=3,
    capillary_voltage_v=3500, gas_temperature=260, gas_flow_lmin=13, nebulizer_pressure_psi=60,
    sheath_gas_heater_c=400, sheath_gas_flow_lmin=12, nozzle_voltage_v=0,
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("1. 50 µL EDTA plasma + 150 µL acetonitrile; vortex, stand 5 min, centrifuge at 10,000 × g for 10 min.\n"
                         "2. Dilute 150 µL supernatant with 150 µL methanol–water (1:1, v/v).\n"
                         "3a. Pazopanib, cabozantinib, sorafenib, sorafenib N-oxide: dilute 10 µL of step 2 with 490 µL methanol–water (1:1).\n"
                         "3b. Axitinib, tivozanib, sunitinib, desethyl-sunitinib: dilute 100 µL of step 2 with 900 µL methanol–water (1:1).\n"
                         "4. Mix 100 µL with 100 µL internal standard working solution in light-protected tubes; 5 min at 70 °C in a water bath.\n"
                         "5. Inject 3 µL."),
    validation_units="ng/mL",
    reference="Greibe E, Henriksen JN, Fristrup N, Hoffmann-Lücke E. Pharmaceuticals (Basel). 2026;19(8):1180. doi:10.3390/ph19081180",
    source_type="Journal article", source_authors="Greibe E, Henriksen JN, Fristrup N, Hoffmann-Lücke E",
    source_url="https://doi.org/10.3390/ph19081180", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access, CC BY. LC: Agilent 1290 Infinity; MS: Agilent 6470A. Flow 0.4 mL/min, total run time 6 min. "
           "Fragmentor voltage is stored in the Frag (V) column; cell accelerator voltage 4 V for all compounds.\n\n"
           "Calibration ranges (ng/mL): pazopanib 300–50,000; cabozantinib 100–10,000; sorafenib 75–10,000; sorafenib N-oxide 100–1000; "
           "axitinib, tivozanib, sunitinib and desethyl-sunitinib 5–1000.\n\n"
           "To check when reviewing: retention times are not given in the article; one transition per compound; "
           "no labelled internal standard was available for cabozantinib, tivozanib and the two metabolites, and the article does not say which standard they are referred to; "
           "sorafenib N-oxide exceeded the 15% CV limit (30.5% at the LLOQ)."),
    gradient_steps=grad([(0, 10), (3.5, 90), (5, 10)], 0.4), mrm_transitions=gre_tr,
)

# ── 2. Li et al., Molecules 2022 — osimertinib, aumolertinib, furmonertinib ─
# name, RT, Q1, quant Q3, qual Q3, DP, CE
LI2 = [("Osimertinib", 1.29, 500.1, 72.2, 455.3, 140, 80), ("Aumolertinib", 1.72, 526.1, 72.2, 453.2, 140, 80),
       ("Furmonertinib", 1.80, 569.1, 72.1, 441.2, 120, 80)]
li2_tr = []
for n, rt, q1, a, b, dp, ce in LI2:
    li2_tr += [tr(n, q1, a, ce, rt, 1, 0, "Sorafenib-d3", declustering_potential=dp), tr(n, q1, b, ce, rt, 0, 0, "Sorafenib-d3", declustering_potential=dp)]
li2_tr += [tr("Sorafenib-d3", 468.2, 255.4, 45, 2.34, 1, 1, None, declustering_potential=140),
           tr("Sorafenib-d3", 468.2, 273.1, 45, 2.34, 0, 1, None, declustering_potential=140)]
# name: (LLOQ, r, [(intra CV, inter CV, intra accuracy, inter accuracy) x4])
LI2_VAL = {
 "Osimertinib": (5, 0.9995, [(5.3,1.0,96.9,95.8),(2.9,1.7,96.4,96.6),(2.9,3.9,96.6,101.1),(5.6,3.6,98.3,101.9)]),
 "Aumolertinib": (2, 0.9978, [(3.0,6.1,95.8,103.3),(4.8,5.4,105.1,103.8),(3.8,3.3,105.2,104.1),(4.7,3.6,100.4,101.6)]),
 "Furmonertinib": (0.5, 0.9994, [(5.6,5.6,104.1,102.6),(5.2,4.2,97.8,94.7),(4.0,4.0,104.2,99.9),(3.1,3.4,102.9,101.2)]),
}
li2_val = [from_levels(n, None, loq, None, lv, extra=f"Correlation coefficient r = {r} (r, not R²).") for n, (loq, r, lv) in LI2_VAL.items()]
M_LI2 = dict(
    title="Determination of Osimertinib, Aumolertinib, and Furmonertinib in Human Plasma for Therapeutic Drug Monitoring by UPLC-MS/MS",
    analyte=", ".join(r[0] for r in LI2), matrix="plasma", clinical_application="Therapeutic Drug Monitoring", ionization_mode="ESI+",
    instrument_manufacturer="Sciex", instrument_model="Triple Quad 4500",
    column_brand="Waters", column_name="XSelect HSS XP C18", column_stationary_phase="C18",
    column_length_mm=100, column_diameter_mm=2.1, column_particle_size_um=2.5, column_temperature_c=40,
    mobile_phase_a="Water", mobile_phase_b="Acetonitrile containing 0.1% formic acid", injection_volume_ul=8,
    ion_spray_voltage=5500, gas1=60, gas2=50, curtain_gas=25, source_temperature_c=500,
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("1. 100 µL plasma + 10 µL internal standard (200 ng/mL).\n2. Add 300 µL acetonitrile.\n"
                         "3. Vortex 1 min; centrifuge at 12,000 rpm for 10 min.\n4. Add 100 µL supernatant to 300 µL 50% acetonitrile; vortex.\n5. Inject 8 µL."),
    validation_units="ng/mL",
    reference="Li Y, Meng L, Ma Y, Li Y, Xing X, Guo C, Dong Z. Molecules. 2022;27(14):4474. doi:10.3390/molecules27144474",
    source_type="Journal article", source_authors="Li Y, Meng L, Ma Y, Li Y, Xing X, Guo C, Dong Z",
    source_url="https://doi.org/10.3390/molecules27144474", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access, CC BY. LC: Shimadzu LC-30A. Flow 0.5 mL/min, run time 4.1 min. "
           "Linear ranges (ng/mL): osimertinib 5–500, aumolertinib 2–500, furmonertinib 0.5–200. "
           "The m/z 72 product is the quantifier for all three analytes; d3-sorafenib is the single internal standard.\n\n"
           "To check when reviewing: extraction recovery and matrix effect are in Table 2 of the article and are not transcribed here."),
    gradient_steps=grad([(0, 30), (0.5, 30), (1.5, 90), (3.5, 90), (3.6, 30), (4.1, 30)], 0.5), mrm_transitions=li2_tr,
)

# ── 3. Jager et al., LabMed 2026 — ibrutinib and ritonavir in plasma ────────
jag_tr = [tr("Ibrutinib", 441.3, 304.1, 30, 0.6, 1, 0, "Ibrutinib-d5"), tr("Ritonavir", 721.2, 197, 39, 0.8, 1, 0, "Ritonavir-13C,d3"),
          tr("Ibrutinib-d5", 446.3, 309.1, 30, 0.6, 1, 1), tr("Ritonavir-13C,d3", 725.3, 201, 38, 0.8, 1, 1)]
# (within-run CV, between-run CV, bias) at LLOQ, low, medium, high
JAG_VAL = {
 "Ibrutinib": (1, [(2.5,0.6,0.5),(1.5,0.2,-2.2),(1.2,0.8,1.8),(1.9,0.0,1.0)], "Recovery 99.0–103.2%; matrix effect 1.7–5.5% (low, medium, high)."),
 "Ritonavir": (10, [(1.8,2.7,-0.5),(1.3,0.9,-2.6),(1.5,1.4,1.8),(1.7,0.0,1.4)], "Recovery 97.8–100.0%; matrix effect −1.8 to −0.9% (low, medium, high)."),
}
jag_val = [from_levels(n, None, loq, None, [(a, b, c, None) for a, b, c in lv], bias=True,
                       extra=ex + " Within-run and between-run CV. R² reported only as >0.99.")
           for n, (loq, lv, ex) in JAG_VAL.items()]
M_JAG = dict(
    title="Development of an LC-MS/MS Method for Simultaneous Quantification of Ibrutinib and Ritonavir in Plasma and Dried Plasma Spots",
    analyte="Ibrutinib, Ritonavir", matrix="plasma", clinical_application="Therapeutic Drug Monitoring", ionization_mode="ESI+",
    instrument_manufacturer="Thermo Fisher", instrument_model="TSQ Quantiva",
    column_brand="Thermo Fisher", column_name="Accucore C18", column_stationary_phase="C18",
    column_length_mm=50, column_diameter_mm=2.1, column_particle_size_um=2.6, column_temperature_c=60,
    mobile_phase_a="0.02 mol/L ammonium formate buffer, pH 3.5", mobile_phase_b="Acetonitrile",
    injection_volume_ul=5, autosampler_temperature_c=10,
    capillary_voltage_v=1500, ion_transfer_tube_temp_c=140, vaporizer_temp_c=350, aux_gas_flow=20, sweep_gas_flow=0,
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("1. 100 µL EDTA plasma + 500 µL internal standard solution (in methanol).\n2. Vortex 1 min.\n"
                         "3. Centrifuge 5 min at 9500 RCF, room temperature.\n4. Inject 5 µL."),
    validation_units="μg/L",
    reference="Jager L, Bekendam R, Nijland M, Sturkenboom MGG, Lub-de Hooge MN, Oude Munnink T. LabMed. 2026;3(3):20. doi:10.3390/labmed3030020",
    source_type="Journal article", source_authors="Jager L, Bekendam R, Nijland M, Sturkenboom MGG, Lub-de Hooge MN, Oude Munnink T",
    source_url="https://doi.org/10.3390/labmed3030020", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access, CC BY. LC: Thermo Vanquish Horizon. Flow 1.000 mL/min. H-ESI positive, spray voltage 1500 V; "
           "sheath, auxiliary and sweep gas 60, 20 and 0 arbitrary units; CID gas 1.5 mTorr; Q1 and Q3 resolution 0.7 FWHM. "
           "Ranges (µg/L): ibrutinib 1–400, ritonavir 10–1000. Internal standard working solution in methanol: "
           "[2H5]-ibrutinib 5 µg/L and [13C,2H3]-ritonavir 10 µg/L.\n\n"
           "The article also validates dried plasma spots (ritonavir met all criteria; ibrutinib was unstable at room temperature beyond 24 h). "
           "Only the plasma method is stored here.\n\n"
           "To check when reviewing: the gradient is printed as “0.000–1.150 min, 30% B; 1.150–1.450 min, 95% B; 1.500 min, 30% B” and is stored as steps; "
           "total run time is not stated; retention times are 0.6 and 0.8 min in Table 1 and 0.61 and 0.77 min in the text; one transition per compound."),
    gradient_steps=grad([(0, 30), (1.15, 95, "step"), (1.45, 95), (1.5, 30)], 1.0), mrm_transitions=jag_tr,
)

# ── 4. Gómez et al., Metabolites 2020 — 36 bile acids in serum and plasma ───
# name, Q1, Q3, polarity, CE, RT, r2, LOD, LOQ, recovery at low/medium/high (as printed)
GOM = [
 ("Cholic acid (CA)", 373.3, 355.2, "+", 8, 9.81, 0.999, 0.45, 1.36, "111 ± 4, 78 ± 6, 83 ± 6"),
 ("Chenodeoxycholic acid (CDCA)", 357.2, 104.9, "+", 50, 13.76, 0.997, 0.03, 0.09, "104 ± 7, 81 ± 5, 80 ± 6"),
 ("ω-Muricholic acid (ωMCA)", 373.3, 159.1, "+", 20, 6.29, 0.999, 0.01, 0.02, "113 ± 12, 77 ± 6, 85 ± 7"),
 ("α-Muricholic acid (αMCA)", 373.3, 355.2, "+", 15, 6.50, 0.992, 0.17, 0.52, "98 ± 11, 76 ± 5, 86 ± 10"),
 ("β-Muricholic acid (βMCA)", 391.3, 355.2, "+", 16, 6.85, 0.997, 0.10, 0.30, "94 ± 15, 75 ± 4, 83 ± 6"),
 ("γ-Muricholic acid (γMCA)", 373.3, 355, "+", 10, 8.14, 0.991, 0.29, 0.86, "87 ± 3, 79 ± 6, 85 ± 6"),
 ("Ursodeoxycholic acid (UDCA)", 357.2, 95, "+", 35, 9.92, 0.997, 0.04, 0.12, "94 ± 11, 86 ± 4, 86 ± 5"),
 ("Hyodeoxycholic acid (HDCA)", 357.2, 95.1, "+", 40, 10.34, 0.994, 0.41, 1.23, "85 ± 22, 84 ± 4, 88 ± 5"),
 ("Deoxycholic acid (DCA)", 391.3, 345, "-", 36, 14.14, 0.991, 0.11, 0.33, "135 ± 9, 80 ± 5, 84 ± 5"),
 ("Lithocholic acid (LCA)", 359.3, 135.1, "+", 24, 17.19, 0.997, 0.48, 1.46, "<LOD, 66 ± 6, 82 ± 5"),
 ("3-Oxo-lithocholic acid (3oxoLCA)", 357.3, 80.9, "+", 48, 17.43, 0.992, 0.67, 2.02, "<LOD, 82 ± 5, 85 ± 7"),
 ("7-Oxolithocholic acid (7oxoLCA)", 373.3, 355.1, "+", 35, 11.80, 0.995, 0.82, 2.49, "75 ± 15, 72 ± 4, 83 ± 6"),
 ("6,7-Dioxo-lithocholic acid (6,7dioxoLCA)", 405.3, 351.1, "+", 32, 11.71, 0.998, 0.08, 0.24, "<LOD, 1 ± 0.3, 1 ± 0.2"),
 ("12-Oxo-lithocholic acid (12oxoLCA)", 391.3, 145.1, "+", 12, 12.25, 0.998, 0.68, 2.07, "112 ± 13, 68 ± 4, 81 ± 5"),
 ("7-Oxo-deoxycholic acid (7oxoDCA)", 371.3, 353.2, "+", 8, 6.81, 0.990, 0.44, 1.34, "111 ± 15, 83 ± 7, 85 ± 8"),
 ("Allo-cholic acid (Allo-CA)", 373.3, 355.2, "+", 12, 9.44, 0.998, 0.06, 0.19, "90 ± 9, 77 ± 5, 83 ± 6"),
 ("Allo-deoxycholic acid (Allo-DCA)", 391.3, 345, "-", 36, 13.91, 0.990, 0.14, 0.41, "100 ± 12, 64 ± 6, 87 ± 6"),
 ("Allo-3β-deoxycholic acid (Allo-3βDCA)", 391.3, 345.1, "-", 40, 10.10, 0.992, 0.51, 1.53, "86 ± 7, 81 ± 5, 83 ± 6"),
 ("Allo-12β-deoxycholic acid (Allo-12βDCA)", 391.3, 345.1, "-", 36, 11.94, 0.994, 0.09, 0.28, "<LOD, 80 ± 7, 90 ± 6"),
 ("Allo-3β-lithocholic acid (Allo-3βLCA)", 359.3, 135.1, "+", 25, 15.56, 0.987, 0.75, 2.26, "<LOD, 54 ± 5, 82 ± 4"),
 ("Allo-lithocholic acid (Allo-LCA)", 359.3, 135.1, "+", 25, 17.08, 0.995, 0.45, 1.37, "<LOD, 87 ± 4, 91 ± 7"),
 ("Tauro-cholic acid (TCA)", 480.3, 461.9, "+", 8, 5.45, 0.999, 0.12, 0.38, "136 ± 15, 82 ± 5, 83 ± 5"),
 ("Tauro-chenodeoxycholic acid (TCDCA)", 464.2, 126, "+", 28, 7.91, 0.998, 0.05, 0.14, "109 ± 8, 80 ± 5, 80 ± 6"),
 ("Tauro-ω-muricholic acid (TωMCA)", 480.3, 126, "+", 24, 2.82, 0.996, 0.06, 0.17, "128 ± 21, 77 ± 5, 82 ± 5"),
 ("Tauro-α-muricholic acid (TαMCA)", 480.3, 126, "+", 24, 3.07, 0.996, 0.06, 0.17, "129 ± 15, 79 ± 6, 81 ± 5"),
 ("Tauro-β-muricholic acid (TβMCA)", 480.3, 126, "+", 24, 3.30, 0.998, 0.04, 0.11, "131 ± 16, 77 ± 4, 78 ± 6"),
 ("Tauro-ursodeoxycholic acid (TUDCA)", 464.2, 126, "+", 28, 5.20, 0.995, 0.03, 0.10, "105 ± 15, 80 ± 5, 83 ± 6"),
 ("Tauro-deoxycholic acid (TDCA)", 498.2, 124.2, "-", 45, 8.79, 0.995, 0.05, 0.14, "117 ± 3, 80 ± 8, 85 ± 3"),
 ("Tauro-7-oxolithocholic acid (T7oxoLCA)", 480.3, 126, "+", 24, 5.84, 0.996, 0.05, 0.15, "89 ± 5, 78 ± 4, 83 ± 6"),
 ("Tauro-lithocholic acid (TLCA)", 482.2, 80, "-", 56, 13.11, 0.995, 0.08, 0.25, "107 ± 5, 70 ± 5, 82 ± 5"),
 ("Glyco-cholic acid (GCA)", 464.4, 74, "-", 37, 6.63, 0.998, 0.02, 0.05, "85 ± 5, 81 ± 5, 84 ± 6"),
 ("Glyco-chenodeoxycholic acid (GCDCA)", 448.2, 74, "-", 30, 10.58, 0.994, 0.02, 0.08, "98 ± 5, 82 ± 5, 86 ± 6"),
 ("Glyco-ursodeoxycholic acid (GUDCA)", 448.2, 74, "-", 37, 6.43, 0.998, 0.02, 0.06, "99 ± 12, 80 ± 4, 85 ± 6"),
 ("Glyco-deoxycholic acid (GDCA)", 448.2, 74, "-", 30, 11.43, 0.998, 0.011, 0.033, "97 ± 9, 81 ± 4, 87 ± 6"),
 ("Glyco-lithocholic acid (GLCA)", 432.2, 74, "-", 41, 14.59, 0.995, 1.18, 3.58, "103 ± 13, 70 ± 4, 78 ± 5"),
 ("Glyco-7-oxo-lithocholic acid (G7oxoLCA)", 446.2, 74, "-", 37, 7.63, 0.998, 0.05, 0.16, "84 ± 12, 79 ± 5, 83 ± 6"),
]
gom_tr = [tr(n, q1, q3, ce, rt, 1, 0, None, "ESI+" if pol == "+" else "ESI-", cell_accelerator_voltage=5) for n, q1, q3, pol, ce, rt, *_ in GOM]
gom_val = [dict(compound_name=n, lod=lod, loq=loq, r2=r2, cv_percent=None, accuracy_percent=None,
                notes=f"Extraction recovery in serum/plasma at low, medium and high concentration (%, mean ± SD, n = 6): {rec}. "
                      "The table gives no per-compound precision or accuracy.")
           for n, _q1, _q3, _pol, _ce, _rt, r2, lod, loq, rec in GOM]
M_GOM = dict(
    title="Development and Validation of a Highly Sensitive LC-MS/MS Method for the Analysis of Bile Acids in Serum, Plasma, and Liver Tissue Samples",
    analyte=", ".join(r[0] for r in GOM), matrix="serum", clinical_application="Metabolic Disorders",
    ionization_mode="ESI polarity switching (+/-)",
    instrument_manufacturer="Agilent", instrument_model="6490",
    column_brand="Waters", column_name="ACQUITY UPLC BEH C18", column_stationary_phase="C18",
    column_length_mm=15, column_diameter_mm=2.1, column_particle_size_um=1.7, column_temperature_c=55,
    mobile_phase_a="Water:acetonitrile (95:5, v/v) with 0.1% formic acid",
    mobile_phase_b="Acetonitrile:water (95:5, v/v) with 0.1% formic acid", injection_volume_ul=3,
    gas_temperature=290, gas_flow_lmin=15, nebulizer_pressure_psi=20, sheath_gas_heater_c=250, sheath_gas_flow_lmin=11, nozzle_voltage_v=2000,
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("1. 25 µL plasma or serum, diluted 1:4 (v/v) with water.\n"
                         "2. Add 1 mL 2-propanol containing the deuterated internal standards.\n"
                         "3. Shake 30 min at 4 °C, 1400 rpm; centrifuge at 16,000 × g for 10 min.\n"
                         "4. Evaporate the supernatant to dryness (35 °C).\n"
                         "5. Resuspend in 100 µL methanol:water (1:1, v/v); 10 min at 4 °C, 1400 rpm; sonicate 10 min.\n6. Inject 3 µL."),
    validation_units="ng/mL",
    reference="Gómez C, Stücheli S, Kratschmar DV, Bouitbir J, Odermatt A. Metabolites. 2020;10(7):282. doi:10.3390/metabo10070282",
    source_type="Journal article", source_authors="Gómez C, Stücheli S, Kratschmar DV, Bouitbir J, Odermatt A",
    source_url="https://doi.org/10.3390/metabo10070282", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access, CC BY. LC: Agilent 1290. Flow 0.5 mL/min; 22 min gradient plus 2 min post-run at initial conditions. "
           "Positive and negative ESI depending on the compound; capillary voltage optimised per segment from 2000 to 5000 V; cell accelerator voltage 5 V. "
           "Validated for human and mouse serum and plasma; the article also gives a liver tissue protocol (its Table 2), not stored here. "
           "Deuterated internal standards used: d4-GCDCA, d4-GCA, d4-GUDCA, d4-UDCA, d4-CA, d4-CDCA, d4-LCA, d4-DCA.\n\n"
           "To check when reviewing: the column is printed as 2.1 mm × 15 mm and stored that way; "
           "Table 1 lists only the quantifier transition per bile acid (the text says qualifiers were also acquired); "
           "the internal standards' transitions and which standard goes with which bile acid are not given, so no internal standard rows are stored; "
           "6,7-dioxo-lithocholic acid shows about 1% recovery."),
    gradient_steps=grad([(0, 25), (3.1, 35), (9, 38), (15, 65), (18, 65), (20, 100), (22, 25)], 0.5), mrm_transitions=gom_tr,
)

BATCH = [(M_GRE, gre_val), (M_LI2, li2_val), (M_JAG, jag_val), (M_GOM, gom_val)]

if __name__ == "__main__":
    db = SessionLocal()
    client = TestClient(app)
    for payload, val in BATCH:
        if db.query(Method).filter(Method.source_url == payload["source_url"]).first():
            print("already imported:", payload["source_url"]); continue
        analytes = {t["compound_name"] for t in payload["mrm_transitions"] if not t["is_internal_standard"]}
        if {v["compound_name"] for v in val} != analytes:
            print("NAME MISMATCH, skipped:", payload["title"][:40]); continue
        r = client.post("/api/methods/", json=payload)
        if r.status_code != 200:
            print("FAILED", r.status_code, r.text[:300]); sys.exit(1)
        m = r.json()
        for v in val:
            db.add(CompoundValidation(method_id=m["id"], matrix=payload["matrix"], **v))
        db.commit()
        print(f"queued id={m['id']} status={m['status']} transitions={len(m['mrm_transitions'])} gradient={len(m['gradient_steps'])} validation={len(val)} | {m['title'][:46]}")
