"""One-off script: copies all data from the local metabolc.db SQLite file
into a managed Postgres database (e.g. a Render Postgres instance).

Why this doesn't just call Base.metadata.create_all()
-------------------------------------------------------
The live metabolc.db has several columns that are NOT declared in
backend/models.py's SQLAlchemy classes (found while preparing this
migration): on `methods` — verified_by, verified_at, capillary_temp_c,
s_lens_rf_level, data_acquisition_mode, fullms_resolution,
fullms_scan_range, ddms2_resolution, ddms2_isolation_window, nce_stepped —
and on `mrm_transitions` — is_derivatized. Using the SQLAlchemy models to
build the Postgres schema would silently create tables missing those
columns, and this migration would either drop that data or crash outright.

So this script reads the SQLite file's own schema with PRAGMA table_info()
and builds the Postgres tables from THAT — the live database is the source
of truth here, not models.py. (Fixing that drift in models.py itself is a
separate, worthwhile task — see the note this script prints at the end.)

Deliberate simplifications for a one-off historical copy
----------------------------------------------------------
- No NOT NULL constraints and no DEFAULT values are replicated in the
  Postgres schema. Every row is copied explicitly with every column's
  actual value, so neither is needed for the copy itself, and the app's
  own Pydantic/SQLAlchemy layer continues to enforce required fields and
  defaults for any *new* rows created after the migration.
- Primary key columns become SERIAL (auto-incrementing) in Postgres, and
  existing IDs are inserted as-is; the sequence is reset to MAX(id)
  afterwards so new rows keep incrementing correctly.
- method_id foreign keys get ON DELETE CASCADE, matching the
  cascade="all, delete-orphan" behaviour already declared in models.py.

Usage
-----
    # 1. Point this at your new Postgres instance (get this URL from your
    #    provider's dashboard):
    export DATABASE_URL="postgresql://user:pass@host/dbname"

    # 2. Run from the project root, with your virtualenv active:
    python -m backend.migrate_sqlite_to_postgres

    # Re-running on a destination that already has data is refused unless
    # you pass --force (use that only if you really mean to insert on top
    # of existing rows).
"""
import argparse
import os
import sqlite3
import sys

import psycopg2
from psycopg2.extras import execute_values

# Parents before children — required for the foreign keys below.
TABLES = ["methods", "gradient_steps", "mrm_transitions", "compound_validation", "method_confirmations"]

# Every child table here hangs off methods.id via a `method_id` column.
PARENT_FK = {
    "gradient_steps": "methods",
    "mrm_transitions": "methods",
    "compound_validation": "methods",
    "method_confirmations": "methods",
}


def pg_type(sqlite_type: str) -> str:
    t = (sqlite_type or "").upper()
    if t.startswith("VARCHAR"):
        return t  # VARCHAR(n) / VARCHAR are valid Postgres types as-is
    if t in ("FLOAT", "REAL", "DOUBLE"):
        return "DOUBLE PRECISION"
    if t == "DATETIME":
        return "TIMESTAMP"
    if t == "TEXT":
        return "TEXT"
    if t == "INTEGER":
        return "INTEGER"
    return "TEXT"  # safe fallback for any type this script doesn't expect


def build_create_table_sql(table: str, columns: list) -> str:
    """columns: list of (name, sqlite_type, is_pk) tuples, source order."""
    col_defs = []
    for name, sqlite_type, is_pk in columns:
        if is_pk:
            col_defs.append(f'"{name}" SERIAL PRIMARY KEY')
        else:
            col_defs.append(f'"{name}" {pg_type(sqlite_type)}')
    if table in PARENT_FK:
        parent = PARENT_FK[table]
        col_defs.append(f'FOREIGN KEY ("method_id") REFERENCES "{parent}"("id") ON DELETE CASCADE')
    return f'CREATE TABLE IF NOT EXISTS "{table}" (\n  ' + ",\n  ".join(col_defs) + "\n)"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sqlite-path", default="metabolc.db", help="Path to the source SQLite file")
    parser.add_argument("--force", action="store_true",
                         help="Insert even if the destination 'methods' table already has rows")
    args = parser.parse_args()

    database_url = os.getenv("DATABASE_URL", "")
    if "postgres" not in database_url:
        sys.exit(
            "Set DATABASE_URL to your Postgres connection string first, e.g.\n"
            '  DATABASE_URL="postgresql://user:pass@host/dbname" python -m backend.migrate_sqlite_to_postgres'
        )
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    if not os.path.exists(args.sqlite_path):
        sys.exit(f"SQLite file not found: {args.sqlite_path}")

    print(f"Source (SQLite):        {args.sqlite_path}")
    print(f"Destination (Postgres): ...@{database_url.split('@')[-1]}")  # never print credentials

    sconn = sqlite3.connect(args.sqlite_path)
    scur = sconn.cursor()

    pconn = psycopg2.connect(database_url)
    pconn.autocommit = False
    pcur = pconn.cursor()

    table_columns = {}
    for table in TABLES:
        scur.execute(f"PRAGMA table_info({table})")
        info = scur.fetchall()  # (cid, name, type, notnull, dflt_value, pk)
        if not info:
            print(f"  (skipping '{table}': not found in {args.sqlite_path})")
            continue
        table_columns[table] = [(row[1], row[2], row[5]) for row in info]
        pcur.execute(build_create_table_sql(table, table_columns[table]))
    pconn.commit()
    print("Postgres schema ready.\n")

    pcur.execute("SELECT COUNT(*) FROM methods")
    existing = pcur.fetchone()[0]
    if existing and not args.force:
        pcur.close(); pconn.close(); sconn.close()
        sys.exit(
            f"Destination 'methods' table already has {existing} row(s) — refusing to insert on top "
            "of it. Re-run with --force if that's really what you want."
        )

    sqlite_counts = {}
    for table, cols in table_columns.items():
        names = [c[0] for c in cols]
        scur.execute(f"SELECT {', '.join(names)} FROM {table}")
        rows = [tuple(r) for r in scur.fetchall()]
        sqlite_counts[table] = len(rows)
        if rows:
            col_list = ", ".join(f'"{n}"' for n in names)
            execute_values(pcur, f'INSERT INTO "{table}" ({col_list}) VALUES %s', rows, page_size=500)
        if any(is_pk for _, _, is_pk in cols):
            pcur.execute(
                f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM \"{table}\"), 1))"
            )
        print(f"  {table}: copied {len(rows)} rows")
    pconn.commit()

    print("\nVerifying row counts...")
    all_match = True
    for table, n in sqlite_counts.items():
        pcur.execute(f'SELECT COUNT(*) FROM "{table}"')
        got = pcur.fetchone()[0]
        status_label = "OK" if got == n else "MISMATCH"
        print(f"  {table}: sqlite={n} postgres={got}  [{status_label}]")
        all_match = all_match and (got == n)

    pcur.close(); pconn.close(); sconn.close()

    if not all_match:
        print("\nSome counts don't match — do not switch the app over until this is resolved.")
        sys.exit(1)

    print(
        "\nMigration complete. The app will start using Postgres as soon as DATABASE_URL\n"
        "is set in its environment (see database.py — it already reads that variable).\n"
        "\n"
        "Separate, unrelated finding: backend/models.py's Method and MRMTransition classes\n"
        "are missing the columns listed at the top of this file, even though they exist in\n"
        "the live database (this script copied them anyway, straight from SQLite's schema).\n"
        "Worth fixing in models.py at some point so the ORM can read/write them too, but it\n"
        "wasn't needed for this migration and is left for you to decide separately."
    )


if __name__ == "__main__":
    main()
