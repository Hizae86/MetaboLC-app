"""Fix transitions recorded as ESI+ whose precursor is a negative ion.

Found by backend/scripts/audit_transitions.py (2026-11-18). Each row below is set to ESI-
because its Q1 is the [M-H]- (or HSO4- / sulfate) ion of the compound, not a positive ion:
  29, 38  aldosterone 359.2 ([M-H]-, M 360.19) and d7-aldosterone 366.2
  40      DHEA-S 367.2 > 97 (HSO4-) and d6-DHEA-S
  49      EtS 125 and EtG 221 ([M-H]-) and their D5 standards
  51      barbiturates 211/223/225/231/237 ([M-H]-) with their d5 standards, and THC-COOH 343.1
          ([M-H]-, M 344.20; [M+H]+ would be 345.2) with THC-COOH-d3 346.1
  71      estradiol 271.2, estrone 269.2 and 13C3 standards; 17-OH-pregnenolone 331.2
          ([M-H]-, M 332.24; [M+H]+ would be 333.2) and its 13C2-D2 standard 335.3;
          DHEA-S 367.2 > 96.9 and its D5 standard 372.2 > 97.9.
          DHEA-S 271.2 > 253.1 stays ESI+: 271.2 is the in-source [M+H-H2SO4]+ ion.
  74, 76  estradiol 271.3, estrone 269.3 (and 13C3 standards in 74)
  81      aldosterone 359.2, estradiol 271.2, estrone 269.2, DHEAS 367.2 and their labelled standards
Only rows whose current polarity is ESI+ and whose Q1 matches are touched, so the script is idempotent.
Usage:  python3 -m backend.scripts.fix_transition_polarity [path/to/metabolc.db]
"""
import sqlite3, sys

FIXES = {  # method_id: [(transition id, expected Q1)]
    29: [(255, 359.2), (256, 359.2), (257, 366.2)],
    38: [(281, 359.2), (282, 359.2), (283, 366.2)],
    40: [(287, 367.2), (288, 373.2)],
    49: [(468, 125.1), (469, 125.1), (470, 130.1), (471, 221.2), (472, 221.2), (473, 226.2)],
    51: [(2534, 228.1), (2535, 242.1), (2536, 225.1), (2537, 225.1), (2538, 211.1), (2539, 211.1),
         (2540, 223.1), (2541, 223.1), (2542, 231.1), (2543, 231.1), (2544, 237.1), (2545, 237.1),
         (2546, 343.1), (2547, 343.1), (2533, 346.1)],
    71: [(3945, 271.2), (3946, 271.2), (3947, 274.2), (3948, 274.2), (3949, 269.2), (3950, 269.2),
         (3951, 272.2), (3952, 272.2), (3896, 331.2), (3897, 331.2), (3898, 335.3), (3899, 335.3),
         (3931, 367.2), (3933, 372.2)],
    74: [(4582, 271.3), (4583, 271.3), (4584, 274.3), (4585, 269.3), (4586, 269.3), (4587, 272.3)],
    76: [(4179, 271.3), (4180, 271.3), (4181, 271.3), (4182, 269.3), (4183, 269.3), (4184, 269.3)],
    81: [(4395, 359.2), (4396, 359.2), (4397, 366.1), (4410, 271.2), (4411, 271.2), (4412, 274.4),
         (4413, 269.2), (4414, 269.2), (4415, 273.1), (4422, 367.2), (4423, 367.2), (4424, 372.2)],
}


def main(db_path: str = "metabolc.db") -> None:
    con = sqlite3.connect(db_path)
    changed = skipped = 0
    for method_id, rows in FIXES.items():
        for tid, q1 in rows:
            r = con.execute("select method_id, precursor_mz, polarity, compound_name from mrm_transitions where id=?", (tid,)).fetchone()
            if not r or r[0] != method_id or abs(r[1] - q1) > 0.05:
                print(f"SKIP {tid}: row does not match (found {r})"); skipped += 1; continue
            if r[2] == "ESI-":
                continue
            con.execute("update mrm_transitions set polarity='ESI-' where id=?", (tid,))
            print(f"{method_id:>4} {tid:>5} {r[3]:<40} {r[1]:>7}  {r[2]} -> ESI-"); changed += 1
    con.commit()
    print(f"\n{changed} transitions changed, {skipped} skipped")
    if skipped:
        sys.exit(1)


if __name__ == "__main__":
    main(*sys.argv[1:])
