"""Batch 2 (2026-11-15): four open-access (CC BY) methods read from the
published articles and sent to the review queue as "submitted".
Every value is as printed in the source; where the source is silent or
ambiguous the field is left empty and the point is listed in the notes.
Run once from the project root:  python -m backend.scripts.import_open_access_batch2
"""
import sys
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import Method

SUBMITTER = "Andreu Fabregat Rossell"
NOTE = ("Transcribed from the published article with AI-assisted extraction (two independent readings agreed); "
        "awaiting line-by-line check against the source by a reviewer.")


def tr(name, q1, q3, ce, rt, quant=1, is_std=0, assigned=None, pol="ESI+", **extra):
    return dict(compound_name=name, precursor_mz=q1, product_mz=q3, collision_energy_ev=ce, retention_time_min=rt,
                is_quantifier=quant, is_internal_standard=is_std, assigned_is=assigned, polarity=pol, **extra)


def grad(points, flow=None):
    return [dict(time_min=p[0], percent_b=p[1], flow_rate_ml_min=flow, curve=(p[2] if len(p) > 2 else "linear")) for p in points]


# ── 1. Li et al., Pharmaceuticals 2023 — seven antifungals in serum ──────────
VOR_IS = "[13C2,2H3]-Voriconazole"
# name, RT, Q1, Q3-1, CE1, Q3-2, CE2, IS, polarity
LI = [
    ("Isavuconazole", 3.60, 717.20, 236.15, -10, 165.10, -10, VOR_IS, "ESI+"),
    ("Amphotericin B", 4.05, 906.50, 743.50, -10, 725.40, -10, VOR_IS, "ESI+"),
    ("Voriconazole", 4.37, 350.20, 281.20, -5, 127.20, -5, VOR_IS, "ESI+"),
    ("Fluconazole", 1.29, 307.10, 220.10, -19, 238.10, -5, "Tylosin", "ESI+"),
    ("Caspofungin", 3.78, 547.40, 137.10, -30, 131.10, -26, "Tylosin", "ESI+"),
    ("Posaconazole", 4.76, 701.30, 614.30, -36, 344.20, -47, VOR_IS, "ESI+"),
    ("Micafungin", 6.02, 1268.70, 246.95, 50, 319.91, 65, "Ethylparaben", "ESI-"),
]
LI_IS = [
    (VOR_IS, 4.37, 355.3, 284.10, -5, 128.20, -5, "ESI+"),
    ("Tylosin", 3.74, 916.75, 772.50, -35, 174.20, -30, "ESI+"),
    ("Ethylparaben", 3.67, 165.15, 92.05, 35, 136.70, 20, "ESI-"),
]
li_tr = []
for n, rt, q1, a, cea, b, ceb, istd, pol in LI:
    li_tr += [tr(n, q1, a, cea, rt, 1, 0, istd, pol, dwell_time_ms=20), tr(n, q1, b, ceb, rt, 0, 0, istd, pol, dwell_time_ms=20)]
for n, rt, q1, a, cea, b, ceb, pol in LI_IS:
    li_tr += [tr(n, q1, a, cea, rt, 1, 1, None, pol, dwell_time_ms=20), tr(n, q1, b, ceb, rt, 0, 1, None, pol, dwell_time_ms=20)]

M_LI = dict(
    title="Simultaneous Quantification of Seven Antifungal Agents in Human Serum Using Liquid Chromatography-Tandem Mass Spectrometry",
    analyte=", ".join(r[0] for r in LI), matrix="serum", clinical_application="Antifungals",
    ionization_mode="ESI polarity switching (+/-)",
    instrument_manufacturer="Shimadzu", instrument_model="LCMS-8050",
    column_brand="Waters", column_name="ACQUITY UPLC C8", column_stationary_phase="C8",
    column_length_mm=50, column_diameter_mm=2.1, column_particle_size_um=1.7, column_temperature_c=40,
    mobile_phase_a="Water with 0.1% formic acid", mobile_phase_b="Acetonitrile with 0.1% formic acid",
    injection_volume_ul=2,
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("1. 50 µL serum in a 1.5 mL polypropylene tube.\n"
                         "2. Add 240 µL methanol (containing 0.1% formic acid) and 10 µL internal standard solution (40 µg/mL, three IS).\n"
                         "3. Vortex.\n4. Centrifuge at 12,000 × g for 10 min.\n5. Transfer 250 µL supernatant to an autosampler vial."),
    validation_units="µg/mL",
    reference="Li W, Li Y, Cai J, Wang Y, Liu Y, Hu H, Liu L. Pharmaceuticals (Basel). 2023;16(11):1537. doi:10.3390/ph16111537",
    source_type="Journal article", source_authors="Li W, Li Y, Cai J, Wang Y, Liu Y, Hu H, Liu L",
    source_url="https://doi.org/10.3390/ph16111537", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access, CC BY. Flow 0.4 mL/min, run time 10 min. Linear range 0.1–50 µg/mL for all seven analytes. "
           "Micafungin and ethylparaben are acquired in negative mode, the rest in positive mode. Dwell time 20 ms per transition.\n\n"
           "Source settings as printed: sheath gas flow 3.0 L/min, auxiliary gas flow 10 L/min, ion transfer tube temperature 300 °C, "
           "vaporizer temperature 400 °C, desolvation temperature 250 °C.\n\n"
           "To check when reviewing: Table 1 lists two product ions per compound without saying which is the quantifier — they are stored in the printed order; "
           "collision energies are stored with the signs printed in Table 1; the 0.5 min gradient point appears in section 3.4 but not in section 2.1; "
           "confirm the mass spectrometer model against the article."),
    gradient_steps=grad([(0, 5), (0.5, 5), (3, 50), (4, 100), (7, 100), (9, 5), (10, 5)], 0.4),
    mrm_transitions=li_tr,
)

# ── 2. Ren et al., Molecules 2023 — four DOACs in plasma ────────────────────
# name, RT, Q1, Q3, DP, CE, CXP
REN = [("Rivaroxaban", 4.92, 436.0, 145.0, 168, 40, 15, "Rivaroxaban-d4"),
       ("Betrixaban", 5.67, 452.1, 324.2, 90, 55, 18, "Betrixaban-d6"),
       ("Apixaban", 5.41, 460.1, 443.2, 200, 55, 19, "Apixaban-d3"),
       ("Edoxaban", 1.60, 548.1, 366.3, 57, 26, 25, "Edoxaban-d6")]
REN_IS = [("Rivaroxaban-d4", 4.93, 440.0, 144.9, 180, 37, 14), ("Betrixaban-d6", 5.65, 458.1, 330.2, 86, 55, 25),
          ("Apixaban-d3", 5.39, 463.1, 446.3, 175, 55, 17), ("Edoxaban-d6", 1.61, 554.1, 372.3, 60, 27, 10)]
ren_tr = ([tr(n, q1, q3, ce, rt, 1, 0, istd, declustering_potential=dp, cell_exit_potential=cxp) for n, rt, q1, q3, dp, ce, cxp, istd in REN]
          + [tr(n, q1, q3, ce, rt, 1, 1, None, declustering_potential=dp, cell_exit_potential=cxp) for n, rt, q1, q3, dp, ce, cxp in REN_IS])

M_REN = dict(
    title="Generic Methods for Simultaneous Analysis of Four Direct Oral Anticoagulants in Human Plasma and Urine by Ultra-High Performance Liquid Chromatography-Tandem Mass Spectrometry",
    analyte=", ".join(r[0] for r in REN), matrix="plasma", clinical_application="Therapeutic Drug Monitoring", ionization_mode="ESI+",
    instrument_manufacturer="Sciex", instrument_model="API 4000",
    column_brand="Waters", column_name="ACQUITY UPLC BEH C18", column_stationary_phase="C18",
    column_length_mm=50, column_diameter_mm=2.1, column_particle_size_um=1.7, column_temperature_c=40,
    mobile_phase_a="0.1% formic acid and 5 mmol/L ammonium formate in water",
    mobile_phase_b="0.1% formic acid in methanol:acetonitrile (20:80, v/v)",
    injection_volume_ul=20, autosampler_temperature_c=10,
    curtain_gas=35, collision_gas="7", source_temperature_c=550, gas1=55, gas2=55, ion_spray_voltage=5500,
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("1. 30 µL mixed internal standard in a 1.5 mL tube.\n2. Add 30 µL plasma and 60 µL acetonitrile.\n"
                         "3. Vortex 1.0 min.\n4. Centrifuge at 17,000 × g for 10 min.\n"
                         "5. Transfer 40 µL supernatant and add 80 µL mobile phase A.\n6. Vortex 30 s.\n7. Inject 20 µL."),
    lloq=1, uloq=500, validation_units="ng/mL",
    reference="Ren J-W, Zheng X, Han X-H. Molecules. 2023;28(5):2254. doi:10.3390/molecules28052254",
    source_type="Journal article", source_authors="Ren J-W, Zheng X, Han X-H",
    source_url="https://doi.org/10.3390/molecules28052254", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access, CC BY. Flow 0.4 mL/min, run time 7.0 min. Plasma range 1–500 ng/mL for all four analytes. "
           "Entrance potential (V) as printed: rivaroxaban 7, betrixaban 8, apixaban 6, edoxaban 6; "
           "rivaroxaban-d4 8, betrixaban-d6 10, apixaban-d3 7, edoxaban-d6 7.\n\n"
           "The article also validates urine (10–10,000 ng/mL) with a one-step dilution: 40 µL mixed internal standard + 20 µL urine + "
           "940 µL acetonitrile-water (1:3, v/v), vortex 30 s, inject 5 µL. Only the plasma method is stored here.\n\n"
           "To check when reviewing: the gradient is given in the text as segment durations (25% B for 4.0 min, to 60% B in 1 min, held 0.5 min, "
           "to 80% B in 0.1 min, held 0.4 min, back to 25% B immediately, 1.0 min re-equilibration); the stored time points are worked out from them. "
           "Each analyte is paired with its own deuterated analogue."),
    gradient_steps=grad([(0, 25), (4.0, 25), (5.0, 60), (5.5, 60), (5.6, 80), (6.0, 25, "step"), (7.0, 25)], 0.4),
    mrm_transitions=ren_tr,
)

# ── 3. Bellouard et al., Pharmaceutics 2024 — 12 TKIs in plasma ─────────────
# name, RT, Q1, (Q3, CE), (Q3, CE), assigned IS
BEL = [
    ("Alectinib", 2.7, 483.3, (381.1, 36), (396.1, 23), "Alectinib-D8"),
    ("Alectinib M4", 2.6, 457.3, (381, 33), (396, 30), None),
    ("AZ5104", 2.1, 486.5, (72.1, 28), (371.3, 32), None),
    ("Binimetinib", 2.6, 441.1, (379.1, 19), (165, 33), "Binimetinib-13C,D4"),
    ("Cobimetinib", 2.8, 532, (84, 29), (249, 30), "Cobimetinib-13C6"),
    ("Crizotinib", 2.2, 450.1, (177.1, 38), (260.2, 23), "Crizotinib-13C2,D5"),
    ("Dabrafenib", 3.2, 520.1, (307.2, 33), (343.2, 26), "Dabrafenib-D9"),
    ("Encorafenib", 2.8, 540.2, (310.1, 38), (371.2, 36), "Encorafenib-13C2,D3"),
    ("Imatinib", 2.3, 494.3, (217.3, 25), (394.1, 26), "Imatinib-D8"),
    ("Lorlatinib", 2.3, 407.2, (228.1, 2), (180.1, 23), None),
    ("Osimertinib", 2.4, 500.4, (72.14, 25), (455.2, 21), "Osimertinib-13C,D3"),
    ("Trametinib", 3.1, 616, (226.2, 46), (254.2, 37), "Trametinib-13C6"),
]
BEL_IS = [
    ("Alectinib-D8", 2.7, 491.7, (396.2, 24), (381.1, 36)),
    ("Binimetinib-13C,D4", 2.6, 449.1, (381, 19), (165, 31)),
    ("Cobimetinib-13C6", 2.8, 538.1, (84, 29), (255, 32)),
    ("Crizotinib-13C2,D5", 2.2, 457.2, (177.1, 42), (267.2, 26)),
    ("Dabrafenib-D9", 3.2, 529.1, (316.3, 34), (352.3, 28)),
    ("Encorafenib-13C2,D3", 2.8, 544.2, (310, 34), (371, 37)),
    ("Imatinib-D8", 2.3, 502.4, (225.1, 26), (394.1, 27)),
    ("Osimertinib-13C,D3", 2.4, 504.7, (389.2, 34), (459.2, 21)),
    ("Trametinib-13C6", 3.1, 622, (232.2, 48), (260.2, 39)),
]
bel_tr = []
for n, rt, q1, a, b, istd in BEL:
    bel_tr += [tr(n, q1, a[0], a[1], rt, 1, 0, istd), tr(n, q1, b[0], b[1], rt, 0, 0, istd)]
for n, rt, q1, a, b in BEL_IS:
    bel_tr += [tr(n, q1, a[0], a[1], rt, 1, 1), tr(n, q1, b[0], b[1], rt, 0, 1)]

M_BEL = dict(
    title="Validation of Liquid Chromatography Coupled with Tandem Mass Spectrometry for the Determination of 12 Tyrosine Kinase Inhibitors (TKIs) and Their Application to Therapeutic Drug Monitoring in Adult and Pediatric Populations",
    analyte=", ".join(r[0] for r in BEL), matrix="plasma", clinical_application="Therapeutic Drug Monitoring", ionization_mode="ESI+",
    instrument_manufacturer="Thermo Fisher", instrument_model="TSQ Altis",
    column_brand="Phenomenex", column_name="Kinetex Polar C18", column_stationary_phase="Polar C18",
    column_length_mm=100, column_diameter_mm=2.1, column_particle_size_um=2.6, column_temperature_c=40,
    mobile_phase_a="2 mM ammonium formate in 0.1% formic acid in water", mobile_phase_b="Acetonitrile",
    injection_volume_ul=10, capillary_voltage_v=3500, ion_transfer_tube_temp_c=350, aux_gas_flow=10,
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("1. 50 µL plasma.\n2. Add 150 µL internal standard methanolic solution.\n"
                         "3. Vortex, then centrifuge for 10 min.\n4. Transfer the supernatant to an injection vial.\n5. Inject 10 µL."),
    validation_units="ng/mL",
    reference="Bellouard M, Donadieu J, Thiebot P, Giroux Leprieur E, Saiag P, Etting I, Dugues P, Abe E, Alvarez J-C, Larabi I-A. Pharmaceutics. 2024;16(1):5. doi:10.3390/pharmaceutics16010005",
    source_type="Journal article",
    source_authors="Bellouard M, Donadieu J, Thiebot P, Giroux Leprieur E, Saiag P, Etting I, Dugues P, Abe E, Alvarez J-C, Larabi I-A",
    source_url="https://doi.org/10.3390/pharmaceutics16010005", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access, CC BY. Flow 400 µL/min. Gradient as written: 10 to 40% B from 0 to 1 min, 40 to 90% B in 1 min, held 2 min, "
           "reset to 10% B in 1 min. Sheath gas 30 AU, auxiliary gas 10 AU (nitrogen); collision gas argon, 1.5 mTorr. "
           "AZ5104 is the osimertinib metabolite; alectinib M4 the alectinib metabolite.\n\n"
           "LOQ and linear range (ng/mL, Table 5): dabrafenib 5, 5–5000; trametinib 1, 1–200; cobimetinib 2, 2–2000; encorafenib 5, 5–5000; "
           "binimetinib 2, 2–2000; osimertinib 2, 2–2000; AZ5104 0.2, 0.2–200; crizotinib 10, 10–2000; alectinib 2, 2–2000; "
           "alectinib M4 2, 2–2000; imatinib 5, 5–5000; lorlatinib 2, 2–2000.\n\n"
           "To check when reviewing: Table 3 gives two fragments per compound without saying which is the quantifier — stored in the printed order; "
           "lorlatinib 407.2 → 228.1 is printed with a collision energy of 2 eV; the binimetinib internal standard is printed as “Bimetinib-13CD4”; "
           "no internal standard is named for alectinib M4, AZ5104 or lorlatinib (the article says no labelled standard was available for AZ5104); "
           "the column maker is not named in the article (Kinetex is a Phenomenex line); the centrifugation speed is not given."),
    gradient_steps=grad([(0, 10), (1, 40), (2, 90), (4, 90), (5, 10)], 0.4),
    mrm_transitions=bel_tr,
)

# ── 4. Danese et al., Diagnostics 2020 — 15 bile acids in serum ─────────────
# name, IS, Q1, RT, Q3, collision voltage
DAN = [
    ("Tauroursodeoxycholic acid (TUDCA)", "Glycocholic acid-d4", 498.28, 2.58, 80.00, 60),
    ("Taurocholic acid (TCA)", "Taurocholic acid-d4", 514.28, 2.7, 80.00, 64),
    ("Glycoursodeoxycholic acid (GUDCA)", "Glycocholic acid-d4", 448.28, 2.92, 74.00, 35),
    ("Glycocholic acid (GCA)", "Glycocholic acid-d4", 464.28, 3.06, 74.00, 34),
    ("Taurochenodeoxycholic acid (TCDCA)", "Glycocholic acid-d4", 498.28, 3.3, 80.00, 60),
    ("Taurodeoxycholic acid (TDCA)", "Glycocholic acid-d4", 498.28, 3.46, 80.00, 60),
    ("Cholic acid (CA)", "Cholic acid-d4", 407.28, 3.64, 343.28, 34),
    ("Ursodeoxycholic acid (UDCA)", "Ursodeoxycholic acid-d4", 391.28, 3.65, 391.28, 16),
    ("Glycochenodeoxycholic acid (GCDCA)", "Cholic acid-d4", 448.28, 3.67, 74.00, 35),
    ("Hyodeoxycholic acid (HDCA)", "Cholic acid-d4", 391.28, 3.77, 391.28, 16),
    ("Glycodeoxycholic acid (GDCA)", "Cholic acid-d4", 448.28, 3.87, 74.00, 35),
    ("Taurolithocholic acid (TLCA)", "Chenodeoxycholic acid-d4", 482.28, 4.02, 80.00, 60),
    ("Chenodeoxycholic acid (CDCA)", "Chenodeoxycholic acid-d4", 391.28, 4.41, 391.28, 16),
    ("Glycolithocholic acid (GLCA)", "Deoxycholic acid-d4", 432.28, 4.49, 74.00, 35),
    ("Deoxycholic acid (DCA)", "Deoxycholic acid-d4", 391.28, 4.51, 391.28, 16),
]
DAN_IS = [("Taurocholic acid-d4", 518.28, 2.7, 80.00, 64), ("Glycocholic acid-d4", 468.28, 3.06, 74.00, 34),
          ("Cholic acid-d4", 411.28, 3.64, 347.28, 34), ("Ursodeoxycholic acid-d4", 395.28, 3.65, 395.28, 16),
          ("Chenodeoxycholic acid-d4", 395.28, 4.41, 395.28, 16), ("Deoxycholic acid-d4", 395.28, 4.51, 395.28, 16)]
dan_tr = ([tr(n, q1, q3, ce, rt, 1, 0, istd, "ESI-", cone_voltage=60) for n, istd, q1, rt, q3, ce in DAN]
          + [tr(n, q1, q3, ce, rt, 1, 1, None, "ESI-", cone_voltage=60) for n, q1, rt, q3, ce in DAN_IS])

M_DAN = dict(
    title="Bile Acids Quantification by Liquid Chromatography–Tandem Mass Spectrometry: Method Validation, Reference Range, and Interference Study",
    analyte=", ".join(r[0] for r in DAN), matrix="serum", clinical_application="Metabolic Disorders", ionization_mode="ESI-",
    instrument_manufacturer="Waters", instrument_model="ACQUITY UPLC I-Class / Xevo TQ-S micro",
    column_brand="Waters", column_name="CORTECS T3", column_stationary_phase="T3 (C18)",
    column_length_mm=30, column_diameter_mm=2.1, column_particle_size_um=2.7, column_temperature_c=60,
    mobile_phase_a="Water, 0.1% of 200 mM ammonium formate, 0.01% formic acid",
    mobile_phase_b="Acetonitrile:isopropanol (1:1), 0.1% of 200 mM ammonium formate, 0.01% formic acid",
    injection_volume_ul=10, autosampler_temperature_c=10,
    capillary_voltage_v=2000, source_temperature_c=150, desolvation_temperature_c=600, cone_gas_flow_lh=50, desolvation_gas_flow_lh=1000,
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("1. 200 µL serum.\n2. Add 780 µL methanol and 20 µL internal standard solution.\n3. Vortex 20 s.\n"
                         "4. Centrifuge 5 min at 18,000 rcf.\n5. Transfer 200 µL supernatant to a 96-well plate with 200 µL water.\n6. Inject 10 µL."),
    lloq=5, uloq=5000, validation_units="ng/mL",
    reference="Danese E, Negrini D, Pucci M, De Nitto S, Ambrogi D, Donzelli S, Lievens PM-J, Salvagno GL, Lippi G. Diagnostics (Basel). 2020;10(7):462. doi:10.3390/diagnostics10070462",
    source_type="Journal article",
    source_authors="Danese E, Negrini D, Pucci M, De Nitto S, Ambrogi D, Donzelli S, Lievens PM-J, Salvagno GL, Lippi G",
    source_url="https://doi.org/10.3390/diagnostics10070462", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access, CC BY. Flow 1 mL/min, run time 7 min. Linear 5–5000 ng/mL for all 15 bile acids. "
           "Cone voltage 60 V is a common setting for all compounds. The unconjugated dihydroxy bile acids (UDCA, HDCA, CDCA, DCA) are monitored as "
           "precursor → precursor (391.28 → 391.28), as printed in Table 1.\n\n"
           "To check when reviewing: the gradient is written as “5% B at time zero, linear increase until minute 5.5 with 50% B, then from 5.5 to 6.2 min "
           "98% B and then from 6.2 to 7.0 min reconditioning with 5% B” — stored as steps at 5.5 and 6.2 min; "
           "the column maker is not named in the article (CORTECS is a Waters line); the injection step is taken from the stated 10 µL injection volume."),
    gradient_steps=grad([(0, 5), (5.5, 50), (5.5, 98, "step"), (6.2, 5, "step"), (7.0, 5)], 1.0),
    mrm_transitions=dan_tr,
)

if __name__ == "__main__":
    db = SessionLocal()
    client = TestClient(app)
    for payload in (M_LI, M_REN, M_BEL, M_DAN):
        if db.query(Method).filter(Method.source_url == payload["source_url"]).first():
            print("already imported:", payload["source_url"]); continue
        r = client.post("/api/methods/", json=payload)
        if r.status_code != 200:
            print("FAILED", r.status_code, r.text[:300]); sys.exit(1)
        m = r.json()
        print(f"queued id={m['id']} status={m['status']} transitions={len(m['mrm_transitions'])} gradient={len(m['gradient_steps'])} | {m['title'][:50]}")
