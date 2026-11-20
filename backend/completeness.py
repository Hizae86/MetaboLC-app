"""Method completeness: can a laboratory set the method up from this record?

Single source of truth for the score shown in the library and on the method page.
Balanced on purpose: a method with transitions, an internal standard, source temperature and
voltage, chromatography and at least one LOQ is "ready to run" even if secondary details
(a secondary gas, R² for every analyte, column temperature) are missing.

Sections (100):  MS acquisition 35 · Chromatography 25 · Ion source 15 · Sample prep 10 ·
                 Validation 10 · Identification & source 5
Bands:           85–100 ready to run · 60–84 partially usable · <60 reference only
Caps:            no MRM transitions, or neither column nor mobile phases → at most 59;
                 column, mobile phases or gradient missing → at most 84.
"""
import re

READY, PARTIAL = 85, 60

VOLTAGE_FIELDS = ['ion_spray_voltage', 'capillary_voltage_v', 'capillary_voltage_pos_v', 'capillary_voltage_neg_v', 'interface_voltage_kv']
TEMPERATURE_FIELDS = ['source_temperature_c', 'desolvation_temperature_c', 'vaporizer_temp_c', 'ion_transfer_tube_temp_c', 'capillary_temp_c',
                      'interface_temperature', 'dl_temperature', 'heat_block_temperature', 'gas_temperature', 'sheath_gas_heater_c']
OTHER_SOURCE_FIELDS = ['gas1', 'gas2', 'curtain_gas', 'collision_gas', 'desolvation_gas_flow_lh', 'cone_gas_flow_lh', 'desolvation_gas_flow',
                       'sheath_gas_flow_lmin', 'aux_gas_flow', 'sweep_gas_flow', 'nebulizing_gas', 'drying_gas', 'heating_gas_flow',
                       'gas_flow_lmin', 'nebulizer_pressure_psi', 'nozzle_voltage_v']

# Text that shows an internal standard is specified, e.g. "d4-cortisol is used as internal standard".
IS_TEXT = re.compile(r'internal standard|\bISTDs?\b|\bI\.S\.|deuterat|stable[- ]isotope|isotop\w* label|label+ed|'
                     r'(?:^|[\s(,;-])d\d{1,2}(?:-|\b)|-d\d{1,2}\b|13C|15N|\[2H', re.I)


def _has(v):
    return v is not None and v != '' and not (isinstance(v, str) and not v.strip())


def _val(m, f):
    return getattr(m, f, None)


def _section(key, label, maximum):
    return {'key': key, 'label': label, 'earned': 0, 'max': maximum, 'missing': []}


def evaluate(m) -> dict:
    sections, caps = [], []

    # ── MS acquisition (35) ────────────────────────────────────────────────────────────────
    s = _section('mrm', 'MRM & IS', 35)
    trans = list(getattr(m, 'mrm_transitions', None) or [])
    analyte = [t for t in trans if not t.is_internal_standard]
    quant = [t for t in analyte if t.is_quantifier] or analyte
    if quant:
        s['earned'] += 15
        ce = sum(1 for t in quant if t.collision_energy_ev is not None) / len(quant)
        rt = sum(1 for t in quant if t.retention_time_min is not None) / len(quant)
        if ce >= 0.8: s['earned'] += 8
        elif ce > 0: s['earned'] += 4; s['missing'].append('Collision energy for some compounds')
        else: s['missing'].append('Collision energies')
        if rt >= 0.5: s['earned'] += 4
        elif rt > 0: s['earned'] += 2; s['missing'].append('Retention time for some compounds')
        else: s['missing'].append('Retention times')
    else:
        s['missing'].append('MRM transitions')
        caps.append((59, 'No MRM transitions'))
    is_given = (any(t.is_internal_standard for t in trans) or any(_has(t.assigned_is) for t in trans)
                or any(IS_TEXT.search(_val(m, f) or '') for f in ('sample_prep_details', 'notes')))
    if is_given: s['earned'] += 8
    else: s['missing'].append('Internal standard')
    sections.append(s)

    # ── Chromatography (25) ────────────────────────────────────────────────────────────────
    s = _section('chromatography', 'Chromatography', 25)
    grad = list(getattr(m, 'gradient_steps', None) or [])
    has_col = _has(m.column_name) or _has(m.column_brand)
    has_mp = _has(m.mobile_phase_a) and _has(m.mobile_phase_b)
    if has_col: s['earned'] += 7
    else: s['missing'].append('Column')
    if has_mp: s['earned'] += 6
    else: s['missing'].append('Mobile phases A & B')
    if grad: s['earned'] += 8
    else: s['missing'].append('Gradient program')
    if any(g.flow_rate_ml_min for g in grad): s['earned'] += 2
    else: s['missing'].append('Flow rate')
    if _has(m.column_temperature_c): s['earned'] += 2
    else: s['missing'].append('Column temperature')
    if not has_col and not has_mp:
        caps.append((59, 'No column or mobile phases'))
    elif not (has_col and has_mp and grad):
        caps.append((84, 'Column, mobile phases or gradient missing'))
    sections.append(s)

    # ── Ion source (15): voltage + one temperature is enough; secondary gases are a bonus, never a penalty
    s = _section('ms_source', 'Ion source', 15)
    volt = any(_has(_val(m, f)) for f in VOLTAGE_FIELDS)
    temp = any(_has(_val(m, f)) for f in TEMPERATURE_FIELDS)
    other = any(_has(_val(m, f)) for f in OTHER_SOURCE_FIELDS)
    if volt and temp: s['earned'] = 15
    elif volt or temp or other:
        s['earned'] = 8
        s['missing'].append('Source temperature' if volt else 'Ionisation voltage' if temp else 'Ionisation voltage and source temperature')
    else: s['missing'].append('Ion source settings')
    sections.append(s)

    # ── Sample preparation (10) ────────────────────────────────────────────────────────────
    s = _section('sample_prep', 'Sample prep', 10)
    if _has(m.sample_prep_method): s['earned'] += 5
    else: s['missing'].append('Sample prep technique')
    if len(m.sample_prep_details or '') > 50: s['earned'] += 5
    else: s['missing'].append('Sample prep protocol')
    sections.append(s)

    # ── Validation (10): one LOQ (method-level or for any compound) earns the base ────────────
    s = _section('validation', 'Validation', 10)
    vals = list(getattr(m, 'compound_validations', None) or [])
    if _has(m.lloq) or any(v.loq is not None for v in vals): s['earned'] += 7
    elif any(v.lod is not None for v in vals): s['earned'] += 4; s['missing'].append('LOQ (only LOD reported)')
    else: s['missing'].append('LOQ')
    if (_has(m.cv_intra_percent) or _has(m.cv_inter_percent)
            or any(v.cv_percent is not None or v.accuracy_percent is not None or v.r2 is not None for v in vals)):
        s['earned'] += 3
    else: s['missing'].append('Precision, accuracy or linearity')
    sections.append(s)

    # ── Identification & source (5) ────────────────────────────────────────────────────────
    s = _section('source', 'Identification & source', 5)
    if _has(m.analyte): s['earned'] += 1
    else: s['missing'].append('Analyte')
    if _has(m.matrix): s['earned'] += 1
    else: s['missing'].append('Matrix')
    if _has(m.reference) or _has(m.source_url): s['earned'] += 3
    else: s['missing'].append('Reference / DOI')
    sections.append(s)

    raw = sum(x['earned'] for x in sections)
    cap = min([c for c, _ in caps], default=100)
    score = min(raw, cap)
    for x in sections:
        x['status'] = 'complete' if x['earned'] == x['max'] else 'partial' if x['earned'] > 0 else 'missing'
    band = 'ready' if score >= READY else 'partial' if score >= PARTIAL else 'reference'
    return {'score': score, 'raw_score': raw, 'band': band,
            'capped_by': [r for c, r in caps if c == cap and raw > cap], 'sections': sections}


def calc_completeness(m) -> int:
    return evaluate(m)['score']
