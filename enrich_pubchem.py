import sys, time, json, urllib.request, urllib.parse
sys.path.insert(0, '.')
from backend.database import SessionLocal
from backend.models import MRMTransition, Method

ADDUCTS = [
    ('M+H',    1.007276,  '+'),
    ('M+Na',   22.989218, '+'),
    ('M+NH4',  18.034164, '+'),
    ('M-H',   -1.007276,  '-'),
    ('M+Cl',   34.969402, '-'),
    ('M+FA-H', 44.997655, '-'),
]

def get_pubchem(name, retries=3):
    url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{urllib.parse.quote(name)}/property/MolecularFormula,ExactMass,IUPACName/JSON"
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'MetaboLC/1.0 (metabolc@lab.com) Python/3.x'
            })
            with urllib.request.urlopen(req, timeout=15) as r:
                data = json.loads(r.read())
                props = data.get('PropertyTable', {}).get('Properties', [{}])[0]
                return props if props.get('CID') else None
        except Exception as e:
            msg = str(e)
            if '503' in msg or '429' in msg or 'Too Many' in msg:
                wait = 3 * (2 ** attempt)
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
            else:
                return None
    return None

def best_adduct(exact_mass, precursor_mz, ion_mode='ESI+'):
    mode = '-' if 'ESI-' in (ion_mode or '') else '+'
    best_name, best_diff = None, 999
    for name, delta, m in ADDUCTS:
        if m != mode:
            continue
        diff = abs(exact_mass + delta - precursor_mz)
        if diff < best_diff:
            best_diff = diff
            best_name = name
    return best_name if best_diff < 0.1 else None

db = SessionLocal()

transitions = db.query(MRMTransition).filter(
    MRMTransition.pubchem_cid == None,
    MRMTransition.is_internal_standard == 0
).all()

unique = {}
for t in transitions:
    if t.compound_name not in unique:
        unique[t.compound_name] = t

print(f"Compounds to enrich: {len(unique)}")

for i, (name, t) in enumerate(unique.items()):
    print(f"[{i+1}/{len(unique)}] {name}...", end=' ', flush=True)

    props = get_pubchem(name)
    if not props:
        print("not found")
        db.query(MRMTransition).filter(
            MRMTransition.compound_name == name
        ).update({'pubchem_cid': -1})
        db.commit()
        time.sleep(1.0)
        continue

    exact_mass = float(props.get('ExactMass', 0))
    formula = props.get('MolecularFormula', '')
    cid = int(props.get('CID', 0))

    all_trans = db.query(MRMTransition).filter(
        MRMTransition.compound_name == name
    ).all()

    for tr in all_trans:
        tr.pubchem_cid = cid
        tr.pubchem_formula = formula
        tr.pubchem_exact_mass = exact_mass
        method = db.query(Method).filter(Method.id == tr.method_id).first()
        ion_mode = method.ionization_mode if method else 'ESI+'
        tr.pubchem_adduct = best_adduct(exact_mass, tr.precursor_mz, ion_mode)

    db.commit()
    print(f"{formula} | {exact_mass:.4f} Da | CID:{cid}")
    time.sleep(1.0)

db.close()
print("\nDone!")
