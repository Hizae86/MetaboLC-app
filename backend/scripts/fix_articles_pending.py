"""Verify and correct pending methods 27, 85 and 117 against their sources.

27  Waters application note 720003388 (Roberts & Wood, 2010) — not a journal article. Table 1 (image) read in full.
85  Hedman et al., J Chromatogr B 2014;953-954:62-67 (PMC4050665). The article reports no MRM transitions.
117 Phipps et al., JIMD Reports 2020;51:62-69 (PMC7012744). Table 1 read; Tables S1/S2 (gradient, SRM) are in a
    supplement that could not be opened, so the stored gradient and transitions are kept but flagged as unverified.
Run from the repo root:  python3 backend/scripts/fix_articles_pending.py [--dry]
"""
import sqlite3, sys

DB = 'metabolc.db'

# 27 · Table 1: name, cone, Q1, P1, CE1, P2, CE2, IS, LOD ng/mL, matrix effect %, ME RSD %, recovery %
T27 = [
    ('7-Aminoclonazepam', 53, 286, 121, 31, 222, 24, '7-Aminoclonazepam-d4', 1, 0, 2, 62),
    ('7-Aminoflunitrazepam', 50, 284, 135, 28, 227, 27, '7-Aminoflunitrazepam-d7', 1, 1, 4, 73),
    ('alpha-Hydroxyalprazolam', 55, 325, 297, 26, 205, 44, 'alpha-Hydroxyalprazolam-d5', 1, 1, 6, 66),
    ('alpha-Hydroxymidazolam', 35, 342, 324, 20, 203, 25, 'Nitrazepam-d5', 1, -13, 12, 70),
    ('alpha-Hydroxytriazolam', 50, 359, 331, 27, 176, 27, 'alpha-Hydroxytriazolam-d4', 1, -4, 7, 69),
    ('Alprazolam', 50, 309, 281, 26, 205, 43, 'Alprazolam-d5', 1, -4, 5, 72),
    ('Bromazepam', 43, 316, 182, 32, 209, 26, 'Nitrazepam-d5', 1, -1, 7, 70),
    ('Chlordiazepoxide', 35, 300, 283, 15, 227, 25, 'Nitrazepam-d5', 1, -7, 7, 70),
    ('Clonazepam', 55, 316, 270, 24, 214, 39, 'Clonazepam-d4', 1, 2, 6, 74),
    ('Diazepam', 50, 285, 154, 28, 193, 32, 'Diazepam-d5', 1, -21, 27, 89),
    ('Estazolam', 50, 295, 267, 25, 205, 40, 'Estazolam-d5', 1, -1, 6, 72),
    ('Flunitrazepam', 50, 314, 268, 24, 239, 34, 'Flunitrazepam-d7', 1, 6, 7, 73),
    ('Lorazepam', 40, 321, 275, 25, 229, 25, 'Oxazepam-d5', 5, -1, 5, 74),
    ('Lormetazepam', 35, 335, 289, 20, 177, 40, 'Nordiazepam-d5', 1, 5, 7, 71),
    ('Midazolam', 50, 326, 291, 26, 244, 26, '7-Aminoflunitrazepam-d7', 1, -28, 30, 83),
    ('Nitrazepam', 45, 282, 236, 25, 180, 35, 'Nitrazepam-d5', 1, 0, 4, 69),
    ('Nordiazepam', 45, 271, 140, 25, 165, 27, 'Nordiazepam-d5', 5, -5, 11, 71),
    ('Oxazepam', 40, 287, 241, 19, 269, 15, 'Oxazepam-d5', 5, -5, 7, 69),
    ('Prazepam', 40, 325, 271, 25, 140, 27, 'Prazepam-d5', 1, -25, 25, 78),
    ('Temazepam', 35, 301, 255, 22, 283, 15, 'Nordiazepam-d5', 5, -2, 4, 73),
    ('Triazolam', 56, 343, 308, 26, 239, 44, 'Triazolam-d4', 1, -1, 5, 72),
    ('Zolpidem', 57, 308, 235, 32, 263, 26, 'Zolpidem-d6', 1, -11, 12, 87),
    ('Zopiclone', 25, 389, 245, 27, 217, 35, '7-Aminoclonazepam-d4', 1, -26, 28, 62),
]
G27 = [(0.0, 30, 'Initial'), (2.5, 65, '6'), (3.25, 70, '6'), (4.5, 77, '6'), (4.55, 95, '6'), (5.55, 95, '6'), (5.6, 30, '6'), (7.5, 30, '6')]

# 117 · Table 1: name, IS, LLOQ, CV at LLOQ, ULOQ, CV at ULOQ, R2, intrarun low/high/plasma, inter-run low/high/plasma (None = not performed)
T117 = [
    ('Alanine', 'Ala', 5, 16.0, 2000, 3.1, 1.00, (1.8, 0.88, 3.1), (6.6, 3.6, 5.8)),
    ('Arginine', 'Arg', 5, 14.6, 2000, 1.1, 1.00, (5.1, 7.1, 4.5), (6.3, 4.9, 8.4)),
    ('Argininosuccinic acid', 'Thr', 10, 15.7, 2000, 1.2, 1.00, (1.3, 4.4, 6.8), (5.2, 4.6, None)),
    ('Asparagine', 'Thr', 5, 7.0, 2000, 2.2, 1.00, (3.4, 2.5, 4.7), (2.9, 2.4, 13)),
    ('Aspartic acid', 'Asp', 5, 2.4, 2000, 1.7, 1.00, (1.5, 4.4, 4.2), (9.8, 4.8, 16.2)),
    ('Citrulline', 'Gly', 5, 2.8, 2000, 2.2, 1.00, (2.2, 7.6, 4.5), (9.2, 4.5, 3.7)),
    ('Cystine', 'Cys', 2.5, 5.1, 1000, 6.9, 0.99, (2.6, 2.1, 2.9), (4.3, 4.1, 8.5)),
    ('Glutamic acid', 'Glu', 5, 7.8, 2000, 5.3, 1.00, (4.9, 3.9, 3.1), (3.3, 3.9, 7.7)),
    ('Glutamine', 'Gly', 5, 13.0, 2000, 2.6, 1.00, (1.9, 1.4, 10.4), (7.1, 5.7, 11.2)),
    ('Glycine', 'Gly', 5, 12.0, 2000, 2.3, 0.93, (2.8, 3.1, 5.1), (6.2, 8.5, 5)),
    ('Homocitrulline', 'Lys', 5, 5.9, 2000, 5.8, 1.00, (None, None, None), (4.8, 7.1, 4.7)),
    ('Homocystine', 'Pro', 5, 19.1, 2000, 1.1, 1.00, (2.7, 3.1, None), (7.5, 7.1, None)),
    ('Histidine', 'His', 5, 8.8, 2000, 0.8, 1.00, (4.2, 3.1, 3.9), (8.9, 3.2, 2.6)),
    ('Isoleucine', 'Ile', 5, 5.3, 2000, 11.5, 0.99, (0.8, 1.4, 4.9), (5.4, 5.7, 6.5)),
    ('Leucine', 'Leu', 10, 2.5, 2000, 8.4, 0.99, (9.3, 4.2, 5.3), (8.5, 5.6, 5.7)),
    ('Lysine', 'Lys', 5, 5.3, 2000, 2.9, 1.00, (2.3, 2.2, 5.5), (5.4, 4.3, 2.7)),
    ('Methionine', 'Met', 5, 1.3, 2000, 2.7, 1.00, (7.1, 1.9, 2.7), (7.4, 4.5, 4.1)),
    ('Ornithine', 'Asp', 5, 5.5, 2000, 6.1, 0.99, (1.9, 13.6, 5.6), (7.5, 7.9, 5.2)),
    ('Phenylalanine', 'Phe', 5, 3.4, 2000, 11.7, 0.99, (1.3, 2.7, 4.8), (6.2, 4.7, 2.8)),
    ('Proline', 'Pro', 5, 6.7, 2000, 1.4, 1.00, (6.7, 2.4, 3), (8.5, 4.1, 3.0)),
    ('Serine', 'Ser', 5, 9.0, 2000, 5.0, 1.00, (0.81, 4.6, 5.2), (5.9, 3.5, 8.1)),
    ('Taurine', 'Gly', 5, 6.0, 2000, 0.5, 0.99, (1.7, 3.1, 10.4), (6.1, 6.9, 7.4)),
    ('Threonine', 'Thr', 10, 4.2, 2000, 2.1, 1.00, (7.2, 1.2, 2.3), (6.1, 3.8, 2.4)),
    ('Tryptophan', 'Gly', 5, 0.7, 2000, 8.5, 0.99, (4.1, 2.7, 5.4), (8.9, 3.6, 5.2)),
    ('Tyrosine', 'Tyr', 5, 9.5, 2000, 5.8, 1.00, (4.3, 2.5, 0.9), (5.5, 5.5, 1.3)),
    ('Valine', 'Val', 5, 8.7, 2000, 4.0, 1.00, (0.49, 1.2, 3.1), (5.5, 3.5, 1.1)),
    ('Isoleucine (underivatized)', 'u-Ile', 25, 8.0, 2000, 6.2, 0.99, (2.9, 1.4, None), (6.8, 2.1, None)),
    ('allo-Isoleucine (underivatized)', 'u-Ile', 5, 10.2, 500, 1.9, 1.00, (3.2, 4.1, None), (10.8, 0.7, None)),
]


def f3(t):
    return '/'.join('NP' if v is None else f'{v}' for v in t)


M = {
 27: dict(
    expect='720003388',
    set=dict(
        source_type='Application note', source_authors='Mark Roberts, Michelle Wood', reference='Waters application note 720003388 (June 2010)',
        source_url='https://www.waters.com/nextgen/us/en/library/application-notes/2010/quantitative-analysis-of-21-benzodiazepine-drugs-zolpidem-zopiclone-serum-using-uplc-ms-ms.html',
        laboratory='Waters Corporation', country='UK', cone_gas_flow_lh=None, lloq=None, uloq=1000.0, recovery_percent=None,
        cv_intra_percent=None, cv_inter_percent=None, lloq_unit='ng/mL', validation_units='ng/mL',
        notes='Source: Waters application note 720003388 (Roberts & Wood, June 2010). Borate buffer is a saturated solution of disodium tetraborate '
              'decahydrate; extraction mixture dichloromethane/ether/hexane 30/50/20 with 0.5 % isoamyl alcohol. Washes: strong = mobile phase B '
              '(500 µL), weak = mobile phase A (1500 µL). Methanol was used as mobile phase B because of an acetonitrile shortage. Calibrators 0, 1, 5, '
              '10, 100, 1000 ng/mL in triplicate, 1/x weighting, mean r² > 0.995 except alpha-hydroxytriazolam (0.975 over 1–100 ng/mL). LOD = S/N > 7 '
              'for both transitions (1 ng/mL for most; 5 ng/mL for lorazepam, nordiazepam, oxazepam and temazepam). LOQ and precision are not reported. '
              'Recovery 62–89 % and matrix effect −28 to +6 % (50 ng/mL, six serum sources). Extracts stable for 11 h at 5 °C. Identification: RT within '
              '0.2 min, ion ratio within 15 %. 27 authentic serum/plasma samples agreed with a validated HPLC-MS/MS method (r² > 0.98). Transitions, cone '
              'voltages, collision energies and internal-standard assignments from Table 1; the internal standards\' own transitions are not printed. '
              'Cone gas flow is not reported.'),
    trans=[x for (n, cone, q1, p1, c1, p2, c2, ist, *_r) in T27 for x in (
        (n, 0, q1, p1, c1, cone, None, 1, 'ESI+', ist), (n, 0, q1, p2, c2, cone, None, 0, 'ESI+', ist))],
    grad=[(t, b, 0.4, c) for t, b, c in G27],
    val=[(n, lod, None, None, None, None,
          f'LOD {lod} ng/mL (S/N > 7 on both transitions). Matrix effect {me:+} % (RSD {rsd} %); recovery {rec} % at 50 ng/mL. IS: {ist}.')
         for (n, cone, q1, p1, c1, p2, c2, ist, lod, me, rsd, rec) in T27]),
 85: dict(
    expect='10.1016/j.jchromb.2014.01.045',
    set=dict(
        source_authors='Curtis J. Hedman, Donald A. Wiebe, Subhakar Dey, Josh Plath, Joseph W. Kemnitz, Toni E. Ziegler',
        source_url='https://doi.org/10.1016/j.jchromb.2014.01.045',
        reference='Hedman CJ et al. J Chromatogr B 2014;953-954:62-67. doi:10.1016/j.jchromb.2014.01.045',
        ion_spray_voltage=5000.0, source_temperature_c=600.0, gas1=60.0, gas2=30.0, curtain_gas=20.0, collision_gas=6.0,
        lloq=None, uloq=250.0, lloq_unit='pg/mL', validation_units='pg/mL', is_derivatized=1,
        notes='Source: Hedman et al., J Chromatogr B 2014 (open access, PMC4050665). LC: Shimadzu Prominence, Phenomenex Kinetex 2.4 µm 3.0 × 150 mm, '
              '0.25 mL/min, 10 µL, 30 min run (column temperature not reported). MS: QTRAP 5500, positive TurboIonSpray, IS 5000 V, TEM 600 °C, GS1 60, '
              'GS2 30, CUR 20, CAD 6, EP 10 V. The article does not report the MRM transitions, collision energies or retention times, so none are '
              'stored. Calibration 0, 15.63, 31.25, 62.5, 125, 250 pg/mL (unweighted linear, r > 0.9984 for D2 and > 0.9991 for D3, four runs). '
              'LOD about 2 pg/mL for both (Amplifex); the Methods section prints "2.0 pg/L", a unit error. LOQ and precision are not reported. Recovery '
              'of extracted standards 89.6–115 % (D2) and 93.6–117 % (D3). Versus RIA (n = 20): Lin\'s concordance 0.92. PTAD derivatization (same prep, '
              '60 µL of 0.75 mg/mL PTAD) gave LODs of 15 pg/mL (D3) and 30 pg/mL (D2) and about 10× lower S/N. '
              'To check when reviewing: without transitions this method cannot be imported into a validation plan.'),
    trans=[], grad=None,
    val=[('1,25-Dihydroxyvitamin D2 (Amplifex)', 2.0, None, None, None, None,
          'LOD about 2 pg/mL (estimated). Range 15.63–250 pg/mL; r > 0.9984. Recovery 89.6–115 %. PTAD method LOD 30 pg/mL.'),
         ('1,25-Dihydroxyvitamin D3 (Amplifex)', 2.0, None, None, None, None,
          'LOD about 2 pg/mL (estimated). Range 15.63–250 pg/mL; r > 0.9991. Recovery 93.6–117 %. PTAD method LOD 15 pg/mL.')]),
 117: dict(
    expect='10.1002/jmd2.12080',
    set=dict(
        source_url='https://doi.org/10.1002/jmd2.12080',
        reference='Phipps WS et al. JIMD Reports 2020;51:62-69. doi:10.1002/jmd2.12080',
        laboratory="Children's Health (Children's Medical Center Dallas) and UT Southwestern Medical Center", country='USA',
        instrument_model='4500', ion_spray_voltage=3500.0, lloq=5.0, uloq=2000.0, lloq_unit='μmol/L', validation_units='μmol/L',
        cv_intra_percent=None, cv_inter_percent=None,
        notes='Source: Phipps et al., JIMD Reports 2020 (open access, PMC7012744). LC: Agilent 1290, SCIEX aTRAQ C18 column (4374841, 5 µm, '
              '4.6 × 150 mm) at 50 °C, 1.0 mL/min, 20 µL. MS: SCIEX 4500, ESI+, SRM; ion spray 3500 V, EP 10 V, DP 35 V, CXP 10 V. Quantitation against '
              'a single-point 250 µM external calibrator, normalised to 17 13C,15N-labelled amino acids (Cambridge Isotope MSK-A2); amino acids without '
              'a labelled analogue use the internal standard listed in Table 1. Linear 5–2000 µM (cystine 2.5–1000 µM; underivatized allo-Ile 5–500 µM); '
              'LLOQ 5 µM except argininosuccinic acid, leucine and threonine (10 µM), cystine (2.5 µM) and underivatized Ile (25 µM). %CV < 10 % except '
              'inter-run plasma Asn 13 %, Asp 16.2 %, Gly 11.2 % and intrarun plasma Gly 10.4 %. Spiked plasma: 148/152 results within ±20 %. Mean ion '
              'suppression 23.8–35.9 %. Correlation with IEX/UPLC (n = 30): R > 0.95 for 12 of 20 targets combined, and for every target with at least '
              'one of the two comparison methods. Allo-Ile and Ile are not baseline separated but can be quantified separately. '
              'To check when reviewing: the gradient (Table S1) and SRM transitions (Table S2) are in the supplementary PDF, which could not be '
              'opened for verification; the stored gradient and transitions have NOT been checked against it.'),
    trans=None, grad=None,
    val=[(n, None, lloq, r2, cv, None,
          f'IS: {ist} (13C,15N). LLOQ {lloq} µM (CV {cv} %), ULOQ {uloq} µM (CV {cvu} %), R² {r2}. Intrarun CV low/high/plasma {f3(intra)} %; '
          f'inter-run {f3(inter)} % (NP = not performed).')
         for n, ist, lloq, cv, uloq, cvu, r2, intra, inter in T117]),
}


def main(dry):
    c = sqlite3.connect(DB)
    cur = c.cursor()
    for mid, d in M.items():
        ref = cur.execute('select reference from methods where id=?', (mid,)).fetchone()[0]
        assert d['expect'] in ref, (mid, ref)
        f = d['set']
        cur.execute(f"update methods set {', '.join(k + '=?' for k in f)}, updated_at=datetime('now') where id=?", (*f.values(), mid))
        if d['grad'] is not None:
            cur.execute('delete from gradient_steps where method_id=?', (mid,))
            for t, b, fl, cv in d['grad']:
                cur.execute('insert into gradient_steps (method_id, time_min, percent_b, flow_rate_ml_min, curve) values (?,?,?,?,?)', (mid, t, b, fl, cv))
        if d['trans'] is not None:
            cur.execute('delete from mrm_transitions where method_id=?', (mid,))
            for n, is_std, q1, q3, ce, cone, rt, quant, pol, ais in d['trans']:
                cur.execute('insert into mrm_transitions (method_id, compound_name, is_internal_standard, precursor_mz, product_mz, collision_energy_ev, '
                            'cone_voltage, retention_time_min, is_quantifier, polarity, assigned_is, is_derivatized) values (?,?,?,?,?,?,?,?,?,?,?,0)',
                            (mid, n, is_std, q1, q3, ce, cone, rt, quant, pol, ais))
        cur.execute('delete from compound_validation where method_id=?', (mid,))
        mat = cur.execute('select matrix from methods where id=?', (mid,)).fetchone()[0]
        for n, lod, loq, r2, cv, acc, note in d['val']:
            cur.execute('insert into compound_validation (method_id, compound_name, lod, loq, r2, cv_percent, accuracy_percent, matrix, notes, '
                        'lod_na, loq_na, r2_na, cv_percent_na, accuracy_percent_na) values (?,?,?,?,?,?,?,?,?,0,0,0,0,0)',
                        (mid, n, lod, loq, r2, cv, acc, mat, note))
        nt = cur.execute('select count(*) from mrm_transitions where method_id=?', (mid,)).fetchone()[0]
        ng = cur.execute('select count(*) from gradient_steps where method_id=?', (mid,)).fetchone()[0]
        print(f'{mid}: {nt} transitions, {ng} gradient steps, {len(d["val"])} validation rows')
    if dry: c.rollback(); print('DRY RUN, rolled back')
    else: c.commit(); print('committed')


if __name__ == '__main__':
    main('--dry' in sys.argv)
