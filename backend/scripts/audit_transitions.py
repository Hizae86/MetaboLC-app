"""Audit every MRM transition with the same rules as frontend/src/lib/massSpec.ts (checkTransition):
product heavier than a singly charged precursor, transition polarity vs method ionization mode, and
Q1 vs the adducts of the PubChem monoisotopic mass (same polarity expected).
Read-only. Writes a CSV report:  python3 -m backend.scripts.audit_transitions [out.csv]
"""
import csv, re, sqlite3, sys

E = 0.000548579909
ADDUCTS = [  # name, mode, charge, delta
    ('[M+H]+', '+', 1, 1.007276), ('[M+Na]+', '+', 1, 22.989218), ('[M+K]+', '+', 1, 38.963158), ('[M+NH4]+', '+', 1, 18.034164),
    ('[M+2H]2+', '+', 2, 2.014552), ('[M+H+Na]2+', '+', 2, 23.996494), ('[M+2Na]2+', '+', 2, 45.978436), ('[M+Li]+', '+', 1, 7.016003),
    ('[M+ACN+H]+', '+', 1, 42.033825), ('[M+2ACN+H]+', '+', 1, 83.060399), ('[M+MeOH+H]+', '+', 1, 33.034164),
    ('[M-H2O+H]+', '+', 1, -16.987484), ('[M+H-NH3]+', '+', 1, -16.018724), ('[M]+', '+', 1, -E),
    ('[M-H]-', '-', 1, -1.007276), ('[M+Cl]-', '-', 1, 34.969402), ('[M+HCOO]-', '-', 1, 44.997655), ('[M+CH3COO]-', '-', 1, 59.013305),
    ('[M-2H]2-', '-', 2, -2.014552), ('[M-H2O-H]-', '-', 1, -19.01784), ('[M+Na-2H]-', '-', 1, 20.974666), ('[M+K-2H]-', '-', 1, 36.948606),
    ('[M+Br]-', '-', 1, 78.918338), ('[M]-', '-', 1, E),
]


def polarity_of(p):
    if not p:
        return None
    s = str(p).replace('−', '-').strip()
    if re.search(r'polarity|\+\s*/\s*-', s, re.I):
        return None
    return '+' if s.endswith('+') else '-' if s.endswith('-') else None


def check(t, method_ion, tol=0.5):
    out = []
    q1, q3 = t['precursor_mz'], t['product_mz']
    if q1 is None or q3 is None:
        return out
    pol = polarity_of(t['polarity'])
    if not t['polarity']:
        out.append(('warning', 'no-polarity', 'Polarity not set'))
    mp = polarity_of(method_ion)
    if pol and mp and pol != mp:
        out.append(('warning', 'method-polarity', f'transition {pol} vs method {method_ion}'))
    M = t['pubchem_exact_mass']
    skip = bool(t['is_internal_standard'] or t['is_derivatized'] or t['derivative'] or not M)
    matches = [] if skip else sorted([(n, mo, z, (M + d) / z) for n, mo, z, d in ADDUCTS if abs(q1 - (M + d) / z) <= tol], key=lambda x: abs(q1 - x[3]))
    multi = any(z > 1 for _, _, z, _ in matches)
    if abs(q3 - q1) <= 0.05:
        out.append(('info', 'pseudo', 'Q1 = Q3'))
    elif q3 > q1:
        out.append(('info' if multi else 'error' if not skip else 'warning', 'product-heavier', f'Q3 {q3} > Q1 {q1}'))
    if not skip and pol:
        same = [m for m in matches if m[1] == pol]
        other = [m for m in matches if m[1] != pol]
        if not same and other:
            out.append(('error', 'adduct-polarity', f'Q1 {q1} matches {other[0][0]} ({other[0][3]:.4f}) but transition is {pol}'))
        elif not matches:
            out.append(('info', 'adduct-unmatched', f'Q1 {q1} matches no adduct of M={M:.4f}'))
    return out


def main(out_path):
    c = sqlite3.connect('file:metabolc.db?mode=ro', uri=True)
    c.row_factory = sqlite3.Row
    rows = c.execute("""select t.*, m.ionization_mode, m.status, m.title from mrm_transitions t join methods m on m.id = t.method_id
                        where m.status != 'rejected' order by t.method_id, t.id""").fetchall()
    found = []
    for t in rows:
        for level, code, msg in check(t, t['ionization_mode']):
            found.append((t['method_id'], t['status'], t['compound_name'], t['precursor_mz'], t['product_mz'], t['polarity'],
                          t['ionization_mode'], t['pubchem_exact_mass'], level, code, msg))
    with open(out_path, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['method_id', 'status', 'compound', 'q1', 'q3', 'polarity', 'method_ionization', 'pubchem_mass', 'level', 'check', 'message'])
        w.writerows(found)
    from collections import Counter
    print(len(rows), 'transitions checked;', len(found), 'findings')
    print(Counter((f[8], f[9]) for f in found).most_common())
    print('methods with errors:', sorted({f[0] for f in found if f[8] == 'error'}))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'transition_audit.csv')
