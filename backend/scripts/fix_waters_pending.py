"""Verify and correct the seven pending Waters application notes (methods 20, 21, 22, 23, 24, 73, 102).

Every value below was read from the public Waters application note pages, including the tables that
Waters publishes only as images (gradient tables, MRM appendices, calibration and precision tables).
Values the notes do not report are cleared or left empty rather than kept, because the earlier values
did not come from the source. Status is left as it is (pending) for the owner's review.
Run from the repo root:  python3 backend/scripts/fix_waters_pending.py [--dry]
"""
import sqlite3, sys

DB = 'metabolc.db'
BASE = 'https://www.waters.com/nextgen/us/en/library/application-notes/'

# ── 20 · Fentalogues and nitazenes (720009165) ─────────────────────────────────────────────
# Transitions and retention times are those printed in Figures 4, 6 and 7 (one MRM each).
T20 = [  # name, q1, q3, rt
    ('Fentanyl', 337.2, 105.0, 6.26),
    ('para-Methyl acetyl fentanyl', 337.2, 105.0, 6.27),
    ('meta-Methyl acetyl fentanyl', 337.2, 105.0, 6.20),
    ('ortho-Methyl acetyl fentanyl', 337.2, 105.0, 5.88),
    ('Acetyl norfentanyl', 219.2, 84.0, 2.04),
    ('Acetyl fentanyl', 323.2, 105.0, 5.17),
    ('beta-Hydroxy fentanyl', 353.2, 91.0, 5.46),
    ('Norfentanyl', 233.2, 84.0, 3.25),
    ('Alfentanil', 417.3, 197.1, 6.24),
    ('Metonitazene', 383.2, 100.0, 5.71),
    ('Etonitazene', 397.2, 100.0, 6.77),
    ('Isotonitazene', 411.2, 100.0, 7.64),
]
G20 = [(0.0, 13), (0.5, 13), (10.0, 50), (10.75, 95), (12.25, 95), (12.5, 13), (15.0, 13)]

# ── 73 · Definitive drug panel in hair (720008769), Appendix 1 ─────────────────────────────
# name, rt, cone, parent, mrm1, ce1, mrm2, ce2   (mrm2 None = single transition)
T73 = [
    ('Morphine', 0.86, 25, 286.1, 201.1, 25, 165.1, 35),
    ('Oxymorphone', 0.91, 25, 302.1, 227.0, 25, 242.1, 25),
    ('Hydromorphone', 0.97, 25, 286.1, 185.0, 30, 157.0, 40),
    ('Dihydrocodeine', 1.15, 25, 302.2, 199.0, 30, 128.1, 60),
    ('Naloxone', 1.15, 10, 328.2, 212.0, 38, 253.0, 28),
    ('Codeine', 1.17, 25, 300.2, 215.1, 25, 165.1, 40),
    ('Noroxycodone', 1.25, 12, 302.2, 187.1, 26, 227.1, 30),
    ('Naltrexone', 1.26, 6, 342.3, 324.2, 18, 270.2, 26),
    ('Amphetamine', 1.28, 25, 136.1, 119.0, 10, 91.0, 10),
    ('Oxycodone', 1.28, 25, 316.1, 241.1, 25, 256.2, 25),
    ('6-Acetylmorphine', 1.29, 5, 328.3, 165.1, 35, 211.2, 25),
    ('MDA', 1.30, 22, 180.1, 163.1, 8, 105.0, 20),
    ('Metadesnitazine', 1.37, 25, 338.4, 100.2, 25, 121.1, 25),
    ('Hydrocodone', 1.34, 6, 300.3, 199.1, 28, 171.1, 36),
    ('O-Desmethyltramadol', 1.33, 25, 250.2, 58.1, 15, None, None),
    ('Methamphetamine', 1.36, 24, 150.1, 119.1, 9, 91.0, 15),
    ('MDMA', 1.37, 26, 194.1, 163.0, 10, 105.0, 22),
    ('Phentermine', 1.43, 24, 150.0, 133.1, 9, 91.0, 15),
    ('MDEA', 1.48, 26, 208.1, 163.1, 10, 105.0, 24),
    ('Ritalinic acid', 1.49, 25, 220.1, 84.0, 20, 56.0, 40),
    ('Norfentanyl', 1.54, 25, 233.2, 84.0, 15, 177.2, 15),
    ('Benzoylecgonine', 1.53, 36, 290.1, 168.1, 18, 105.0, 32),
    ('7-Aminoclonazepam', 1.53, 50, 286.1, 121.0, 30, 222.1, 26),
    ('Tramadol', 1.68, 25, 264.2, 58.1, 15, None, None),
    ('N-Desmethyltramadol', 1.70, 25, 250.1, 44.0, 10, 232.2, 7),
    ('Methylphenidate', 1.70, 25, 234.2, 84.0, 15, 91.0, 40),
    ('7-Aminoflunitrazepam', 1.71, 34, 284.1, 135.0, 26, 226.9, 22),
    ('Cocaine', 1.81, 42, 304.2, 182.2, 34, 82.1, 20),
    ('Normeperidine', 1.82, 25, 234.2, 160.1, 15, 131.0, 28),
    ('Meperidine', 1.83, 25, 248.2, 174.1, 20, 220.2, 20),
    ('Norbuprenorphine', 1.91, 25, 414.4, 101.3, 48, 57.1, 43),
    ('Chlordiazepoxide', 1.94, 34, 300.0, 283.0, 12, 227.0, 20),
    ('Trazodone', 1.99, 25, 372.2, 176.1, 20, 148.0, 35),
    ('Cocaethylene', 2.01, 42, 318.2, 196.2, 20, 105.0, 38),
    ('Phencyclidine', 2.08, 25, 244.2, 86.1, 12, 159.1, 12),
    ('N-Pyrrolidino etonitazene', 2.19, 25, 395.4, 98.2, 20, 107.1, 40),
    ('Fentanyl', 2.14, 25, 337.2, 188.1, 22, 105.0, 35),
    ('alpha-Hydroxymidazolam', 2.13, 2, 342.1, 168.1, 40, 203.1, 24),
    ('Midazolam', 2.17, 16, 326.1, 223.1, 36, 291.1, 24),
    ('Etonitazene', 2.23, 25, 397.4, 100.2, 25, 107.1, 30),
    ('Flurazepam', 2.23, 40, 388.2, 315.1, 26, 100.1, 28),
    ('Buprenorphine', 2.27, 5, 468.4, 55.1, 50, 101.2, 40),
    ('EDDP', 2.37, 25, 278.2, 234.1, 30, 249.2, 25),
    ('Methadone', 2.58, 25, 310.2, 265.2, 15, 105.0, 25),
    ('alpha-Hydroxyalprazolam', 2.55, 50, 325.1, 297.1, 25, 243.1, 30),
    ('alpha-Hydroxytriazolam', 2.55, 28, 359.1, 176.1, 24, 141.0, 38),
    ('Nitrazepam', 2.56, 50, 282.1, 236.1, 20, 180.1, 36),
    ('Oxazepam', 2.63, 50, 289.1, 243.1, 20, 104.1, 30),
    ('Lorazepam', 2.70, 50, 323.0, 277.0, 20, 229.1, 30),
    ('Clonazepam', 2.69, 50, 316.0, 270.1, 25, 241.1, 35),
    ('Alprazolam', 2.72, 50, 309.1, 205.1, 40, 281.1, 26),
    ('2-Hydroxyethylflurazepam', 2.72, 25, 333.1, 109.0, 25, 194.0, 20),
    ('Nordiazepam', 2.72, 50, 271.1, 140.0, 30, 165.0, 28),
    ('Triazolam', 2.78, 28, 343.1, 239.1, 38, 308.1, 24),
    ('Desalkylflurazepam', 2.82, 25, 289.1, 140.0, 30, 226.1, 25),
    ('Flunitrazepam', 2.83, 50, 314.1, 268.1, 25, 239.1, 30),
    ('Temazepam', 2.91, 50, 301.1, 255.1, 20, 177.1, 46),
    ('Diazepam', 3.08, 50, 285.1, 154.0, 26, 193.1, 30),
]
G73 = [(0.0, 2), (3.33, 67), (3.5, 90), (3.6, 2), (4.0, 2)]

# ── 102 · Antibiotics in plasma (720007388), Table 4 ───────────────────────────────────────
# analyte, polarity, cone, (quan q1, q3, ce), (qual q1, q3, ce), (IS name, q1, q3, ce)
T102 = [
    ('Ciprofloxacin', '+', 40, (332.1, 245.1, 26), (332.1, 203.1, 30), ('Ciprofloxacin-2H8', 340.1, 249.1, 26)),
    ('Meropenem', '+', 30, (384.1, 141.1, 18), (384.1, 114.1, 32), ('Meropenem-2H6', 390.1, 147.1, 18)),
    ('Cefazolin', '+', 24, (454.9, 156.1, 18), (454.9, 124.1, 32), ('Cefazolin-13C2,15N', 457.9, 156.1, 18)),
    ('Cefepime', '+', 30, (481.1, 167.1, 24), (481.1, 156.1, 24), ('Cefepime-13C,2H3', 485.1, 167.1, 24)),
    ('Linezolid', '+', 46, (338.1, 235.1, 22), (338.1, 148.1, 42), ('Linezolid-2H3', 341.1, 236.1, 22)),
    ('Flucloxacillin', '+', 24, (454.1, 196.1, 28), (454.1, 238.1, 16), ('Flucloxacillin-13C4', 458.1, 198.1, 28)),
    ('Piperacillin', '+', 26, (518.1, 359.1, 8), (518.1, 302.1, 8), ('Piperacillin-2H5', 523.1, 364.1, 8)),
    ('Clindamycin', '+', 45, (425.1, 83.1, 66), (425.1, 377.1, 18), ('Clindamycin-13C,2H3', 429.1, 87.1, 66)),
    ('Tazobactam', '+', 34, (301.1, 99.1, 28), (301.1, 168.1, 16), ('Tazobactam-13C2,15N3', 306.1, 99.1, 28)),
    ('Ceftazidime', '+', 30, (547.1, 468.1, 12), (547.1, 167.1, 26), ('Ceftazidime-2H5', 552.1, 468.1, 12)),
    ('Sulbactam', '-', 24, (232.1, 140.1, 12), (232.1, 188.1, 12), ('Sulbactam-2H5', 237.1, 145.1, 12)),
    ('Ampicillin', '+', 34, (350.1, 160.1, 12), (350.0, 114.1, 30), ('Ampicillin-2H5', 355.1, 160.1, 12)),
    ('Cefotaxime', '+', 32, (456.1, 112.1, 30), (456.1, 125.1, 24), ('Cefotaxime-2H3', 459.1, 112.1, 30)),
    ('Daptomycin', '+', 40, (810.8, 313.1, 38), (810.8, 187.1, 46), ('Daptomycin-2H5', 812.8, 316.1, 38)),
    ('Chloramphenicol', '-', 26, (320.9, 151.9, 18), (320.9, 256.9, 12), ('Chloramphenicol-2H5', 325.9, 155.9, 18)),
    ('Azithromycin', '+', 60, (749.5, 158.1, 45), (749.5, 591.4, 40), ('Azithromycin-2H3', 752.5, 158.1, 45)),
]
G102 = [(0.0, 10, 'Initial'), (3.0, 100, '6'), (4.0, 100, '6'), (4.1, 10, '6'), (5.0, 10, '6')]
# Tables 1, 5 and 6: analyte, cal low, cal high, QCs, sensitivity, CV at sensitivity, bias %, total precision L/M/H, repeatability L/M/H
V102 = [
    ('Ampicillin', 0.5, 50, '1.25, 3.75, 30', 0.375, 13.9, -13.2, (7.8, 6.6, 7.4), (7.6, 4.2, 3.3)),
    ('Azithromycin', 0.005, 0.5, '0.0125, 0.0375, 0.3', 0.00375, 15.4, -9.1, (8.3, 5.5, 3.6), (2.6, 2.1, 1.6)),
    ('Cefazolin', 1, 100, '2.5, 7.5, 60', 1.00, 18.8, -2.9, (11.9, 12.2, 10.8), (11.6, 5.2, 4.1)),
    ('Cefepime', 1, 100, '2.5, 7.5, 60', 0.900, 18.9, 2.6, (11.5, 10.2, 6.3), (11.1, 5.6, 3.4)),
    ('Cefotaxime', 0.5, 50, '1.25, 3.75, 30', 0.375, 10.2, -14.4, (5.7, 9.2, 8.4), (4.1, 3.0, 2.4)),
    ('Ceftazidime', 1, 100, '2.5, 7.5, 60', 0.750, 16.4, -8.5, (7.8, 7.5, 8.2), (4.7, 3.0, 2.9)),
    ('Chloramphenicol', 0.5, 50, '1.25, 3.75, 30', 0.375, 9.6, -4.8, (10.9, 5.7, 8.6), (3.9, 4.2, 3.1)),
    ('Ciprofloxacin', 0.1, 10, '0.25, 0.75, 6', 0.0750, 18.5, -12.0, (12.5, 11.6, 8.5), (6.1, 5.8, 3.6)),
    ('Clindamycin', 0.1, 10, '0.25, 0.75, 6', 0.0750, 17.8, -4.0, (5.6, 5.4, 5.8), (2.8, 2.4, 1.9)),
    ('Daptomycin', 2, 200, '5, 15, 120', 1.50, 10.2, -12.3, (6.4, 7.6, 7.5), (4.3, 2.1, 1.2)),
    ('Flucloxacillin', 1, 100, '2.5, 7.5, 60', 1.00, 16.4, -14.4, (9.6, 8.0, 6.5), (5.5, 4.6, 3.7)),
    ('Linezolid', 0.5, 50, '1.25, 3.75, 30', 0.375, 16.6, -1.1, (5.7, 6.5, 5.7), (4.1, 3.0, 2.8)),
    ('Meropenem', 1, 100, '2.5, 7.5, 60', 0.900, 18.2, -14.1, (12.4, 12.4, 12.0), (10.6, 7.8, 4.1)),
    ('Piperacillin', 2, 200, '5, 15, 120', 0.500, 17.0, 7.9, (4.6, 6.9, 9.3), (3.6, 2.8, 1.5)),
    ('Sulbactam', 1, 100, '2.5, 7.5, 60', 0.750, 18.1, -5.1, (8.6, 7.8, 8.5), (8.6, 6.3, 8.0)),
    ('Tazobactam', 0.5, 50, '1.25, 3.75, 30', 0.375, 19.0, -1.2, (11.2, 8.4, 10.4), (8.1, 6.7, 7.9)),
]

M = {
 20: dict(
    expect='720009165',
    set=dict(
        analyte='Fentanyl analogues and nitazene derivatives (library of 250 compounds incl. metabolites; 12 shown with transitions in the note)',
        matrix='other', ionization_mode='ESI+', reference='Waters application note 720009165 (December 2025)',
        source_authors='Matthias Mäder, Christina Tanner, Ivan Schlatter, Stefan Nückel, Marco Rentsch',
        source_url=BASE + '2025/development-of-a-targeted-multiple-reaction-monitoring-mrm-method-for-fentalogues-and-nitazene-derivatives-for-use-with-waters-xevo-tq-s-micro-mass-spectrometer.html',
        laboratory='Forensisch-Naturwissenschaftlicher Dienst, Kantonspolizei St. Gallen', country='Switzerland',
        sample_prep_method='Other',
        sample_prep_details='Reference material only (Cayman Chemical FAS and Emergent Panel kits). Each 96-well vial reconstituted with 700 µL methanol, '
                            'diluted in methanol to 10 µg/mL and 500 ng/mL for QuanOptimize, then to 10 ng/mL for analysis; 100 µL propranolol internal standard '
                            '(87 ng/mL) added to 1000 µL. No extraction protocol for biological samples is given.',
        lloq=None, uloq=None, cv_intra_percent=None, cv_inter_percent=None, recovery_percent=None, lloq_unit=None, validation_units=None,
        notes='Source: Waters application note 720009165 (published 12 Dec 2025, research use only). Qualitative screening library, not a quantitative '
              'validated method: no LOD, LOQ, precision or accuracy are reported. The full library (250 analytes, up to four MRM transitions each, '
              'with PIC spectra) is available only on request from Waters; the 12 transitions listed here are the ones printed in Figures 4, 6 and 7, '
              'with retention times read from the peak labels. Collision energies and cone voltages are not given for these transitions. '
              'Acquisition: MRM with Product Ion Confirmation (PIC) scan; capillary 1.0 kV, source 150 °C, desolvation 400 °C, desolvation gas 800 L/h, '
              'cone gas 20 L/h. Injection 1 µL (0.2 µL flow injection for QuanOptimize). meta- and para-methyl acetyl fentanyl co-elute with fentanyl '
              'and share its product ions; ortho-methyl acetyl fentanyl is separated. PIC fragments mentioned in the text (not MRM transitions): '
              'fentanyl 188.1, 105.1; etonitazene 135, 100, 72, 44; metonitazene 121.'),
    trans=[(n, 0, q1, q3, None, None, rt, 1, 'ESI+', None) for n, q1, q3, rt in T20],
    grad=[(t, b, 0.4, None) for t, b in G20],
    val=[]),
 21: dict(
    expect='720008011',
    set=dict(
        reference='Waters application brief 720008011 (2023)', source_authors='Jane Cooper, Michelle Wood',
        source_url=BASE + '2023/analysis-of-carboxy-thc-in-hair-using-uplc-msms-for-forensic-toxicology.html',
        ionization_mode='ESI-', lloq=0.2, uloq=10, lloq_unit='pg/mg', validation_units='pg/mg', cv_intra_percent=1.8, cv_inter_percent=8.4,
        column_temperature_c=None, injection_volume_ul=None,
        notes='Source: Waters application brief 720008011 (2023, forensic toxicology use only). Matrix is hair (25 mg). The brief has no detailed '
              'experimental section: column temperature, gradient table, injection volume and MS source settings are not published. Separation used a '
              'gradient of ammonium fluoride (pH 9.5) and methanol on an ACQUITY Premier BEH C18 1.7 µm 2.1 × 150 mm with VanGuard FIT. '
              'Calibration 0.2–10 pg/mg (three batches, R² > 0.99); 0.2 pg/mg is the SoHT confirmation cut-off. Within-run precision 1.8 % RSD '
              '(5 extractions), total precision 8.4 % RSD; accuracy within 15 % (20 % at the lowest calibrator). Matrix factor 64 % without and 100 % '
              'with internal standard. No carryover after a 5 pg/mg calibrator. '
              'To check when reviewing: the note does not state the polarity; ESI− is inferred from the precursor m/z 343 ([M−H]− of carboxy-THC). '
              'The qualifier precursor is printed as 343.23 while the quantifier is 343.1; kept as printed.'),
    trans=[('Carboxy-THC', 0, 343.1, 191.0, None, None, None, 1, 'ESI-', 'Carboxy-THC-D3'),
           ('Carboxy-THC', 0, 343.23, 245.1, None, None, None, 0, 'ESI-', 'Carboxy-THC-D3'),
           ('Carboxy-THC-D3', 1, 346.1, 248.1, None, None, None, 1, 'ESI-', None)],
    grad=None,
    val=[('Carboxy-THC', None, 0.2, 0.99, 8.4, None, 'Range 0.2–10 pg/mg hair (SoHT cut-off 0.2 pg/mg). CV is total precision across hair samples; '
          'within-run 1.8 %. Accuracy within ±15 % (±20 % at lowest calibrator). R² reported as > 0.99.')]),
 22: dict(
    expect='720008072',
    set=dict(
        reference='Waters application note 720008072 (2023)', source_authors='Brianna R. Clements, Paul D. Rainville, Stephanie Harden',
        source_url=BASE + '2023/improvements-in-the-analysis-of-synthetic-peptide-enfuvirtide-and-haart-drugs-utilizing-maxpeak-high-performance-surfaces-hps.html',
        matrix='other', capillary_voltage_v=0.8, lloq=3.5, uloq=None, lloq_unit='μg/mL', validation_units='μg/mL', cv_intra_percent=None,
        cv_inter_percent=None, autosampler_temperature_c=25.0, sample_prep_method='Other',
        sample_prep_details='Neat standards only, no biological matrix. Stocks in DI water or DMSO (stored 2–8 °C), diluted in 5 % acetonitrile in DI water: '
                            'HIV drug mix and enfuvirtide suitability standards at 100 µg/mL; calibration 1.0–250 µg/mL (antiretrovirals) and 7.5–1000 µg/mL (enfuvirtide).',
        notes='Source: Waters application note 720008072 (2023). Not an LC-MS/MS or clinical sample method: quantitation is by UV (260 nm for the '
              'antiretrovirals, 214 nm for enfuvirtide) on neat standards; the ACQUITY QDa single quadrupole scanned 220–1250 in ESI+ (cone 15 V, '
              'capillary 0.8 kV) and enfuvirtide was followed as the 4+ ion at m/z 1124. No plasma or blood was analysed. Linearity r² ≥ 0.999; '
              '%RSD of area and retention time < 1 % (6 injections). LOQ standard 3.5 µg/mL enfuvirtide: S/N 14.2 on MaxPeak HPS vs 2.4 on stainless '
              'steel. Arc Premier LC with XBridge Premier Peptide BEH C18 300 Å 2.5 µm 4.6 × 100 mm, 25 °C, 1.0 mL/min, 5 µL. '
              'To check when reviewing: this method probably does not belong in a clinical LC-MS/MS library (no MRM, no biological matrix).'),
    trans=None, grad=None, val=[]),
 23: dict(
    expect='720007912',
    set=dict(
        reference='Waters application brief 720007912 (2023)', source_authors='Jonathan P. Danaceau, Michelle Wood',
        source_url=BASE + '2023/analysis-of-phosphatidylethanol-peth-in-whole-blood-using-spe-and-uplc-ms-ms-for-clinical-research.html',
        lloq=10.0, uloq=1000.0, cv_intra_percent=None, cv_inter_percent=None, recovery_percent=None,
        notes='Source: Waters application brief 720007912 (2023, research use only). Gradient as published: from 50:50 A:B to 100 % B over 3 min at '
              '0.5 mL/min, followed by two rapid 30-s saw-tooth ramps from 50:50 to 100 % B to prevent carryover; the full timetable and the MS source '
              'settings (capillary, temperatures, gas flows) are not published. Calibration 10–1000 ng/mL (0.014–1.4 µM), LLOQ 10 ng/mL for both '
              'analytes (accuracy within 15 %, %RSD 5.1 % at LLOQ); endogenous PEth in the blank matrix was about 5 ng/mL. QCs 75, 250, 750 ng/mL: '
              'mean accuracy 85.8–99.8 %, %RSD 1.9–12.3 % (two tables of results, Table 3). Recovery (n=6): 16:0/18:1 75.1 % and 79.0 %, '
              '16:0/18:2 89.6 % and 87.8 %; matrix effects −6.6 % to −12.4 %. PEth 16:0/18:1-D5 is the internal standard for both analytes.'),
    trans=[('PEth 16:0/18:1', 0, 701.6, 255.2, 30, 10, 2.64, 1, 'ESI-', 'PEth 16:0/18:1-D5'),
           ('PEth 16:0/18:1', 0, 701.6, 281.3, 35, 10, 2.64, 0, 'ESI-', 'PEth 16:0/18:1-D5'),
           ('PEth 16:0/18:2', 0, 699.6, 255.3, 30, 10, 2.54, 1, 'ESI-', 'PEth 16:0/18:1-D5'),
           ('PEth 16:0/18:2', 0, 699.6, 279.3, 35, 10, 2.54, 0, 'ESI-', 'PEth 16:0/18:1-D5'),
           ('PEth 16:0/18:1-D5', 1, 706.6, 255.2, 30, 10, None, 1, 'ESI-', None),
           ('PEth 16:0/18:1-D5', 1, 706.6, 281.3, 35, 10, None, 0, 'ESI-', None)],
    grad=[(0.0, 50, 0.5, None), (3.0, 100, 0.5, None)],
    val=[('PEth 16:0/18:1', None, 10.0, None, None, None, 'Range 10–1000 ng/mL. At LLOQ: accuracy within 15 %, %RSD 5.1 %. QC accuracy 85.8–99.5 %, %RSD 1.9–10.4 %. Recovery 75.1 % / 79.0 %, matrix effect −12.4 % / −7.6 %.'),
         ('PEth 16:0/18:2', None, 10.0, None, None, None, 'Range 10–1000 ng/mL. At LLOQ: accuracy within 15 %, %RSD 5.1 %. QC accuracy 85.8–99.8 %, %RSD 2.7–12.3 %. Recovery 89.6 % / 87.8 %, matrix effect −9.1 % / −6.6 %.')]),
 24: dict(
    expect='720006273',
    set=dict(
        reference='Waters application note 720006273 (May 2018)', source_authors='Patrice Y. Ohouo, Nicholas Dixon, Amy Lieu, Zahra Zavery, Thomas G. Rosano',
        source_url=BASE + '2018/uplc-ms-ms-method-quantitation-etg-ets-human-urine.html',
        laboratory='Albany Medical Center / National Toxicology Center (Albany)', country='USA',
        capillary_voltage_v=2.5, lloq=None, uloq=None, cv_intra_percent=None, cv_inter_percent=None,
        notes='Source: Waters application note 720006273 (May 2018, forensic toxicology use only), method from Albany Medical Center. Calibration '
              '(1/x, response ratio to the deuterated IS): EtG 200–10,000 ng/mL, EtS 100–5,000 ng/mL; cut-offs EtG 500 and EtS 250 ng/mL; LOD taken as '
              'the lowest calibrator (EtG 200, EtS 100 ng/mL). QCs EtG 200/625/8000, EtS 100/312.5/4000 ng/mL over 11 runs: EtG %CV 8.4–19.6 and '
              'accuracy 98.4–103.6 %; EtS %CV 4.7–18.2 and accuracy 96.4–110.8 % (intra- and inter-assay not reported separately). Ion ratio ±20 %. '
              'Matrix effect in 10 urines: EtG +1 to −58 %, EtS −54 to +94.6 %. 34 casework samples showed no bias vs a reference LC-MS/MS method. '
              'Total run 7.5 min. Not reported: cone voltages, collision energies, source and desolvation temperatures and gas flows. '
              'To check when reviewing: the note says only "ESI"; negative mode is inferred from the precursors ([M−H]− of EtG 221.1 and EtS 125.0). '
              'Retention times (≈1.65 and ≈3.35 min) are read from the axis of Figure 1, which has no peak labels.'),
    trans=[('EtG', 0, 221.1, 75.0, None, None, 1.65, 1, 'ESI-', 'EtG-D5'),
           ('EtG', 0, 221.1, 85.0, None, None, 1.65, 0, 'ESI-', 'EtG-D5'),
           ('EtS', 0, 125.0, 97.0, None, None, 3.35, 1, 'ESI-', 'EtS-D5'),
           ('EtG-D5', 1, 226.1, 75.0, None, None, 1.65, 1, 'ESI-', None),
           ('EtG-D5', 1, 226.1, 85.0, None, None, 1.65, 0, 'ESI-', None),
           ('EtS-D5', 1, 130.0, 98.0, None, None, 3.35, 1, 'ESI-', None)],
    grad=None,
    val=[('EtG', 200.0, 200.0, 0.991, 19.6, None, 'Range 200–10,000 ng/mL, cut-off 500 ng/mL. LOD = lowest calibrator. CV is the highest across QCs (8.4–19.6 %); accuracy 98.4–103.6 %. r² 0.991–0.999 (lowest shown).'),
         ('EtS', 100.0, 100.0, 0.997, 18.2, None, 'Range 100–5,000 ng/mL, cut-off 250 ng/mL. LOD = lowest calibrator. CV is the highest across QCs (4.7–18.2 %); accuracy 96.4–110.8 %. r² 0.997–0.999 (lowest shown).')]),
 73: dict(
    expect='720008769',
    set=dict(
        reference='Waters application note 720008769 (June 2025)', source_authors='Jonathan Danaceau, Lisa Calton',
        source_url=BASE + '2025/extraction-and-analysis-of-a-definitive-drug-panel-in-hair-samples-by-uhplc-ms-ms-for-forensic-toxicology.html',
        capillary_voltage_v=1.0, desolvation_temperature_c=500.0, desolvation_gas_flow_lh=1000.0, cone_gas_flow_lh=150.0,
        lloq=None, uloq=1000.0, lloq_unit='pg/mg', validation_units='pg/mg', needle_wash_solvent='25:25:25:25 MeOH:H2O:IPA:ACN',
        notes='Source: Waters application note 720008769 (10 June 2025, forensic toxicology use only). Matrix: pulverised hair, 20 mg. Calibration '
              '0.01–1.0 ng/mg (10–1000 pg/mg); 6-acetylmorphine and norfentanyl 0.002–0.2 ng/mg; fentanyl 0.001–0.1 ng/mg. QCs 0.03, 0.15, 0.30 ng/mg. '
              'Five batches: within-run (n=4) and between-run (n=5) accuracy within ±15 % (±20 % at low QC) and CV < 15 % (< 20 % at low QC), except '
              'phentermine and metadesnitazine. LLOQ tested with 10 replicates at 0.01 and 0.02 ng/mg; for MDA, alpha-hydroxymidazolam and clonazepam '
              'the low QC is the LLOQ; phentermine did not meet SoHT sensitivity. Mean recovery 58 % (49 of 58 compounds > 40 %), mean matrix effect '
              '20 % suppression (6 compounds > 40 %). EQA: 18 of 24 results within criteria. All compounds elute by 3.2 min, 4.0 min cycle. '
              'Transitions, cone voltages and collision energies from Appendix 1; the first transition (MRM-1) is stored as quantifier. Internal '
              'standards (250 ng/mL working solution, 40 µL) are not listed with transitions in the note. The composition of the 1.2 mL extraction '
              'solution is not given. To check when reviewing: Appendix 1 prints oxazepam as 289.1 and lorazepam as 323.0 (2 Da above the usual '
              '35Cl [M+H]+ of 287.1 and 321.0); kept as printed.'),
    trans=[x for (n, rt, cone, p, m1, c1, m2, c2) in T73
           for x in ([(n, 0, p, m1, c1, cone, rt, 1, 'ESI+', None)] + ([(n, 0, p, m2, c2, cone, rt, 0, 'ESI+', None)] if m2 else []))],
    grad=[(t, b, 0.6, '6') for t, b in G73],
    val=[]),
 102: dict(
    expect='720007388',
    set=dict(
        reference='Waters application note 720007388 (October 2021)',
        source_url=BASE + '2021/analysis-of-antibiotics-in-plasma-for-clinical-research.html',
        lloq=None, uloq=None, lloq_unit='μg/mL', validation_units='μg/mL', cv_intra_percent=12.5, cv_inter_percent=12.5,
        needle_wash_solvent='80 % aqueous methanol + 0.1 % formic acid',
        notes='Source: Waters application note 720007388 (October 2021, research use only). Two injections per sample: Set 1 (2 µL) cefazolin, cefepime, '
              'ciprofloxacin, clindamycin, flucloxacillin, linezolid, meropenem, piperacillin; Set 2 (10 µL) ampicillin, azithromycin, cefotaxime, '
              'ceftazidime, chloramphenicol, daptomycin, sulbactam, tazobactam. 5.0 min run (5.5 min injection to injection). Polarity switching with a '
              '0.020 s switch delay; sulbactam and chloramphenicol are acquired in ESI−, the rest in ESI+. Daptomycin is monitored as [M+2H]2+. '
              'Transitions, cone voltages and collision energies from Table 4; the table lists dwell times of 0.010–0.060 under an "ms" heading '
              '(probably seconds), so they are not stored. Meropenem extracts are unstable: run first and finish within 8 h. Total precision and '
              'repeatability ≤ 12.5 % RSD at three QC levels over five days; analytical sensitivity (n=50) met ≤ 20 % CV and ≤ 15 % bias. Linear fits: '
              'cefepime, daptomycin, piperacillin, sulbactam; quadratic for the others. Interference recoveries (albumin, bilirubin, cholesterol, '
              'creatinine, triglycerides, uric acid) 85.7–115.5 %. No carryover.'),
    trans=[x for (n, pol, cone, qn, ql, ist) in T102 for x in (
        (n, 0, qn[0], qn[1], qn[2], cone, None, 1, 'ESI' + pol, ist[0]),
        (n, 0, ql[0], ql[1], ql[2], cone, None, 0, 'ESI' + pol, ist[0]),
        (ist[0], 1, ist[1], ist[2], ist[3], cone, None, 1, 'ESI' + pol, None))],
    grad=[(t, b, 0.5, c) for t, b, c in G102],
    val=[(n, None, sens, None, cv, round(100 + bias, 1),
          f'Calibration {lo}–{hi} µg/mL; QCs {qcs} µg/mL. Analytical sensitivity {sens} µg/mL (n=50): CV {cv} %, bias {bias:+} % (stored as LOQ, CV and accuracy). '
          f'Total precision L/M/H {tp[0]}/{tp[1]}/{tp[2]} %; repeatability {rp[0]}/{rp[1]}/{rp[2]} %.')
         for n, lo, hi, qcs, sens, cv, bias, tp, rp in V102]),
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
