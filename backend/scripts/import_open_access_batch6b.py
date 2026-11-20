"""Batch 6b (2026-11-17): one open-access VAMS method on an Agilent 6460 (mycophenolic
acid and tacrolimus), completed with the article's supplementary file supplied by the
user (Table S1 transitions, Table S2 linearity, Table S3 plasma / whole-blood data).
Sent to the review queue as "submitted". Main-text values: two independent readings agreed.
Run once from the project root:  python -m backend.scripts.import_open_access_batch6b
"""
import sys
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import Method, CompoundValidation
from backend.scripts.import_open_access_batch2 import tr, grad, SUBMITTER, NOTE
from backend.scripts.import_validation_batch import rng, worst_acc

# Table S1 (supplement): name, Q1, Q3, CE, RT (main text), IS
JUA = [("Mycophenolic acid", 321.1, 207.1, 17, 1.24, "Mycophenolic acid-d3"), ("Tacrolimus", 821.5, 768.4, 17, 2.84, "Tacrolimus-13C,d2")]
JUA_IS = [("Mycophenolic acid-d3", 324.2, 210.1, 17, 1.24), ("Tacrolimus-13C,d2", 824.5, 771.5, 17, 2.84)]
# VAMS, Table 1 of the article: level, nominal ng/mL, accuracy %, RSD %, recovery, matrix effect with IS
JUA_V = {
 "Mycophenolic acid": ("10–20,000", 0.997, [("LLOQ", 10, 83.36, 2.88, "79.92", "105.70"), ("LQC", 20, 89.01, 3.68, "86.23", "111.52"),
                                            ("MQC", 200, 90.29, 4.48, "81.26", "103.68"), ("HQC", 2000, 99.16, 1.60, "91.02", "94.98")],
                       "Plasma (supplement, n = 3): accuracy 82.25–103.01%, RSD 1.53–5.21%, recovery 84.97–98.81%, matrix effect 64.70–76.39%. "
                       "Matrix effect on VAMS without internal standard correction 41.31–63.85%."),
 "Tacrolimus": ("0.5–500", 0.995, [("LLOQ", 0.5, 85.61, 7.68, "99.71", "103.02"), ("LQC", 1, 89.37, 4.51, "114.11", "104.99"),
                                   ("MQC", 10, 88.97, 3.14, "100.10", "98.84"), ("HQC", 100, 89.04, 2.07, "98.85", "95.30")],
                "Whole blood (supplement, n = 3): accuracy 85.94–100.95%, RSD 3.36–5.92%, recovery 87.55–96.86%, matrix effect 69.23–80.58%. "
                "Matrix effect on VAMS without internal standard correction 83.66–103.50%."),
}
jua_tr = ([tr(n, q1, q3, ce, rt, 1, 0, is_, "ESI+") for n, q1, q3, ce, rt, is_ in JUA]
          + [tr(n, q1, q3, ce, rt, 1, 1, None, "ESI+") for n, q1, q3, ce, rt in JUA_IS])
jua_val = [dict(compound_name=n, lod=None, loq=lv[0][1], r2=r2, cv_percent=max(l[3] for l in lv), accuracy_percent=worst_acc([l[2] for l in lv]),
                notes=(f"VAMS, intra-day only (n = 3), worst case over 4 levels ({', '.join(f'{l[0]} {l[1]:g}' for l in lv)} ng/mL). "
                       f"Accuracy {rng([l[2] for l in lv], 2)}%. RSD {rng([l[3] for l in lv], 2)}%. No inter-day data reported. "
                       f"Linear range {rg} ng/mL, weighted (1/x) quadratic; VAMS R² {r2} (supplement Table S2). "
                       f"Extraction recovery {', '.join(l[4] for l in lv)}%; matrix effect with IS {', '.join(l[5] for l in lv)}% (LLOQ to HQC). {extra}"))
           for n, (rg, r2, lv, extra) in JUA_V.items()]
M_JUA = dict(
    title="Evaluation of hematocrit-adjusted conversion strategies for mycophenolic acid and tacrolimus monitoring using volumetric absorptive microsampling in lung and renal transplant recipients",
    analyte="Mycophenolic acid, Tacrolimus", matrix="dried blood spot", clinical_application="Immunosuppressants", ionization_mode="ESI+",
    instrument_manufacturer="Agilent", instrument_model="6460 Triple Quad with 1290 UHPLC",
    column_brand="Waters", column_name="Acquity C18", column_stationary_phase="C18", column_length_mm=100, column_diameter_mm=2.1, column_particle_size_um=1.7,
    mobile_phase_a="2 mM ammonium acetate with 0.1% formic acid in water", mobile_phase_b="Acetonitrile/isopropanol (4:6, v/v)",
    capillary_voltage_v=4000, sheath_gas_heater_c=325, collision_gas="Nitrogen",
    sample_prep_method="Protein Precipitation (PPT)",
    sample_prep_details=("Volumetric absorptive microsampling (Mitra 20 µL, Neoteryx). Dry the tips in the dark at room temperature for at least 2 h; store at −20 °C.\n"
                         "1. Incubate the tip with 200 µL deionized water; mix 10 min at 1,000 rpm (Geno/Grinder).\n"
                         "2. Add 185 µL methanol with internal standards (final 200 ng/mL mycophenolate-d3, 40 ng/mL tacrolimus-13C-d2) and 10 µL 0.1 M zinc sulfate; mix 10 min at 1,000 rpm.\n"
                         "3. Centrifuge 10 min at 15,000 g.\n4. Filter the supernatant through a 0.22 µm RC-4 filter and inject.\n"
                         "Whole blood: same steps without the water. Plasma: 150 µL methanol with the same internal standards, same mixing and centrifugation."),
    validation_units="ng/mL",
    reference="Juan L, Cheng C-N, Chang W-C, Chiu H-H, Lu C-W, Hsu H-H, Kuo C-H, Tseng Y-J. J Pharm Pharm Sci. 2026;29:16123. doi:10.3389/jpps.2026.16123",
    source_type="Journal article", source_authors="Juan L, Cheng C-N, Chang W-C, Chiu H-H, Lu C-W, Hsu H-H, Kuo C-H, Tseng Y-J",
    source_url="https://doi.org/10.3389/jpps.2026.16123", submitted_by=SUBMITTER,
    notes=(NOTE + "\n\nSource: open access, CC BY; transitions from the article's supplementary file (Table S1). Dried whole blood collected with VAMS, stored under the dried blood spot matrix; "
           "the same assay also measures plasma MPA and whole-blood tacrolimus (data in the validation notes). The article's focus is hematocrit-adjusted conversion of VAMS results "
           "to plasma (MPA) and whole-blood (tacrolimus) concentrations in 21 lung and renal transplant recipients. Flow 0.3 mL/min. "
           "Source as printed: “ion spray voltage 4,000 V, sheath gas 40 psi at 325 °C, nitrogen as collision gas”; the 40 psi is kept here only because the app's sheath gas field is a flow.\n\n"
           "To check when reviewing: Table S1 labels the MPA transitions [M+NH4]+ and the tacrolimus transitions [M+H]+, but 321.1 matches protonated MPA and 821.5 the ammonium adduct "
           "of tacrolimus, so the labels look swapped — the m/z values are stored as printed; the same CE (17 eV) is printed for every transition; "
           "injection volume and column temperature are not reported; the gradient is from the text (50→100% B over 3 min, hold to 4.5 min, back to 50% B by 5.5 min) "
           "and the 50% B start at 0 min is implied; retention times are from the text (MPA 1.24 min, tacrolimus 2.84 min) and assigned to the internal standards too."),
    gradient_steps=grad([(0, 50), (3.0, 100), (4.5, 100), (5.5, 50)], 0.3), mrm_transitions=jua_tr,
)

BATCH = [(M_JUA, jua_val)]

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
