"""Small, idempotent schema upgrades applied when the API starts.

MetaboLC has no migration tool yet. Columns added to models.py after a
database was created must also exist in that database, or every query on the
table fails. This adds the missing ones (never drops or changes anything), so
a fresh deployment or another copy of the database keeps working.
"""
from sqlalchemy import inspect, text

from backend.database import engine

# table -> [(column, SQL type)] added after the first release of the schema
ADDED_COLUMNS = {
    "methods": [
        ("ion_mobility_device", "VARCHAR(100)"),
        ("im_separation_voltage_v", "FLOAT"),
        ("im_compensation_voltage_v", "FLOAT"),
        ("im_offset_v", "FLOAT"),
        ("im_temperature_c", "FLOAT"),
        ("im_resolution", "VARCHAR(50)"),
        ("im_modifier", "VARCHAR(100)"),
    ],
    "mrm_transitions": [
        ("review_checked", "INTEGER DEFAULT 0"),
    ],
    "validation_waitlist": [
        ("modules", "VARCHAR(200)"),
    ],
    "method_confirmations": [
        ("outcome", "VARCHAR(20)"),
        ("changes", "VARCHAR(500)"),
        ("status", "VARCHAR(20)"),
    ],
}


def apply() -> list[str]:
    insp = inspect(engine)
    added = []
    with engine.begin() as conn:
        for table, cols in ADDED_COLUMNS.items():
            if not insp.has_table(table):
                continue
            have = {c["name"] for c in insp.get_columns(table)}
            for name, sqltype in cols:
                if name not in have:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {sqltype}"))
                    added.append(f"{table}.{name}")
    return added
