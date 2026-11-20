"""Batch 6e (2026-11-17): serum methotrexate on a Thermo TSQ Quantis (Tripathy et al.,
J Lab Physicians 2023), read from the full-text PDF supplied by the user.
Sent to the review queue as "submitted". Values as printed; the article contains several
internal inconsistencies, all listed in the notes.
Run once from the project root:  python -m backend.scripts.import_open_access_batch6e
"""
import sys
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import Method, CompoundValidation
from backend.scripts.import_open_access_batch2 import tr, grad, SUBMITTER

NOTE_PDF = ("Transcribed from the full-text PDF supplied by the contributor (AI-assisted extraction); "
            "awaiting line-by-line check against the source by a reviewer.")

val = [dict(compound_name="Methotrexate", lod=None, loq=0.09, r2=None, cv_percent=20.0, accuracy_percent=None,
            notes=("LLOQ 0.09 µmol/L. Table 4 (n = 5): CV 10.258% at LLOQ (0.09), 1.004% at LQC (0.5), 2.128% and 1.589% at MQC (5.0 and 10.0), 2.18% at HQC (12.5 µmol/L); "
                   "printed accuracies 113.5, 114.4, 95.5, 100 and 100.5%. Table 3 summary: intraday LLOQ CV 10.25–12.5%, RE 11.1–18.9%; analytical QC CV 1.0–2.18%, RE 0.01–15.2%; "
                   "interday LLOQ CV 10.25–19.4%, RE 11.1–23.3%; analytical QC CV 1.6–20%, “RE 79–103”. CV stored is the worst printed (20%); accuracy is not stored because the "
                   "printed values do not match the printed means (e.g. LLOQ mean 0.0778 µmol/L for 0.09 nominal, printed as 113.5%). "
                   "Calibration 0.09–12.5 µmol/L, 1/x² weighting, r > 0.99 (mean r 0.9928). Recovery 40% (analyte and IS). IS-normalised matrix factor CV 4.56% (low) and 2.1% (high). "
                   "Carry-over 10% of the LLOQ peak area. Calibrators stable > 90% for 8 h at room temperature and 24 h at 4 °C."))]

M = dict(
    title="A Rapid Method for Determination of Serum Methotrexate Using Ultra-High-Performance Liquid Chromatography–Tandem Mass Spectrometry and Its Application in Therapeutic Drug Monitoring",
    analyte="Methotrexate", matrix="serum", clinical_application="Therapeutic Drug Monitoring", ionization_mode="ESI+",
    instrument_manufacturer="Thermo Fisher", instrument_model="TSQ Quantis with Vanquish UHPLC",
    column_brand="Thermo Fisher", column_name="Acclaim 120 C18", column_stationary_phase="C18", column_length_mm=50, column_diameter_mm=2.1, column_particle_size_um=3.0,
    mobile_phase_a="0.1% formic acid in water", mobile_phase_b="Acetonitrile", injection_volume_ul=10,
    capillary_voltage_pos_v=4.0, sheath_gas_flow_lmin=50, aux_gas_flow=5, sweep_gas_flow=1, ion_transfer_tube_temp_c=200, vaporizer_temp_c=400,
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("1. Thaw and vortex samples 1 min.\n2. 100 µL serum + 900 µL acetonitrile–water (70:30, v/v) containing the internal standard (p-aminoacetophenone, 250 µM).\n"
                         "3. Vortex 2 min.\n4. Centrifuge 5 min at 2,000 rcf, 4 °C; transfer the supernatant without disturbing the pellet.\n"
                         "5. Centrifuge again 5 min at 2,000 rcf, 4 °C; transfer the supernatant to an autosampler vial; inject 10 µL."),
    validation_units="μmol/L",
    reference="Tripathy NK, Mishra SK, Nathan G, Srivastava S, Gupta A, Lingaiah R. J Lab Physicians. 2023;15:344–353. doi:10.1055/s-0042-1760668",
    source_type="Journal article", source_authors="Tripathy NK, Mishra SK, Nathan G, Srivastava S, Gupta A, Lingaiah R",
    source_url="https://doi.org/10.1055/s-0042-1760668", submitted_by=SUBMITTER,
    notes=(NOTE_PDF + "\n\nSource: open access (Thieme, CC BY-NC-ND 4.0). Serum methotrexate for high-dose therapy in acute lymphoblastic leukemia, validated following the "
           "US-FDA 2018 bioanalytical guidance and compared with the EMIT immunoassay on 10 paired patient samples (Bland–Altman). The internal standard is "
           "p-aminoacetophenone, a structural analogue, not a labelled methotrexate. Flow 0.4 mL/min at room temperature, run time 5 min, dwell 100 ms. "
           "Spray voltage 4000 V; sheath, auxiliary and sweep gas 50, 5 and 1 Arb; ion transfer tube 200 °C; vaporizer 400 °C. "
           "LC-MS/MS avoids the cross-reactivity of DAMPA (after glucarpidase rescue) seen with immunoassays.\n\n"
           "To check when reviewing — the article is internally inconsistent in several places: "
           "the methotrexate transition is printed as 455.1 → 308.1 (abstract), 455.1 → 308.3 (methods, stored here) and 455.5 → 308.25 (results), and the IS as 136.2 → 94.1 "
           "(stored) or 136.1 → 94.083; retention times are 0.33/0.48 min in one place and 0.34/0.46 min in another (0.33 and 0.48 stored), very early for a 5 min run; "
           "no collision energy is given; the gradient starts at 60% B and goes down to 20% B (as printed in Table 2); "
           "the column is printed “Acculaim 120”; the validated range is given as 0.09–12.5, 0.09–25 and 0.09–50 µM in different sections; "
           "the sample volume is 100 µL in the methods but 10 µL in Table 3; centrifugation is 2,000 rcf in the methods and 2,100 rcf in the results; "
           "dilution integrity is described as 1:10 in pooled serum in the methods and “1:5 in water” in Table 3; the printed accuracies do not match the printed means; "
           "recovery is only 40%."),
    gradient_steps=grad([(0.00, 60), (0.50, 60), (3.60, 20), (4.10, 20), (4.20, 60), (5.00, 60)], 0.4),
    mrm_transitions=[tr("Methotrexate", 455.1, 308.3, None, 0.33, 1, 0, "p-Aminoacetophenone", "ESI+", dwell_time_ms=100),
                     tr("p-Aminoacetophenone", 136.2, 94.1, None, 0.48, 1, 1, None, "ESI+", dwell_time_ms=100)],
)

if __name__ == "__main__":
    dry = "--dry" in sys.argv
    db = SessionLocal()
    client = TestClient(app)
    if db.query(Method).filter((Method.source_url == M["source_url"]) | (Method.title == M["title"])).first():
        print("already imported:", M["source_url"]); sys.exit(0)
    if dry:
        print("ok (dry):", len(M["mrm_transitions"]), len(M["gradient_steps"]), len(val), len(val[0]["notes"])); sys.exit(0)
    r = client.post("/api/methods/", json=M)
    if r.status_code != 200:
        print("FAILED", r.status_code, r.text[:300]); sys.exit(1)
    m = r.json()
    for v in val:
        db.add(CompoundValidation(method_id=m["id"], matrix=M["matrix"], **v))
    db.commit()
    print(f"queued id={m['id']} status={m['status']} transitions={len(m['mrm_transitions'])} gradient={len(m['gradient_steps'])} validation={len(val)} | {m['title'][:46]}")
