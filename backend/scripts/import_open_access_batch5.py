"""Batch 5 (2026-11-16): five open-access methods (corticosteroids, anti-HIV
nucleoside analogues, vitamin D in dried blood spots, vitamin D metabolites in
serum, 26 antiepileptic drugs) with per-analyte validation, sent to the review
queue as "submitted". Values are as printed in the articles (two independent
readings agreed unless a note says otherwise). Validation rows store the WORST
CASE across levels; the range is in each row's note.
Run once from the project root:  python -m backend.scripts.import_open_access_batch5
"""
import sys
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import Method, CompoundValidation
from backend.scripts.import_open_access_batch2 import tr, grad, SUBMITTER, NOTE
from backend.scripts.import_validation_batch import from_levels, rng, worst_acc

# ── 1. Ponzetto et al., Molecules 2023 — cortisol, cortisone, dexamethasone + 6 corticosteroids ──
# name, Q1, [(Q3, DP, CE, CXP) quantifier first], RT, trueness, repeatability, intermediate precision, range, LLOQ ng/mL, recovery, matrix effect
PON = [
 ("Beclomethasone", 409.3, [(391.1,41,15,16),(147.1,41,23,16)], 3.93, (94.2,106.3), (6.3,9.5), (6.1,10.1), "0.5–75", 0.5, "89.9", "93.9"),
 ("Betamethasone", 393.3, [(373.2,44,13,10),(355.2,44,16,10)], 3.43, (98.8,105.4), (5.8,8.9), (6.2,9.5), "0.5–60", 0.5, "85.4", "95.5"),
 ("Budesonide", 413.3, [(147.1,126,43,12),(173.1,126,43,12)], 5.77, (93.6,104.9), (7.1,10.3), (8.3,11.1), "0.5–60", 0.5, "79.5", "87.3"),
 ("Cortisol", 363.2, [(121.0,101,23,16),(90.9,106,83,16)], 2.53, (97.8,105.5), (5.5,8.5), (5.3,9.2), "1–500", 1.0, "83.2", "92.6"),
 ("Cortisone", 361.2, [(163.1,121,28,14),(91.0,126,85,10)], 2.61, (95.6,105.6), (4.6,8.6), (5.2,8.8), "0.1–50", 0.1, "80.4", "94.9"),
 ("Dexamethasone", 393.3, [(355.2,44,16,10),(373.2,44,13,10)], 3.55, (98.6,105.9), (6.7,9.2), (6.1,9.6), "0.5–60", 0.5, "97.8", "94.7"),
 ("Flumethasone", 411.3, [(253.2,41,21,12),(121.2,41,63,12)], 3.65, (93.2,108.4), (6.6,9.9), (7.2,10.8), "1–100", 1.0, "79.2", "106.6"),
 ("Prednisone", 359.3, [(171.3,135,46,10),(146.9,135,46,10)], 2.44, (96.6,106.3), (5.7,8.8), (6.2,9.9), "0.25–250", 0.25, "84.9", "94.7"),
 ("Triamcinolone", 395.3, [(375.2,51,13,14),(165.1,51,95,14)], 1.70, (94.8,105.0), (7.4,10.1), (7.6,10.4), "1–100", 1.0, "67.0", "96.6"),
]
PON_IS = [("Budesonide-d8", 439.4, 323.1, 81, 19, 14), ("Cortisol-d4", 367.2, 121.0, 106, 31, 12), ("Cortisone-d8", 369.2, 168.0, 126, 33, 14),
          ("Dexamethasone-d3", 396.3, 358.2, 46, 17, 10), ("Prednisone-d8", 367.3, 348.1, 66, 17, 10)]
pon_tr = ([tr(n, q1, q3, ce, rt, 1 if i == 0 else 0, 0, None, declustering_potential=dp, cell_exit_potential=cxp)
           for n, q1, prods, rt, *_ in PON for i, (q3, dp, ce, cxp) in enumerate(prods)]
          + [tr(n, q1, q3, ce, None, 1, 1, None, declustering_potential=dp, cell_exit_potential=cxp) for n, q1, q3, dp, ce, cxp in PON_IS])
pon_val = [dict(compound_name=n, lod=None, loq=loq, r2=None, cv_percent=max(rep[1], ip[1]), accuracy_percent=worst_acc(list(tru)),
                notes=(f"Worst case of the printed ranges. Trueness {tru[0]}–{tru[1]}%. Repeatability {rep[0]}–{rep[1]}%. "
                       f"Intermediate precision {ip[0]}–{ip[1]}%. Linearity {lin} ng/mL (r² > 0.99 for all compounds). "
                       f"Extraction recovery {rec}%. Matrix effect {me}%."))
           for n, _q, _p, _rt, tru, rep, ip, lin, loq, rec, me in PON]
M_PON = dict(
    title="Simultaneous Measurement of Cortisol, Cortisone, Dexamethasone and Additional Exogenous Corticosteroids by Rapid and Sensitive LC–MS/MS Analysis",
    analyte=", ".join(r[0] for r in PON), matrix="serum", clinical_application="Steroids", ionization_mode="ESI+",
    instrument_manufacturer="Sciex", instrument_model="Citrine Triple Quad",
    column_brand="Waters", column_name="ACQUITY Premier BEH C18", column_stationary_phase="C18",
    column_length_mm=100, column_diameter_mm=2.1, column_particle_size_um=1.7, column_temperature_c=30,
    mobile_phase_a="0.2 mM NH4F in water", mobile_phase_b="0.2 mM NH4F in methanol", injection_volume_ul=20,
    ion_spray_voltage=4500, source_temperature_c=550, curtain_gas=35, gas1=45, gas2=60,
    sample_prep_method="Other",
    sample_prep_details=("Supported liquid extraction (ISOLUTE SLE+ 400 µL 96-well plate, automated on a Resolvex A200).\n"
                         "1. 200 µL serum or plasma + 20 µL internal standard mix.\n2. Dilute with 200 µL deionized water; agitate 5 min at 600 rpm.\n"
                         "3. Load 400 µL of pretreated sample; 3 psi for 30 s; wait 5 min.\n4. Elute with 700 µL tert-butyl methyl ether (6 psi, 1 min).\n"
                         "5. Evaporate to dryness (about 20 min at 50 °C).\n6. Reconstitute in 100 µL methanol–water 1:1; shake 10 min at 600 rpm.\n7. Inject 20 µL."),
    validation_units="ng/mL",
    reference="Ponzetto F, Parasiliti-Caprino M, Settanni F, Nonnato A, Mengozzi G, Ghigo E, Giordano R. Molecules. 2023;28(1):248. doi:10.3390/molecules28010248",
    source_type="Journal article", source_authors="Ponzetto F, Parasiliti-Caprino M, Settanni F, Nonnato A, Mengozzi G, Ghigo E, Giordano R",
    source_url="https://doi.org/10.3390/molecules28010248", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access, CC BY. Serum and plasma; calibrators in charcoal-stripped human serum. LC: Shimadzu Nexera X2, flow 0.4 mL/min, "
           "guard cartridge ACQUITY Premier BEH C18 VanGuard FIT. Entrance potential 10 V for all transitions. Budesonide is monitored as [M − H2O + H]+. "
           "Dexamethasone and betamethasone share the same two transitions with quantifier and qualifier swapped; they are separated by retention time. "
           "LLOQ is printed in pg/mL and stored here in ng/mL.\n\n"
           "To check when reviewing: the gradient text goes from an isocratic step at 35% B straight to “an increase from 65 to 98% B in 1.5 min”; "
           "the change from 35 to 65% B is stored as a step at 4.5 min, which is an interpretation, and the return to 10% B at 8.0 min is inferred from the 10 min run time; "
           "the article does not say which internal standard is used for each analyte, so none is assigned; the text names four internal standards while the MS table lists five (prednisone-d8 too); "
           "mobile phases and source settings come from a single reading."),
    gradient_steps=grad([(0, 10), (0.5, 35), (4.5, 35), (4.5, 65, "step"), (6.0, 98), (8.0, 98), (8.01, 10, "step"), (10.0, 10)], 0.4), mrm_transitions=pon_tr,
)

# ── 2. De Nicolò et al., Pharmaceuticals 2021 — anti-HIV nucleoside analogues (PerkinElmer QSight) ──
# name, pol, Q1, [(Q3, entrance V, CE) quantifier first], RT, IS, LLOQ, ULOQ, recovery, matrix effect, [(intra, inter, acc) H, M, L]
NIC = [
 ("Tenofovir", "ESI+", 288.1, [(176.1,30,-30),(159.1,30,-45)], 2.05, "13C5-Tenofovir", 1.6, 400, "82.4", "+19.6", [(3.4,3.5,102.4),(2.4,4.4,99.2),(6.7,6.3,100.9)]),
 ("Lamivudine", "ESI+", 230.1, [(112.1,10,-42)], 2.66, "13C,2H2-Lamivudine", 9.8, 2500, "103.2", "+23.5", [(3.4,1.9,104.0),(1.0,1.5,106.1),(1.6,5.2,106.8)]),
 ("Emtricitabine", "ESI+", 248.0, [(130.1,15,-37),(113.0,15,-65)], 3.88, "2H3,15N-Emtricitabine", 9.8, 2500, "103.2", "+25.8", [(3.2,5.8,104.6),(1.5,6.9,109.6),(4.4,3.0,94.3)]),
 ("Abacavir", "ESI+", 287.2, [(191.1,24,-37)], 4.01, "2H5-Abacavir", 9.8, 2500, "91.2", "+49.8", [(2.6,3.2,104.3),(5.7,2.6,106.9),(4.1,3.7,95.8)]),
 ("Zidovudine", "ESI-", 266.1, [(223.0,-17,15),(193.0,-17,19)], 4.32, "Thymidine", 9.8, 2500, "68.7", "−9.4", [(2.8,3.5,106.5),(8.0,3.9,101.6),(7.3,4.6,100.2)]),
 ("Tenofovir alafenamide", "ESI+", 477.2, [(270.0,40,-42),(345.1,40,-33)], 4.55, "2H6-Tenofovir alafenamide", 1.6, 400, "74.0", "+17.5", [(2.9,5.2,107.6),(6.2,5.4,101.0),(9.7,6.3,98.4)]),
]
NIC_IS = [
 ("13C5-Tenofovir", "ESI+", 293.1, [(181.1,30,-30),(164.1,30,-45)], 2.05), ("13C,2H2-Lamivudine", "ESI+", 233.1, [(113.1,10,-42)], 2.62),
 ("Thymidine", "ESI-", 241.1, [(42.0,-26,74),(151.0,-26,15)], 3.66), ("2H3,15N-Emtricitabine", "ESI+", 252.0, [(132.1,15,-37),(114.0,15,-65)], 3.87),
 ("2H5-Abacavir", "ESI+", 292.2, [(196.1,24,-37)], 4.00), ("2H6-Tenofovir alafenamide", "ESI+", 483.2, [(271.0,40,-42),(346.1,40,-33)], 4.55),
]
nic_tr = ([tr(n, q1, q3, ce, rt, 1 if i == 0 else 0, 0, istd, pol, declustering_potential=ev, dwell_time_ms=25)
           for n, pol, q1, prods, rt, istd, *_ in NIC for i, (q3, ev, ce) in enumerate(prods)]
          + [tr(n, q1, q3, ce, rt, 1 if i == 0 else 0, 1, None, pol, declustering_potential=ev, dwell_time_ms=25)
             for n, pol, q1, prods, rt in NIC_IS for i, (q3, ev, ce) in enumerate(prods)])
nic_val = [from_levels(n, None, lloq, None, [(a, b, c, None) for a, b, c in lv],
                       extra=f"QC high/medium/low. ULOQ {ulo} ng/mL. Recovery {rec}%, matrix effect {me}% (lithium-heparin plasma, mean of 6 lots).")
           for n, _p, _q, _pr, _rt, _is, lloq, ulo, rec, me, lv in NIC]
M_NIC = dict(
    title="Development and Validation of an Up-to-Date Highly Sensitive UHPLC-MS/MS Method for the Simultaneous Quantification of Current Anti-HIV Nucleoside Analogues in Human Plasma",
    analyte=", ".join(r[0] for r in NIC), matrix="plasma", clinical_application="Therapeutic Drug Monitoring",
    ionization_mode="ESI polarity switching (+/-)", instrument_manufacturer="PerkinElmer", instrument_model="QSight 220",
    column_brand="Waters", column_name="ACQUITY UPLC HSS T3", column_stationary_phase="C18",
    column_length_mm=150, column_diameter_mm=2.1, column_particle_size_um=1.8, column_temperature_c=40, autosampler_temperature_c=15,
    mobile_phase_a="0.05% formic acid in water", mobile_phase_b="0.05% formic acid in acetonitrile", injection_volume_ul=4,
    capillary_voltage_pos_v=5000, capillary_voltage_neg_v=-4000, source_temperature_c=350,
    desolvation_temperature_c=300, drying_gas=130, nebulizing_gas=350, heating_gas_flow=350,  # QSight: HSID temperature stored as desolvation temperature
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("1. 100 µL plasma + 50 µL internal standard working solution + 25 µL sodium citrate solution.\n"
                         "2. Add 925 µL acetonitrile with 7% formic acid; vortex at least 10 s.\n3. Centrifuge at 21,000 × g for 10 min at 4 °C.\n"
                         "4. Transfer 1 mL supernatant to a glass vial; dry in a vacuum centrifuge at 50 °C (about 1.5 h).\n"
                         "5. Reconstitute in 0.8 mL water.\n6. Inject 4 µL.\nAn automated version on a Janus G3 workstation is also described."),
    validation_units="ng/mL",
    reference="De Nicolò A, Manca A, Ianniello A, Palermiti A, Calcagno A, Ferrara M, Antonucci M, Cusato J, Avataneo V, et al., D'Avolio A. Pharmaceuticals. 2021;14(5):460. doi:10.3390/ph14050460",
    source_type="Journal article", source_authors="De Nicolò A, Manca A, Ianniello A, Palermiti A, Calcagno A, Ferrara M, Antonucci M, Cusato J, Avataneo V, et al., D'Avolio A",
    source_url="https://doi.org/10.3390/ph14050460", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access, CC BY. LC: PerkinElmer LX50 UHPLC. Flow 0.4 mL/min, total run time 8 min. "
           "Nebulizing and heating gas: zero air; drying and collision gas: nitrogen. "
           "The QSight entrance voltage is stored in the DP field and the collision energy keeps the sign printed in the article. "
           "Zidovudine and its internal standard thymidine are measured in negative mode; zidovudine has no labelled internal standard. "
           "Lamivudine and abacavir have one transition each. Tenofovir alafenamide converts to tenofovir ex vivo (see the article's stability section).\n\n"
           "To check when reviewing: after 95% B at 5 min the article describes a 1 min wash at 0.45 mL/min and re-equilibration at 2% B until 8 min without exact times — "
           "the rows at 6.0, 6.1 and 8.0 min are an interpretation; the author list was truncated in the page I read; "
           "one table gives emtricitabine an upper limit of 2500 ng/mL while the text gives its range as 1.6–400 ng/mL (2500 is stored in the note only)."),
    gradient_steps=grad([(0, 2), (0.2, 2), (0.3, 3), (1.75, 3), (2.4, 12), (5.0, 95), (6.0, 95), (6.1, 2), (8.0, 2)], 0.4), mrm_transitions=nic_tr,
)

# ── 3. Chhonker et al., Int J Mol Sci 2023 — vitamin D2/D3 and 25-OH metabolites in DBS (PTAD) ──
D6, D3IS = "25-Hydroxyvitamin D3-d6", "Vitamin D2-d3"
# name, Q1, Q3, Q1 pre-bias, CE, Q3 pre-bias, RT, recovery text, [(intra CV, inter CV, intra bias, inter bias) LLOQ, LQC, MQC, HQC]
CHH = [
 ("25-Hydroxyvitamin D2", 570.30, 297.95, -40, -29, -22, 3.243, "Recovery 57.2% (LQC), 51.4% (HQC).", [(11.8,13.0,3.3,5.1),(7.7,7.0,2.4,1.7),(10.9,13.2,8.7,4.4),(12.6,6.0,7.2,10.2)]),
 ("25-Hydroxyvitamin D3", 558.30, 298.05, -11, -21, -18, 3.191, "Recovery 53.7% (LQC), 55.05% (HQC).", [(1.9,4.5,11.4,14.1),(4.7,6.7,5.1,4.8),(2.8,11.3,-2.5,-2.2),(9.1,7.4,11.1,6.3)]),
 ("Vitamin D2", 572.35, 298.05, -10, -21, -12, 5.549, "Recovery 48.4% (LQC), 53.4% (HQC).", [(6.2,14.4,10.7,16.4),(6.4,10.3,-1.9,-5.0),(6.8,10.7,8.7,2.3),(0.9,7.0,-3.0,-10.0)]),
 ("Vitamin D3", 560.30, 298.05, -11, -22, -13, 5.654, "Recovery: the article's table has a second row labelled vitamin D2 (57.4% LQC, 60.1% HQC) that may be vitamin D3.", [(7.7,4.7,15.0,9.5),(7.9,7.4,3.3,-3.2),(5.4,13.5,1.0,1.7),(0.4,12.1,-3.4,-11.8)]),
]
chh_tr = ([tr(n, q1, q3, ce, rt, 1, 0, None, q1_pre_bias=b1, q3_pre_bias=b3) for n, q1, q3, b1, ce, b3, rt, _r, _l in CHH]
          + [tr(D6, 564.30, 298.00, -25, 3.168, 1, 1, None, q1_pre_bias=-19, q3_pre_bias=-13),
             tr(D3IS, 575.35, 301.10, -22, 5.5, 1, 1, None, q1_pre_bias=-12, q3_pre_bias=-18)])
chh_val = [from_levels(n, None, 0.78, None, lv, bias=True, extra="Levels: LLOQ 0.78, 3.12, 25 and 150 ng/mL; bias converted to % of nominal. Range 0.78–200 ng/mL. " + rec)
           for n, _a, _b, _c, _d, _e, _f, rec, lv in CHH]
M_CHH = dict(
    title="A Simultaneous Extraction/Derivatization Strategy for Quantitation of Vitamin D in Dried Blood Spots Using LC–MS/MS: Application to Biomarker Study in Subjects Tested for SARS-CoV-2",
    analyte=", ".join(r[0] for r in CHH), matrix="dried blood spot", clinical_application="Vitamins", ionization_mode="ESI+",
    instrument_manufacturer="Shimadzu", instrument_model="LCMS-8060NX", is_derivatized=1,
    column_brand="ACE", column_name="Excel C18-PFP", column_stationary_phase="C18-PFP",
    column_length_mm=100, column_diameter_mm=2.1, column_particle_size_um=1.7,
    mobile_phase_a="0.1% formic acid in water", mobile_phase_b="0.1% formic acid in methanol", injection_volume_ul=10,
    sample_prep_method="Derivatization",
    sample_prep_details=("1. Four 3 mm punches per sample into a 96-well plate.\n2. Add 100 µL water + 10 µL internal standard mix (0.2 µg/mL); vortex 5 min at 1200 rpm; sonicate 10 min.\n"
                         "3. Add 400 µL 0.2 mM ZnSO4; vortex 5 min; sonicate 30 min.\n4. Add 400 µL ice-cold methanol; sonicate 15 min.\n"
                         "5. SPE on Oasis PRiME HLB 96-well (30 mg): condition with 200 µL methanol and 200 µL water, load, wash twice with 200 µL 60% methanol, elute twice with 300 µL methanol.\n"
                         "6. Dry under nitrogen.\n7. Derivatize with 50 µL PTAD (0.1 g/L in anhydrous ethyl acetate), 30 min at 500 rpm, room temperature; dry under nitrogen.\n"
                         "8. Reconstitute in 100 µL methanol with 0.1% formic acid, then add 25 µL 0.1% formic acid in water; centrifuge 5 min at 3000 rpm.\n9. Inject 10 µL."),
    lloq=0.78, uloq=200, validation_units="ng/mL",
    reference="Chhonker YS, Ahmed N, Johnston CM, Barnabas RV, Murry DJ. Int J Mol Sci. 2023;24(6):5489. doi:10.3390/ijms24065489",
    source_type="Journal article", source_authors="Chhonker YS, Ahmed N, Johnston CM, Barnabas RV, Murry DJ",
    source_url="https://doi.org/10.3390/ijms24065489", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access, CC BY. PTAD derivatives are monitored (the precursor m/z values are those of the derivatized analytes). "
           "Dual ion source (DUIS) in positive ESI. Flow 0.5 mL/min, run time 11 min, column at room temperature with a C18 guard column. "
           "Calibrators and QCs in charcoal-stripped artificial blood spotted on Whatman 903 cards (40 µL per spot). Matrix effect is reported as within ±15% for all analytes.\n\n"
           "To check when reviewing: the LC system and the source settings are not given; one transition per compound; "
           "the article does not say which internal standard is used for each analyte, so none is assigned; "
           "the gradient is printed as “0.1–1 min, 75% B; 1–3 min, 75–95% B; 3–6.49 min, 95% B; 7–9 min, 97% B” with re-equilibration from 9.1 to 11 min — stored from those times; "
           "the recovery table has two rows labelled vitamin D2 and none for vitamin D3."),
    gradient_steps=grad([(0.1, 75), (1, 75), (3, 95), (6.49, 95), (7, 97), (9, 97), (9.1, 75), (11, 75)], 0.5), mrm_transitions=chh_tr,
)

# ── 4. Usoltseva et al., Int J Mol Sci 2023 — vitamin D metabolites in serum, DMS, no derivatization ──
# name, [(Q3 q1, q3, CE, DP, CXP) quantifier first], RT, IS, calibration range, [(conc, inter-day precision, accuracy, IS-norm MF, recovery)]
USO = [
 ("1,25-Dihydroxyvitamin D3", [(399.3,135.1,28,89,16),(399.3,381.3,19,89,14)], 4.9, "1,25-Dihydroxyvitamin D3-d6", "10–300 pg/mL", [("30 pg/mL",7.0,87.5,"1.02","95"),("225 pg/mL",3.6,95.9,"0.90","90")]),
 ("24,25-Dihydroxyvitamin D3", [(417.3,399.3,13,66,15),(417.3,381.3,15,66,14)], 4.7, "24,25-Dihydroxyvitamin D3-d6", "0.32–9.6 ng/mL", [("0.96 ng/mL",2.2,92.8,"0.91","79"),("7.2 ng/mL",3.7,92.2,"0.99","84")]),
 ("25-Hydroxyvitamin D3", [(401.3,383.3,13,59,15),(401.3,365.4,17,59,13)], 6.1, "25-Hydroxyvitamin D3-d6", "2.5–75 ng/mL", [("7.5 ng/mL",3.5,95.4,"0.89","78"),("56.3 ng/mL",1.6,113.0,"0.89","82")]),
 ("3-epi-25-Hydroxyvitamin D3", [(401.29,383.2,14,110,9),(401.29,365.3,17,110,9)], 6.3, "3-epi-25-Hydroxyvitamin D3-d3", "0.75–22.5 ng/mL", [("2.25 ng/mL",3.7,89.6,"0.94","82"),("16.9 ng/mL",1.4,96.8,"0.90","76")]),
 ("25-Hydroxyvitamin D2", [(413.3,355.3,15,110,7),(413.3,395.3,13,110,7)], 6.3, "25-Hydroxyvitamin D3-d6", "0.48–14.4 ng/mL", [("1.4 ng/mL",6.1,95.6,"0.81","77"),("10.8 ng/mL",5.9,100.8,"0.79","81")]),
 ("Vitamin D3", [(385.4,259.3,20,100,30),(385.4,159.2,32,100,18)], 7.7, "Vitamin D3-d7", "12.5–375 ng/mL", [("37.5 ng/mL",5.5,90.2,"0.98","70"),("281 ng/mL",4.1,91.0,"1.07","72")]),
]
USO_IS = [("1,25-Dihydroxyvitamin D3-d6", 405.3, 135.0, 30, 170, 12, 4.9), ("24,25-Dihydroxyvitamin D3-d6", 423.3, 387.5, 16, 150, 7, 4.7),
          ("25-Hydroxyvitamin D3-d6", 407.4, 389.3, 12, 120, 11, 6.1), ("3-epi-25-Hydroxyvitamin D3-d3", 404.4, 368.3, 18, 150, 6, 6.3), ("Vitamin D3-d7", 392.4, 266.3, 20, 90, 30, 7.7)]
uso_tr = ([tr(n, q1, q3, ce, rt, 1 if i == 0 else 0, 0, istd, declustering_potential=dp, cell_exit_potential=cxp)
           for n, prods, rt, istd, *_ in USO for i, (q1, q3, ce, dp, cxp) in enumerate(prods)]
          + [tr(n, q1, q3, ce, rt, 1, 1, None, declustering_potential=dp, cell_exit_potential=cxp) for n, q1, q3, ce, dp, cxp, rt in USO_IS])
uso_val = [dict(compound_name=n, lod=None, loq=None, r2=None, cv_percent=max(l[1] for l in lv), accuracy_percent=worst_acc([l[2] for l in lv]),
                notes=("Worst case over 2 levels (partial validation). " + "; ".join(f"{c}: inter-day precision {p}%, accuracy {a}%, IS-normalized matrix factor {mf}, recovery {rec}%" for c, p, a, mf, rec in lv)
                       + f". Calibration range {cal}; the article does not label an LLOQ.")[:500])
           for n, _p, _rt, _is, cal, lv in USO]
M_USO = dict(
    title="Serum Vitamin D Metabolites by HPLC-MS/MS Combined with Differential Ion Mobility Spectrometry: Aspects of Sample Preparation without Derivatization",
    analyte=", ".join(r[0] for r in USO), matrix="serum", clinical_application="Vitamins", ionization_mode="ESI+",
    instrument_manufacturer="Sciex", instrument_model="QTRAP 5500 with SelexION",
    column_brand="Waters", column_name="ACQUITY UPLC HSS PFP", column_stationary_phase="PFP",
    column_length_mm=50, column_diameter_mm=2.1, column_particle_size_um=1.8, column_temperature_c=40,
    mobile_phase_a="Formic acid in water (concentration not stated in the article)", mobile_phase_b="Methanol, with up to 5% acetonitrile from a third channel",
    ion_spray_voltage=5500, source_temperature_c=650, curtain_gas=28, gas1=50, gas2=60,
    ion_mobility_device="SelexION (DMS)", im_separation_voltage_v=3800, im_compensation_voltage_v=6.8, im_offset_v=-20,
    im_temperature_c=150, im_resolution="Off", im_modifier="None",
    sample_prep_method="Liquid-Liquid Extraction (LLE)",
    sample_prep_details=("Liquid-liquid extraction followed by SPE (the article's Procedure 2).\n1. 300 µL serum + 50 µL deuterated internal standard mix; vortex; equilibrate 5 min.\n"
                         "2. Add 900 µL ethyl acetate; extract 15 min; centrifuge at 14,800 rpm for 6 min at 25 °C.\n3. Dry the organic layer in a vacuum centrifuge (40 °C).\n"
                         "4. Reconstitute in 1 mL methanol/water 4:6; centrifuge.\n5. Load on Agilent Bond Elut C18 (50 mg, 1 mL) conditioned with 0.5 mL methanol and 1 mL water.\n"
                         "6. Wash with water, then 1 mL methanol/water 3:7.\n7. Elute with 2 × 600 µL methanol; evaporate to dryness.\n"
                         "8. Reconstitute in 115 µL methanol/water 1:1; shake 10 min; centrifuge at 14,800 rpm for 10 min at 5 °C."),
    validation_units="ng/mL",
    reference="Usoltseva L, Ioutsi V, Panov Y, Antsupova M, Rozhinskaya L, Melnichenko G, Mokrysheva N. Int J Mol Sci. 2023;24(9):8111. doi:10.3390/ijms24098111",
    source_type="Journal article", source_authors="Usoltseva L, Ioutsi V, Panov Y, Antsupova M, Rozhinskaya L, Melnichenko G, Mokrysheva N",
    source_url="https://doi.org/10.3390/ijms24098111", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access, CC BY. No derivatization; a SelexION differential mobility cell separates interferences (settings in the Ion mobility block; nitrogen carrier gas). "
           "Scheduled MRM, entrance potential 10 V. LC: Agilent 1290 Infinity II, flow 0.4 mL/min. "
           "1,25-dihydroxyvitamin D3 is calibrated in pg/mL (10–300 pg/mL; detection limit 10 pg/mL); the other analytes in ng/mL. 25-Hydroxyvitamin D2 uses 25-hydroxyvitamin D3-d6 as internal standard. "
           "The authors describe the validation as partial.\n\n"
           "To check when reviewing: the article uses a three-component mobile phase (acetonitrile, methanol, formic acid in water); the gradient is stored as %B = methanol + acetonitrile, "
           "and acetonitrile is 3% at 4.4 min and 5% from 4.8 to 6.0 min; the formic acid concentration and the injection volume are not given; "
           "the validation table reports one precision value per level (inter-day), no LLOQ and no per-compound r²."),
    gradient_steps=grad([(0, 50), (1, 50), (1.5, 60), (2, 60), (3.2, 70), (4.4, 71), (4.8, 75), (5.0, 75), (6.0, 80), (6.5, 85), (8.0, 85), (8.5, 50), (12, 50)], 0.4), mrm_transitions=uso_tr,
)

# ── 5. Khromov et al., Front Neurol 2025 — 26 antiepileptic drugs, CLAM-2030 + LCMS-8060NX ──
# name, Q1, Q3, RT
KHR = [
 ("10-OH-Carbamazepine", 255.11, 141.00, 2.7), ("Carbamazepine", 237.10, 165.05, 3.1), ("Carbamazepine-diol", 271.10, 180.00, 2.6),
 ("Carbamazepine-epoxide", 253.09, 180.05, 2.7), ("Ethosuximide", 140.07, 42.00, 1.8), ("Felbamate", 239.10, 178.05, 2.3),
 ("Gabapentin", 172.13, 55.00, 1.2), ("Lacosamide", 251.14, 91.10, 2.2), ("Lamotrigine", 256.00, 58.10, 1.8), ("Levetiracetam", 171.11, 126.00, 1.7),
 ("N-Desmethylmesuximide", 188.07, 188.07, 2.6), ("Oxcarbazepine", 253.09, 180.00, 2.9), ("Phenylethylmalonamide", 207.11, 91.10, 1.7),
 ("Perampanel", 350.13, 219.05, 3.3), ("Phenobarbital", 231.08, 42.00, 2.6), ("Phenytoin", 251.08, 102.10, 3.1), ("Pregabalin", 160.13, 97.20, 1.1),
 ("Primidone", 219.11, 162.00, 2.3), ("Retigabine", 304.15, 230.05, 3.2), ("Rufinamide", 240.07, 127.00, 2.2), ("Stiripentol", 217.12, 145.15, 3.5),
 ("Sultiame", 289.03, 225.00, 1.8), ("Tiagabine", 376.14, 247.05, 3.3), ("Topiramate", 338.09, 78.00, 2.7), ("Valproate", 143.10, 143.10, 3.4),
 ("Zonisamide", 211.02, 118.00, 1.9),
]
# within-run and between-run (CV, bias) at QC1, QC2, Cal1, Cal2, Cal3 -> (within CV, between CV, within bias, between bias)
KHR_V = {
 "Valproate": ("3.5–112", 0.9963, [(2.5,4.8,5.5,2.8),(2.4,4.5,5.3,1.9),(12.6,6.7,-0.1,-4.0),(6.4,3.9,4.7,1.5),(2.5,3.1,5.0,1.1)]),
 "Carbamazepine": ("2.85–91.2", 0.9987, [(3.8,3.5,0.8,0.9),(2.3,2.2,2.1,0.0),(5.8,2.9,-12.7,10.8),(3.8,2.7,3.6,1.7),(1.7,2.5,-1.5,-1.2)]),
 "Phenytoin": ("0.9–27.5", 0.9998, [(2.8,6.1,16.6,12.9),(2.8,5.7,9.4,9.7),(5.5,9.3,-5.3,2.0),(3.4,7.9,-3.3,10.0),(2.4,5.8,1.4,1.7)]),
 "Phenobarbital": ("1.7–53.1", 0.9999, [(2.1,4.6,11.2,8.2),(3.4,3.5,5.6,6.9),(5.3,4.8,-12.6,0.5),(3.9,5.0,7.6,2.9),(1.7,2.0,2.8,-0.2)]),
 "Levetiracetam": ("2–63.1", 0.9985, [(4.7,3.8,1.7,1.1),(2.6,2.4,0.9,0.6),(3.4,2.2,-1.0,8.5),(2.5,4.3,-0.2,2.2),(6.9,4.7,-5.0,0.1)]),
}
khr_tr = [tr(n, q1, q3, None, rt, 1, 0, None, None) for n, q1, q3, rt in KHR]  # the API defaults polarity to ESI+; set to NULL in the DB after import (not stated in the article)
khr_val = []
for n, *_ in KHR:
    if n in KHR_V:
        lin, r2, lv = KHR_V[n]
        khr_val.append(from_levels(n, None, None, r2, lv, bias=True,
                                   extra=f"Two commercial QCs and three calibrator levels, within-run and between-run (5 days); bias converted to % of nominal. Linear range {lin} µg/mL; no LLOQ is labelled."))
    else:
        khr_val.append(dict(compound_name=n, lod=None, loq=None, r2=None, cv_percent=None, accuracy_percent=None,
                            notes="The article prints validation tables for five drugs only (valproate, carbamazepine, phenytoin, phenobarbital, levetiracetam); the data for the other 21 are in an external supplement that was not read."))
M_KHR = dict(
    title="Implementation and validation of a 24/7 system for the monitoring of antiepileptic drugs",
    analyte=", ".join(r[0] for r in KHR), matrix="plasma", clinical_application="Antiepileptic Drugs",
    ionization_mode="ESI polarity switching (+/-)", instrument_manufacturer="Shimadzu", instrument_model="LCMS-8060NX with CLAM-2030",
    column_brand="Shimadzu", column_stationary_phase="C18", column_length_mm=50, column_diameter_mm=2.1, column_particle_size_um=2.7, column_temperature_c=30,
    mobile_phase_a="Water with 0.2 mM ammonium formate and 0.002% formic acid", mobile_phase_b="Methanol with 0.2 mM ammonium formate and 0.002% formic acid",
    injection_volume_ul=0.5, collision_gas="Argon",
    sample_prep_method="Automated Liquid Handling & Online Filtration / Protein Precipitation",
    sample_prep_details=("Fully automated on the CLAM-2030.\n1. Wet the filter with 20 µL methanol.\n2. Add 20 µL internal standard.\n3. Add 100 µL acetonitrile (protein precipitation).\n"
                         "4. Vortex 45 s.\n5. Filter for 45 s.\n6. Inject 0.5 µL of the filtrate.\nThe sample volume is not stated in the article."),
    validation_units="µg/mL",
    reference="Khromov T, Dihazi GH, Brockmeyer P, Fischer A, Streit F. Front Neurol. 2025;16:1493201. doi:10.3389/fneur.2025.1493201",
    source_type="Journal article", source_authors="Khromov T, Dihazi GH, Brockmeyer P, Fischer A, Streit F",
    source_url="https://doi.org/10.3389/fneur.2025.1493201", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access, CC BY. Flow 0.5 mL/min, total analysis time 4.5 min. Commercial calibrators and QCs (Recipe) based on human serum; patient samples are plasma. "
           "17 isotope-labelled internal standards are used. A matrix effect above 30% is reported for carbamazepine-D10, felbamate-D4 and levetiracetam-D6.\n\n"
           "To check when reviewing: the transition table gives only precursor, product and retention time — no collision energies, no polarity per compound "
           "(the instrument runs in both modes; the polarity field of each transition is empty), no qualifier and no internal standard transitions; "
           "valproate (143.10 → 143.10) and N-desmethylmesuximide (188.07 → 188.07) are printed as pseudo-transitions; "
           "the article prints “N-Dimethylsulfoxide (NDMS)”, stored here as N-desmethylmesuximide because the abbreviation and the mass match that metabolite — my reading, not the article's wording; "
           "the gradient time points after the first one come from a single reading and the first point is printed at 0.5 min; "
           "source settings are not given; the column model is not named; validation data are printed for five drugs only."),
    gradient_steps=grad([(0.5, 1), (0.7, 9), (1.0, 25), (2.2, 45), (2.6, 65), (2.9, 80), (3.0, 95), (3.5, 95), (3.6, 1), (4.3, 1)], 0.5), mrm_transitions=khr_tr,
)

BATCH = [(M_PON, pon_val), (M_NIC, nic_val), (M_CHH, chh_val), (M_USO, uso_val), (M_KHR, khr_val)]

if __name__ == "__main__":
    dry = "--dry" in sys.argv
    db = SessionLocal()
    client = TestClient(app)
    for payload, val in BATCH:
        if db.query(Method).filter(Method.source_url == payload["source_url"]).first():
            print("already imported:", payload["source_url"]); continue
        analytes = {t["compound_name"] for t in payload["mrm_transitions"] if not t["is_internal_standard"]}
        if {v["compound_name"] for v in val} != analytes or len(val) != len(analytes):
            print("NAME MISMATCH, skipped:", payload["title"][:40]); continue
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
