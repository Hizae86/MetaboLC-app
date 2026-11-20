"""One-off data migration: replace placeholder attributions with real provenance.

Background: the first methods were entered with invented submitter names and
real hospital names as placeholders. Every method was in fact transcribed by
the curator from a published source (application note, compendium, poster or
journal article). This script makes the data say so:

  * adds provenance columns: source_type, source_authors, source_url
  * records the curator as `submitted_by` (who transcribed and reviewed it)
  * clears the placeholder laboratory / country
  * for methods that already carried the source's real authors in
    `submitted_by`, moves them to `source_authors`
  * classifies `source_type` from the reference string

It is idempotent. Usage (from the repo root):

    python -m backend.scripts.migrate_sources path/to/metabolc.db "Curator Name"
"""
import re
import sqlite3
import sys

PLACEHOLDER_LABS = (
    "University Hospital Basel", "CHU Bordeaux", "Hospital Vall d'Hebron", "King's College Hospital",
    "Karolinska University Hospital", "Ospedale San Raffaele", "Tokyo Medical University", "Mayo Clinic",
)
NEW_COLUMNS = {"source_type": "VARCHAR(40)", "source_authors": "TEXT", "source_url": "VARCHAR(500)"}

# Sources located and compared against the stored method (title + transitions).
LOCATED = {
    68: dict(
        source_authors="Laura Owen, Brian Keevil",
        laboratory="University Hospital of South Manchester", country="United Kingdom",
        source_url="https://www.waters.com/nextgen/en/library/application-notes/2014/rapid-analytically-sensitive-lc-ms-method-simultaneous-analysis-panel-steroid-hormones-clinical-research.html",
    ),
    71: dict(
        laboratory="Agilent Technologies", country=None, source_authors=None,
        source_url="https://lcms.labrulez.com/labrulez-bucket-strapi-h3hsga3/an_tecan_steroid_panel_kit_6495_qqq_lcms_5994_8729en_agilent_1b277da864.pdf",
    ),
}


def classify(reference):
    r = (reference or "").strip()
    if not r:
        return None
    if re.search(r"poster|PO-CON|\bASMS\b|\bMSACL\b|\bAACC\b|^PO-\d", r, re.I):
        return "Conference poster"
    if re.search(r"compendium", r, re.I):
        return "Vendor compendium"
    if re.search(r"doi\.org|\b10\.\d{4,}/", r, re.I):
        return "Journal article"
    if re.search(r"application n|technical note|^7200\d{5}|\bAN[- ]?\d|599\d-\d{4}EN|RUO-MKT|MKT-\d|05-SCA|SSI-LCMS|LAAN-|^TN\d|^CFAN|^LCMS-\d|^\d{2}-\d{5}-EN", r, re.I):
        return "Application note"
    if re.search(r"\b(19|20)\d{2}\s*[;:(]\s*\d+|\bJ\b\.? |Clin |Chem|Anal|Monit|Chromatogr", r):
        return "Journal article"
    return None


def main(db_path, curator):
    con = sqlite3.connect(db_path)
    existing = {row[1] for row in con.execute("PRAGMA table_info(methods)")}
    for name, ddl in NEW_COLUMNS.items():
        if name not in existing:
            con.execute(f"ALTER TABLE methods ADD COLUMN {name} {ddl}")

    marks = ",".join("?" * len(PLACEHOLDER_LABS))
    # 1. Methods that already name the source's real authors: keep them, as authors.
    con.execute(
        f"""UPDATE methods SET source_authors = submitted_by
            WHERE source_authors IS NULL AND submitted_by IS NOT NULL AND submitted_by != ?
              AND (laboratory IS NULL OR laboratory NOT IN ({marks}))""",
        (curator, *PLACEHOLDER_LABS),
    )
    # 2. Placeholder attributions: remove.
    cleared = con.execute(
        f"UPDATE methods SET laboratory = NULL, country = NULL WHERE laboratory IN ({marks})", PLACEHOLDER_LABS
    ).rowcount
    # 3. The curator transcribed and reviewed every method.
    con.execute("UPDATE methods SET submitted_by = ?", (curator,))
    # 4. Source type from the reference; DOI references double as the link.
    for mid, ref in con.execute("SELECT id, reference FROM methods").fetchall():
        url = None
        m = re.search(r"https?://\S+", ref or "")
        if m:
            url = m.group(0).rstrip(".,)")
        con.execute(
            "UPDATE methods SET source_type = COALESCE(source_type, ?), source_url = COALESCE(source_url, ?) WHERE id = ?",
            (classify(ref), url, mid),
        )
    # 5. Sources located by hand.
    for mid, fields in LOCATED.items():
        sets = ", ".join(f"{k} = ?" for k in fields)
        con.execute(f"UPDATE methods SET {sets} WHERE id = ?", (*fields.values(), mid))
    con.commit()

    print(f"placeholder laboratories cleared: {cleared}")
    for row in con.execute("SELECT COALESCE(source_type, '(unclassified)'), COUNT(*) FROM methods GROUP BY 1 ORDER BY 2 DESC"):
        print(f"  {row[1]:>3}  {row[0]}")
    print("with source link:", con.execute("SELECT COUNT(*) FROM methods WHERE source_url IS NOT NULL").fetchone()[0])
    con.close()


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
