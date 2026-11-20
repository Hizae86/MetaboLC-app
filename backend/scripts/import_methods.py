import json, sys, glob, re, argparse
sys.path.insert(0, '.')
from backend.database import SessionLocal, engine
from backend.models import Base, Method, GradientStep, MRMTransition

Base.metadata.create_all(bind=engine)

VALID_COLUMNS = {c.key for c in Method.__table__.columns} - {'id', 'created_at', 'updated_at'}
VALID_T_COLUMNS = {c.key for c in MRMTransition.__table__.columns} - {'id', 'method_id'}
VALID_G_COLUMNS = {c.key for c in GradientStep.__table__.columns} - {'id', 'method_id'}

NUMERIC_FIELDS = {'column_length_mm','column_diameter_mm','column_particle_size_um',
                  'column_temperature_c','injection_volume_ul','autosampler_temperature_c',
                  'capillary_voltage_v','source_temperature_c','desolvation_temperature_c',
                  'desolvation_gas_flow','curtain_gas','lloq','uloq','cv_intra_percent',
                  'cv_inter_percent','recovery_percent','analyte_exact_mass',
                  'desolvation_gas_flow_lh','cone_gas_flow_lh','interface_voltage_kv',
                  'heating_gas_flow','dl_temperature','interface_temperature',
                  'nebulizing_gas','drying_gas','heat_block_temperature',
                  'ion_spray_voltage','gas1','gas2','gas_temperature',
                  'gas_flow_lmin','nebulizer_pressure_psi'}

def to_float(val):
    if val is None: return None
    if isinstance(val, (int, float)): return float(val)
    if isinstance(val, str):
        m = re.search(r'[\d.]+', val)
        if m:
            try: return float(m.group())
            except: return None
    return None

def fix_matrix(val):
    if not val: return 'other'
    val = val.lower().strip()
    if 'plasma' in val: return 'plasma'
    if 'serum' in val: return 'serum'
    if 'urine' in val: return 'urine'
    if 'whole blood' in val or 'blood' in val: return 'whole blood'
    if 'dbs' in val or 'dried' in val: return 'dried blood spot'
    if 'csf' in val or 'cerebrospinal' in val: return 'CSF'
    if 'saliva' in val or 'oral' in val: return 'saliva'
    if 'hair' in val or 'tissue' in val: return 'tissue'
    return 'other'

def fix_ionization(val):
    if not val: return 'ESI+'
    val = val.upper()
    if 'ESI+' in val and 'ESI-' in val: return 'ESI+/ESI- (polarity switching 50ms)'
    if 'ESI+' in val or 'POSITIVE' in val: return 'ESI+'
    if 'ESI-' in val or 'NEGATIVE' in val: return 'ESI-'
    if 'APCI+' in val: return 'APCI+'
    if 'APCI-' in val: return 'APCI-'
    if 'APCI' in val or 'DUIS' in val: return 'APCI+'
    return 'ESI+'

def fix_entry(entry):
    entry['matrix'] = fix_matrix(entry.get('matrix'))
    entry['ionization_mode'] = fix_ionization(entry.get('ionization_mode'))
    if not entry.get('column_brand'): entry['column_brand'] = 'Not specified'
    if not entry.get('column_name'): entry['column_name'] = 'Not specified'
    if not entry.get('instrument_manufacturer'): entry['instrument_manufacturer'] = 'Other'
    if not entry.get('instrument_model'): entry['instrument_model'] = 'Not specified'
    for field in NUMERIC_FIELDS:
        if field in entry:
            entry[field] = to_float(entry[field])
    return entry

def clean(entry, valid):
    return {k: v for k, v in entry.items() if k in valid}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('pattern', help='Glob pattern e.g. "sciex_1.json" or "Agilent_*.json"')
    args = parser.parse_args()

    all_methods = []
    for f in sorted(glob.glob(args.pattern)):
        with open(f) as fp:
            try:
                data = json.load(fp)
                items = data if isinstance(data, list) else [data]
                all_methods.extend(items)
                print(f"  {f}: {len(items)} method(s)")
            except Exception as e:
                print(f"  {f}: ERROR — {e}")

    if not all_methods:
        print("No methods found. Check the file pattern.")
        sys.exit(1)

    print(f"\nTotal to import: {len(all_methods)}")

    db = SessionLocal()
    try:
        for i, entry in enumerate(all_methods):
            gradient = entry.pop('gradient_steps', []) or []
            transitions = entry.pop('mrm_transitions', []) or []
            fix_entry(entry)
            method = Method(**clean(entry, VALID_COLUMNS))
            db.add(method)
            db.flush()
            for step in gradient:
                if step and step.get('time_min') is not None and step.get('percent_b') is not None:
                    db.add(GradientStep(method_id=method.id, **clean(step, VALID_G_COLUMNS)))
            for t in transitions:
                if t and t.get('precursor_mz') and t.get('product_mz'):
                    db.add(MRMTransition(method_id=method.id, **clean(t, VALID_T_COLUMNS)))
            print(f"  [{i+1}/{len(all_methods)}] {method.analyte_normalized} — {len(transitions)} transitions")
        db.commit()
        total = db.query(Method).count()
        total_t = db.query(MRMTransition).count()
        print(f"\nDone! Total in DB: {total} methods, {total_t} transitions")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
