"""One-off data migration: make "verified" mean "checked against its source".

* Methods from the initial seed batch (created 2026-07-23) cite references
  that could not be located, so they lose the verified badge until their
  source document is found. They stay published as "pending".
* Methods that keep the badge record who verified them (the curator who
  transcribed and checked them). The verification date was never stored,
  so it stays empty rather than being invented.

Idempotent. Usage (from the repo root):

    python -m backend.scripts.apply_verification_policy path/to/metabolc.db "Reviewer Name"
"""
import sqlite3
import sys

INITIAL_BATCH_DAY = "2026-07-23"


def main(db_path, reviewer):
    con = sqlite3.connect(db_path)
    unverified = con.execute(
        "UPDATE methods SET status = 'pending', verified_by = NULL, verified_at = NULL "
        "WHERE status = 'verified' AND date(created_at) = ?", (INITIAL_BATCH_DAY,)
    ).rowcount
    credited = con.execute(
        "UPDATE methods SET verified_by = ? WHERE status = 'verified' AND (verified_by IS NULL OR verified_by IN ('', 'Admin'))",
        (reviewer,),
    ).rowcount
    con.commit()
    print(f"badge removed (initial batch, source not located): {unverified}")
    print(f"verified methods credited to {reviewer}: {credited}")
    for row in con.execute("SELECT status, COUNT(*) FROM methods GROUP BY 1 ORDER BY 1"):
        print(f"  {row[1]:>3}  {row[0]}")
    con.close()


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
