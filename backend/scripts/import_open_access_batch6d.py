"""Batch 6d (2026-11-17): four open-access methods for gaps in the library — busulfan for
pediatric HSCT conditioning (Thermo), direct oral anticoagulants in plasma (Sciex), the four
DOACs by VAMS (Agilent) and oxytocin + cortisol in saliva (Sciex QTRAP).
Sent to the review queue as "submitted". Values as printed; two independent readings agreed
unless a note says otherwise. Validation rows store the WORST CASE across levels.
Run once from the project root:  python -m backend.scripts.import_open_access_batch6d
"""
import sys
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import Method, CompoundValidation
from backend.scripts.import_open_access_batch2 import tr, grad, SUBMITTER, NOTE
from backend.scripts.import_validation_batch import rng, worst_acc

# ── 1. Cafaro et al., Biomedicines 2023 — busulfan in plasma (Thermo TSQ Quantiva) ──
BU_LV = [("LLOQ", 125, 3, 11, 1, 12), ("Low", 300, 5, -4, 3, -7), ("Medium", 600, 4, -2, 2, -4), ("High", 900, 5, 2, 4, -3)]  # intra CV, intra bias, inter CV, inter bias
bu_val = [dict(compound_name="Busulfan", lod=None, loq=125, r2=0.9998, cv_percent=max(max(l[2], l[4]) for l in BU_LV),
               accuracy_percent=worst_acc([100 + b for l in BU_LV for b in (l[3], l[5])]),
               notes=("Worst case over 4 levels (LLOQ 125, low 300, medium 600, high 900 ng/mL; n = 5, three days). "
                      f"Intra-day CV {rng([l[2] for l in BU_LV], 0)}%, bias {rng([l[3] for l in BU_LV], 0)}%. "
                      f"Inter-day CV {rng([l[4] for l in BU_LV], 0)}%, bias {rng([l[5] for l in BU_LV], 0)}%. "
                      "Calibration 125–2000 ng/mL (6 levels, 1/x), mean R² 0.9998. Extraction recovery 90% (CV < 15%); matrix effect 8–12%. "
                      "Unstable at room temperature (plasma > 27%, whole blood > 38% in 24 h); stable 24 h at 4 °C."))]
M_BU = dict(
    title="Development and Validation of a Novel LC-MS/MS Method for a TDM-Guided Personalization of HSCT Conditioning with High-Dose Busulfan in Children",
    analyte="Busulfan", matrix="plasma", clinical_application="Therapeutic Drug Monitoring", ionization_mode="ESI+",
    instrument_manufacturer="Thermo Fisher", instrument_model="TSQ Quantiva with UltiMate 3000",
    column_brand="Waters", column_name="Acquity UPLC BEH C18", column_stationary_phase="C18", column_length_mm=100, column_diameter_mm=2.1, column_particle_size_um=1.7,
    mobile_phase_a="5 mM ammonium acetate and 0.1% formic acid in water", mobile_phase_b="0.1% formic acid in acetonitrile",
    capillary_voltage_pos_v=4.5, sheath_gas_flow_lmin=40, aux_gas_flow=5, vaporizer_temp_c=350, ion_transfer_tube_temp_c=350, collision_gas="Argon, 2.5 mTorr",
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("1. 50 µL plasma + 10 µL busulfan-d8 working solution (3 µg/mL).\n2. Add 440 µL 0.1% formic acid in acetonitrile.\n3. Vortex.\n"
                         "4. Centrifuge 10 min at 14,000× g, 4 °C.\n5. Transfer to an autosampler vial and inject."),
    validation_units="ng/mL",
    reference="Cafaro A, Pigliasco F, Baiardi G, Barco S, Stella M, Bandettini R, Mattioli F, Faraci M, Cangemi G. Biomedicines. 2023;11(2):530. doi:10.3390/biomedicines11020530",
    source_type="Journal article", source_authors="Cafaro A, Pigliasco F, Baiardi G, Barco S, Stella M, Bandettini R, Mattioli F, Faraci M, Cangemi G",
    source_url="https://doi.org/10.3390/biomedicines11020530", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access (MDPI, CC BY). Busulfan TDM for high-dose conditioning before hematopoietic stem cell transplantation in children, validated to ICH M10. "
           "Flow 400 µL/min, run time 6.5 min; busulfan and busulfan-d8 elute at 2.71 min. Spray voltage 4500 V; nitrogen nebulizer and auxiliary gas 40 and 5 arbitrary units "
           "(stored as sheath and aux gas); vaporizer and capillary temperature 350 °C (capillary stored as ion transfer tube); argon 2.5 mTorr.\n\n"
           "To check when reviewing: no collision energy, RF lens, injection volume or column temperature is given; one transition per compound; "
           "the precursor 264.0 matches the ammonium adduct of busulfan — the article does not name the adduct; "
           "the article gives R² 0.9998 in one place and 0.99 in another."),
    gradient_steps=grad([(0, 5), (0.1, 5), (2.0, 100), (3.0, 100), (6.5, 5)], 0.4),
    mrm_transitions=[tr("Busulfan", 264.029, 151.071, None, 2.71, 1, 0, "Busulfan-d8", "ESI+"), tr("Busulfan-d8", 272.068, 159.125, None, 2.71, 1, 1, None, "ESI+")],
)

# ── 2. Ren et al., Molecules 2023 — four DOACs in plasma and urine (Sciex API 4000) ──
REN = [("Rivaroxaban", 4.92, 436.0, 145.0, 168, 40, 15, "Rivaroxaban-2H4"), ("Betrixaban", 5.67, 452.1, 324.2, 90, 55, 18, "Betrixaban-2H6"),
       ("Apixaban", 5.41, 460.1, 443.2, 200, 55, 19, "Apixaban-2H3"), ("Edoxaban", 1.60, 548.1, 366.3, 57, 26, 25, "Edoxaban-2H6")]
REN_IS = [("Rivaroxaban-2H4", 4.93, 440.0, 144.9, 180, 37, 14), ("Betrixaban-2H6", 5.65, 458.1, 330.2, 86, 55, 25),
          ("Apixaban-2H3", 5.39, 463.1, 446.3, 175, 55, 17), ("Edoxaban-2H6", 1.61, 554.1, 372.3, 60, 27, 10)]
# inter-day (n = 18) RSD / RE at LLOQ, LQC, MQC, HQC; plasma levels 1, 2, 40, 400 ng/mL; urine 10, 30, 750, 7500 ng/mL
REN_P = {"Rivaroxaban": [(8.5, -3.6), (4.2, 3.7), (2.1, 5.1), (3.9, 1.1)], "Apixaban": [(11, 0.8), (6.0, 7.0), (3.0, 7.1), (5.0, 0.4)],
         "Edoxaban": [(14, -2.6), (6.0, 2.6), (2.0, 6.0), (4.0, 3.0)], "Betrixaban": [(9, -7), (6.0, 1.9), (3.0, 5.8), (4.0, -0.4)]}
REN_U = {"Rivaroxaban": [(8.0, -3.8), (3.7, 1.9), (2.7, 1.7), (1.8, -2.9)], "Apixaban": [(8.8, 1.7), (4.3, 7.0), (4.1, 6.0), (3.0, -10.7)],
         "Edoxaban": [(11.6, -1.5), (7.1, 0.4), (3.9, 1.1), (2.9, 0.8)], "Betrixaban": [(9.0, -8.1), (5.4, 3.7), (3.9, 1.9), (2.0, -1.0)]}
REN_R2 = {"Rivaroxaban": (0.9992, 0.9992), "Betrixaban": (0.9990, 0.9956), "Apixaban": (0.9986, 0.9993), "Edoxaban": (0.9991, 0.9992)}
REN_RM = {"Rivaroxaban": ("94.1/89.1/93.9", "101.3/99.1/97.5"), "Apixaban": ("87.5/90.9/95.6", "104.7/99.0/93.5"),
          "Edoxaban": ("86.5/92.5/96.6", "99.8/92.4/93.7"), "Betrixaban": ("97.5/92.2/96.8", "94.8/98.4/95.1")}
ren_val = [dict(compound_name=n, lod=None, loq=1, r2=REN_R2[n][0], cv_percent=max(l[0] for l in REN_P[n]), accuracy_percent=worst_acc([100 + l[1] for l in REN_P[n]]),
                notes=(f"Plasma, inter-day (n = 18), worst case over LLOQ 1, LQC 2, MQC 40, HQC 400 ng/mL: RSD {rng([l[0] for l in REN_P[n]])}%, "
                       f"RE {rng([l[1] for l in REN_P[n]])}%. Calibration 1–500 ng/mL (1/x²), r² {REN_R2[n][0]}. "
                       f"Matrix effect LQC/MQC/HQC {REN_RM[n][0]}%, recovery {REN_RM[n][1]}%. "
                       f"Urine (LLOQ 10, LQC 30, MQC 750, HQC 7500 ng/mL; calibration 10–10,000 ng/mL, r² {REN_R2[n][1]}): "
                       f"RSD {rng([l[0] for l in REN_U[n]])}%, RE {rng([l[1] for l in REN_U[n]])}%."))
           for n, *_ in REN]
M_REN = dict(
    title="Generic Methods for Simultaneous Analysis of Four Direct Oral Anticoagulants in Human Plasma and Urine by Ultra-High Performance Liquid Chromatography-Tandem Mass Spectrometry",
    analyte="Rivaroxaban, Betrixaban, Apixaban, Edoxaban", matrix="plasma", clinical_application="Therapeutic Drug Monitoring", ionization_mode="ESI+",
    instrument_manufacturer="Sciex", instrument_model="API 4000 with Shimadzu LC-20AD XR",
    column_brand="Waters", column_name="ACQUITY UPLC BEH C18", column_stationary_phase="C18", column_length_mm=50, column_diameter_mm=2.1, column_particle_size_um=1.7,
    column_temperature_c=40, autosampler_temperature_c=10,
    mobile_phase_a="0.1% formic acid and 5 mmol/L ammonium formate in water", mobile_phase_b="0.1% formic acid in methanol:acetonitrile (20:80, v/v)", injection_volume_ul=20,
    ion_spray_voltage=5500, source_temperature_c=550, gas1=55, gas2=55, curtain_gas=35, collision_gas="7",
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("Plasma:\n1. 30 µL mixed internal standard (200 ng/mL in acetonitrile) + 30 µL plasma + 60 µL acetonitrile.\n2. Vortex 1 min; centrifuge 10 min at 17,000× g.\n"
                         "3. 40 µL supernatant + 80 µL mobile phase A; vortex 30 s; inject 20 µL.\n"
                         "Urine (one-step dilution): 40 µL internal standard + 20 µL urine + 940 µL acetonitrile–water (1:3, v/v); vortex 30 s; inject 5 µL of the supernatant."),
    validation_units="ng/mL",
    reference="Ren J-W, Zheng X, Han X-H. Molecules. 2023;28(5):2254. doi:10.3390/molecules28052254",
    source_type="Journal article", source_authors="Ren J-W, Zheng X, Han X-H",
    source_url="https://doi.org/10.3390/molecules28052254", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access (MDPI, CC BY). Rivaroxaban, apixaban, edoxaban and betrixaban (no dabigatran) in plasma and, with a dilute-and-shoot step, in urine; "
           "the urine procedure and its validation are in the sample prep and validation notes. Flow 0.4 mL/min, run time 7.0 min. Entrance potential (EP) per transition: "
           "rivaroxaban 7, betrixaban 8, apixaban 6, edoxaban 6 V; internal standards 8, 10, 7, 7 V.\n\n"
           "To check when reviewing: the gradient is described by segment durations (25% B to 4.0 min, to 60% in 1 min, hold 0.5 min, to 80% in 0.1 min, hold 0.4 min, "
           "back to 25% and 1 min re-equilibration); the return to 25% B is stored as a step at 6.01 min; one transition per compound; "
           "the inter-day table header is garbled in the source and values were mapped in order (RSD/RE for LLOQ, LQC, MQC, HQC); gas values have no units in the article; "
           "no centrifugation is mentioned for urine."),
    gradient_steps=grad([(0, 25), (4.0, 25), (5.0, 60), (5.5, 60), (5.6, 80), (6.0, 80), (6.01, 25, "step"), (7.0, 25)], 0.4),
    mrm_transitions=([tr(n, q1, q3, ce, rt, 1, 0, is_, "ESI+", declustering_potential=dp, cell_exit_potential=cxp) for n, rt, q1, q3, dp, ce, cxp, is_ in REN]
                     + [tr(n, q1, q3, ce, rt, 1, 1, None, "ESI+", declustering_potential=dp, cell_exit_potential=cxp) for n, rt, q1, q3, dp, ce, cxp in REN_IS]),
)

# ── 3. Peng et al., JMSACL 2026 — four DOACs by finger-prick VAMS (Agilent 6460) ──
PEN = [("Dabigatran", 472.2, [289.0, 144.0], "Dabigatran-13C6"), ("Rivaroxaban", 436.1, [144.9, 72.9], "Rivaroxaban-13C6"),
       ("Apixaban", 460.2, [443.1, 199.0], "Apixaban-13C,d3"), ("Edoxaban", 548.1, [366.1, 152.0], "Edoxaban-d6")]
PEN_IS = [("Dabigatran-13C6", 478.2, [295.1, 144.0]), ("Rivaroxaban-13C6", 442.1, [144.9, 72.9]), ("Apixaban-13C,d3", 464.2, [447.1, 203.1]), ("Edoxaban-d6", 554.1, [372.1, 158.1])]
# level: intra acc, intra CV, inter acc, inter CV, recovery, MF
PEN_V = {
 "Dabigatran": (0.990, [(118.3, 3.1, 116.4, 3.1, 107.9, 135.4), (103.3, 5.7, 107.5, 7.1, 106.5, 134.1), (94.8, 5.8, 98.6, 6.5, 109.9, 130.6), (100.8, 6.0, 102.5, 6.0, 99.1, 123.3)]),
 "Rivaroxaban": (0.997, [(118.2, 6.1, 118.8, 6.8, 114.8, 103.1), (100.3, 5.4, 106.2, 6.9, 107.6, 94.4), (103.6, 7.0, 110.4, 8.4, 111.3, 97.0), (102.3, 4.0, 101.8, 4.0, 99.0, 92.9)]),
 "Apixaban": (0.998, [(119.8, 2.6, 121.3, 2.6, 108.5, 95.1), (104.0, 5.0, 108.8, 7.3, 108.4, 91.9), (96.1, 5.9, 104.9, 10.3, 111.9, 95.3), (112.3, 4.2, 112.5, 4.2, 100.4, 91.1)]),
 "Edoxaban": (0.998, [(114.8, 5.6, 117.6, 7.4, 102.4, 116.8), (111.1, 6.1, 106.9, 7.2, 103.7, 102.0), (101.3, 6.1, 106.5, 7.2, 107.7, 107.8), (104.1, 5.1, 102.2, 5.1, 96.2, 102.1)]),
}
pen_val = [dict(compound_name=n, lod=None, loq=5, r2=r2, cv_percent=max(max(l[1], l[3]) for l in lv), accuracy_percent=worst_acc([a for l in lv for a in (l[0], l[2])]),
                notes=(f"VAMS, worst case over LLOQ 5, low 10, medium 100, high 750 ng/mL (intra-day n = 5, inter-day n = 15). "
                       f"Accuracy {rng([a for l in lv for a in (l[0], l[2])])}%. Intra-day CV {rng([l[1] for l in lv])}%, inter-day CV {rng([l[3] for l in lv])}%. "
                       f"Calibration 5–1000 ng/mL (7 levels, 1/x), r² {r2}. Recovery {rng([l[4] for l in lv])}%; matrix factor {rng([l[5] for l in lv])}%."))
           for n, (r2, lv) in PEN_V.items()]
M_PEN = dict(
    title="Bridging of Finger-Prick Volumetric Absorptive Microsampling and Conventional Venous Sampling with Clinical Specimens for Direct Oral Anticoagulants Analysis by LC–MS/MS",
    analyte="Dabigatran, Rivaroxaban, Apixaban, Edoxaban", matrix="dried blood spot", clinical_application="Therapeutic Drug Monitoring", ionization_mode="ESI+",
    instrument_manufacturer="Agilent", instrument_model="6460 Triple Quad with 1290 UHPLC",
    column_brand="Phenomenex", column_name="Kinetex C18 (core-shell, 100 Å)", column_stationary_phase="C18", column_length_mm=50, column_diameter_mm=2.1, column_particle_size_um=2.6,
    column_temperature_c=55, autosampler_temperature_c=4,
    mobile_phase_a="0.1% formic acid and 10 mM ammonium acetate in water", mobile_phase_b="0.1% formic acid and 10 mM ammonium acetate in isopropanol–acetonitrile (9:1, v/v)",
    injection_volume_ul=3, gas_temperature=350, gas_flow_lmin=10, nebulizer_pressure_psi=45, sheath_gas_heater_c=350, sheath_gas_flow_lmin=11,
    capillary_voltage_v=3500, nozzle_voltage_v=500,
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("Volumetric absorptive microsampling, 20 µL Mitra clamshells, finger-prick blood.\n1. Hold the tip at 45° in the blood until fully saturated; dry overnight at room temperature; "
                         "store sealed with desiccant.\n2. Tip in an Eppendorf tube + 300 µL water with 0.1% formic acid and 10 ng/mL internal standards; Geno/Grinder 2 min at 1000 rpm.\n"
                         "3. Add 700 µL acetonitrile; extract 3 min more.\n4. Centrifuge 5 min at 18,000 rcf.\n5. Evaporate 800 µL supernatant in a centrifugal vaporizer.\n"
                         "6. Reconstitute in 200 µL methanol; filter through a 0.2 µm PP membrane; inject 3 µL."),
    validation_units="ng/mL",
    reference="Peng Y-F, Tang S-C, Kuo C-H, Lin S-Y. J Mass Spectrom Adv Clin Lab. 2026;39(1). doi:10.21627/bhyw5v67",
    source_type="Journal article", source_authors="Peng Y-F, Tang S-C, Kuo C-H, Lin S-Y",
    source_url="https://jmsacl.journals.sup.org/index.php/jmsacl/article/download/98/60/2966?inline=1", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: JMSACL article read on the journal's open web page; a license statement was not found in the text. Finger-prick VAMS for the four DOACs, with conversion "
           "factors to venous plasma from paired clinical samples (weighted Deming regression; dabigatran 1.88, rivaroxaban 1.57, apixaban 1.64, edoxaban 1.08). "
           "Flow 0.35 mL/min, run time 5.7 min. Hematocrit 20–60%: no effect on recovery (89.9–117.1%); the matrix factor of edoxaban rose from 113.0% to 135.6% at high hematocrit, "
           "corrected by the internal standard. Stability on VAMS 89.5–114.2% at room temperature, 4 °C and −20 °C up to 120 days.\n\n"
           "To check when reviewing: no collision energies, fragmentor voltages or retention times are given (the first transition listed is marked as quantifier); "
           "the gradient is derived from segment durations, with the return to 0% B stored as a step at 3.71 min; DOI as printed (10.21627/bhyw5v67); "
           "the matrix factor of dabigatran is 123–135% and the LLOQ accuracies are 115–121%, as printed."),
    gradient_steps=grad([(0, 0), (0.5, 0), (0.6, 6), (1.2, 6), (1.7, 25), (2.2, 27.5), (2.7, 50), (3.7, 50), (3.71, 0, "step"), (5.7, 0)], 0.35),
    mrm_transitions=([tr(n, q1, q3, None, None, 1 if i == 0 else 0, 0, is_, "ESI+") for n, q1, prods, is_ in PEN for i, q3 in enumerate(prods)]
                     + [tr(n, q1, q3, None, None, 1 if i == 0 else 0, 1, None, "ESI+") for n, q1, prods in PEN_IS for i, q3 in enumerate(prods)]),
)

# ── 4. Polledri et al., Separations 2024 — oxytocin and cortisol in saliva (Sciex QTRAP 5500) ──
POL_V = [
 dict(compound_name="Oxytocin", lod=0.00099, loq=0.002, r2=None, cv_percent=7.4, accuracy_percent=112,
      notes=("At LOQ (0.0020 nmol/L): RSD 7.4%, accuracy 112%. Low QC 0.0042 nmol/L: day-to-day RSD 2.3–6.6%, accuracy 93–102% (overall n = 18: 5.0%, 99%). "
             "High QC 0.036 nmol/L: RSD 0.3–1.6%, accuracy 100–104% (overall 1.4%, 102%). LOD 0.00099 nmol/L. R² > 0.992. "
             "Recovery 86–99% (101% after IS correction). Matrix effect (slope variation, 6 donors) 31.9% without IS, 2.4% with IS.")),
 dict(compound_name="Cortisol", lod=0.3, loq=0.5, r2=None, cv_percent=5.6, accuracy_percent=110,
      notes=("At LOQ (0.5 nmol/L): RSD 3.0%, accuracy 110%. Low QC 0.81 nmol/L: day-to-day RSD 0.6–5.6%, accuracy 98–104% (overall n = 18: 4.6%, 101%). "
             "High QC 7.33 nmol/L: RSD 0.4–5.4%, accuracy 94–100% (overall 3.7%, 98%). LOD 0.3 nmol/L. R² > 0.992. "
             "Recovery 80–91% (97% after IS correction). Matrix effect 33.8% without IS, 2.6% with IS. No interference from prednisone or prednisolone.")),
]
M_POL = dict(
    title="A Validated Method for the Simultaneous Determination of Oxytocin and Cortisol in Human Saliva",
    analyte="Oxytocin, Cortisol", matrix="saliva", clinical_application="Endocrinology", ionization_mode="ESI+",
    instrument_manufacturer="Sciex", instrument_model="QTRAP 5500 with Agilent 1260",
    column_brand="Thermo Scientific", column_name="Hypersil Gold", column_stationary_phase="C18", column_length_mm=50, column_diameter_mm=2.1, column_particle_size_um=3.0,
    column_temperature_c=35,
    mobile_phase_a="5 mM ammonium formate with 0.1% formic acid in water", mobile_phase_b="5 mM ammonium formate with 0.1% formic acid in methanol", injection_volume_ul=40,
    gas1=30, gas2=40, curtain_gas=35, source_temperature_c=450,
    sample_prep_method="Solid Phase Extraction (SPE)",
    sample_prep_details=("Saliva collected with Salivette devices; recovered by centrifugation 5 min at 3000 rpm; stored at −20 °C protected from light.\n"
                         "1. Dilute 1:1 with 4% phosphoric acid in water; add 20 µL internal standard (final oxytocin-D5 0.040 nmol/L, cortisol-D4 10 nmol/L).\n"
                         "2. Oasis HLB 30 mg/1 mL: condition with 1 mL acetonitrile and 1 mL 1% phosphoric acid.\n3. Load 1 mL diluted sample; wash with 1 mL 1% phosphoric acid.\n"
                         "4. Elute with 1 mL methanol; evaporate under nitrogen at 37 °C.\n5. Reconstitute in 100 µL mobile phase A:B 70:30; inject 40 µL."),
    validation_units="nmol/L",
    reference="Polledri E, Mercadante R, Campo L, Fustinoni S. Separations. 2024;11(8):240. doi:10.3390/separations11080240",
    source_type="Journal article", source_authors="Polledri E, Mercadante R, Campo L, Fustinoni S",
    source_url="https://doi.org/10.3390/separations11080240", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access (MDPI, CC BY 4.0), read from the institutional repository copy. Oxytocin and cortisol in the same run from one saliva sample. "
           "Flow 400 µL/min, run time 13 min, dwell 50 ms. Declustering potential 70 V and entrance potential 10 V for all transitions. Not a clinical diagnostic validation: "
           "samples came from healthy volunteers.\n\n"
           "To check when reviewing: m/z values are printed as integers; the collision energy of the oxytocin qualifier (1007 → 706) is not legible in the source; "
           "the particle size is printed as “3 mm” (stored as 3 µm); the saliva volume is printed as “500 mL” (presumably 500 µL); "
           "the calibration range differs between Table 2 (oxytocin 0.002–0.074, cortisol 0.5–15 nmol/L) and the abstract (up to 0.1 and 20 nmol/L); "
           "the stationary phase of the Hypersil Gold column is stored as C18, which the article does not state."),
    gradient_steps=grad([(0, 0), (1, 0), (6, 100), (7, 100), (8, 0), (13, 0)], 0.4),
    mrm_transitions=[tr("Oxytocin", 1007, 723, 30, 6.76, 1, 0, "Oxytocin-D5", "ESI+", declustering_potential=70),
                     tr("Oxytocin", 1007, 706, None, 6.76, 0, 0, "Oxytocin-D5", "ESI+", declustering_potential=70),
                     tr("Oxytocin-D5", 1012, 723, 30, 6.75, 1, 1, None, "ESI+", declustering_potential=70),
                     tr("Cortisol", 363, 121, 33, 7.71, 1, 0, "Cortisol-D4", "ESI+", declustering_potential=70),
                     tr("Cortisol", 363, 97, 50, 7.71, 0, 0, "Cortisol-D4", "ESI+", declustering_potential=70),
                     tr("Cortisol-D4", 367, 121, 33, 7.70, 1, 1, None, "ESI+", declustering_potential=70)],
)

BATCH = [(M_BU, bu_val), (M_REN, ren_val), (M_PEN, pen_val), (M_POL, POL_V)]

if __name__ == "__main__":
    dry = "--dry" in sys.argv
    db = SessionLocal()
    client = TestClient(app)
    for payload, val in BATCH:
        if db.query(Method).filter((Method.source_url == payload["source_url"]) | (Method.title == payload["title"])).first():
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
