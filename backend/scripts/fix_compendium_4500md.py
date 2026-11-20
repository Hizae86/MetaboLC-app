"""Correct the 16 methods imported from the SCIEX 4500MD system compendium (2025, MKT-35431-A).

Every value below was read from the compendium's analytical performance sheets.
Fields the compendium does not report (gradient, source and gas parameters, full MRM
list, column temperature...) are cleared rather than kept, because the earlier values
did not come from the source. Run from the repo root:  python3 backend/scripts/fix_compendium_4500md.py
"""
import sqlite3, sys

DB = 'metabolc.db'
URL = 'https://sciex.com/landing-pages/4500md-compendium'
REF = 'SCIEX 4500MD system compendium (2025), MKT-35431-A, pp. {pages}'

# Columns cleared on every method: not reported anywhere in the compendium.
CLEAR = [
    'analyte_cas', 'column_temperature_c', 'autosampler_temperature_c', 'needle_wash_solvent',
    'capillary_voltage_v', 'source_temperature_c', 'desolvation_temperature_c', 'desolvation_gas_flow',
    'curtain_gas', 'collision_gas', 'desolvation_gas_flow_lh', 'cone_gas_flow_lh', 'interface_voltage_kv',
    'heating_gas_flow', 'dl_temperature', 'interface_temperature', 'nebulizing_gas', 'drying_gas',
    'heat_block_temperature', 'ion_spray_voltage', 'gas1', 'gas2', 'gas_temperature', 'gas_flow_lmin',
    'nebulizer_pressure_psi', 'capillary_voltage_pos_v', 'capillary_voltage_neg_v',
    'lloq', 'uloq', 'cv_intra_percent', 'cv_inter_percent', 'recovery_percent',
]

def note(pages, run, flow, ntrans, extra='', perf='n=3 replicate injections', weighting='linear regression with 1/x weighting'):
    acq = (f'{ntrans} MRM transitions were acquired; only those printed in the chromatogram labels are listed here.' if ntrans
           else 'The number of transitions acquired is not stated; only those printed in the chromatogram labels are listed here.' if ntrans is None
           else 'No transitions are printed in the sheet.')
    s = (f'Source: SCIEX 4500MD system compendium (2025), pp. {pages}. Vendor analytical performance sheet with illustrative data, not a full validation. '
         f'Total run time {run} min at {flow} µL/min. Not reported in the compendium: gradient program, ion source and gas parameters, and the full MRM list; '
         f'compound-dependent parameters were optimised by infusion. {acq} Calibration: {weighting}. '
         f'Performance in the Validation tab is at the lowest calibrator ({perf}); LOQ there is the lowest calibrator, not a determined LOQ.')
    return s + (' ' + extra if extra else '')

# compound rows: (name, low, high, accuracy, cv, s/n, r2)
M = {
 2: dict(pages='85–87', title='Cortisol and cortisone in human urine (dilute and shoot)', analyte='Cortisol and cortisone',
         matrix='urine', app='Endocrinology', ion='ESI+', col=('Phenomenex', 'Luna Omega Polar C18', 'Polar C18', 100, 2.1, 2.1),
         mpa='Mobile phase A from the Diagnotix reagent set (composition not reported)', mpb='Mobile phase B from the Diagnotix reagent set (composition not reported)',
         inj=5, prep='Dilute and Shoot',
         prep_d="Diagnotix cortisol & cortisone reagent set (urine), used according to the manufacturer's instructions; 100 µL calibrators in human urine. Reagent set available only in certain EU countries.",
         unit='nmol/L', run=5, flow=550, ntrans=8,
         extra='Column as printed: "Phenomenex Kinetex Luna Omega Polar C18 (100 x 2.1 mm, 2.1 µm, 00D-4760-AN)". The second chromatogram label reads "Cortisol 1 (361.4/163.2)"; 361.4 is the cortisone precursor and the trace is shown as cortisone, so it is listed under cortisone. Data produced in collaboration with Diagnotix.',
         trans=[('Cortisol', 363.4, 121.1, '+', 1), ('Cortisone', 361.4, 163.2, '+', 1)],
         val=[('Cortisol', 34.0, 601.0, 104.3, 1.6, '412:1', 0.9993), ('Cortisone', 41.0, 693.0, 99.0, 0.4, '460:1', 0.9986)]),
 4: dict(pages='79–84', title='Panel of steroid hormones in human serum',
         analyte='Steroid panel: corticosterone, cortisol, androstenedione, progesterone, 11-deoxycortisol, 21-deoxycortisol, 17-OH-progesterone, testosterone, DHEAS',
         matrix='serum', app='Endocrinology', ion='ESI+/ESI- (polarity switching 50ms)', col=('Phenomenex', 'Kinetex Biphenyl', 'Biphenyl', 150, 2.1, 2.6),
         mpa='Mobile phase A from the Diagnotix reagent set (composition not reported)', mpb='Mobile phase B from the Diagnotix reagent set (composition not reported)',
         inj=20, prep='Other',
         prep_d="Diagnotix 'steroid panel basic' reagent set, used according to the manufacturer's instructions; 100 µL calibrators in serum. Extraction technique not described in the compendium. Reagent set available only in certain EU countries.",
         unit='nmol/L', run=10, flow=800, ntrans=45, set={'capillary_voltage_pos_v': 5500, 'capillary_voltage_neg_v': -4500},
         extra='Column p/n 00F-4622-AN. Rapid (50 ms) polarity switching. Ion spray voltages (+5500 V / −4500 V) and EP 10 are taken from the chromatogram headers ("EP-10, IS-5500" for 41 positive transitions; "EP-10, IS-4500" for 4 negative transitions).',
         trans=[('Corticosterone', 347.2, 329.2, '+', 1), ('DHEAS', 367.2, 96.9, '-', 0)],
         val=[('Corticosterone', 0.2, 44.2, 110.7, 4.6, '29:1', 0.9977), ('Cortisol', 8.3, 856.1, 103.6, 3.9, '446:1', 0.9991),
              ('Androstenedione', 0.5, 49.3, 107.8, 2.4, '55:1', 0.9990), ('Progesterone', 0.4, 63.0, 110.3, 0.7, '35:1', 0.9992),
              ('11-Deoxycortisol', 0.4, 45.7, 106.9, 8.0, '26:1', 0.9990), ('21-Deoxycortisol', 0.3, 20.8, 92.0, 1.2, '16:1', 0.9993),
              ('17-OH-Progesterone', 0.3, 35.6, 98.6, 7.4, '41:1', 0.9995), ('Testosterone', 0.9, 60.9, 105.0, 7.6, '145:1', 0.9993),
              ('DHEAS', 0.2, 12.2, 107.4, 0.9, '1599:1', 0.9975)]),
 5: dict(pages='69–71', title='25-OH-vitamin D3, 3-epi-25-OH-vitamin D3 and 25-OH-vitamin D2 in human serum',
         analyte='25-OH-vitamin D3, 3-epi-25-OH-vitamin D3 and 25-OH-vitamin D2', matrix='serum', app='Vitamins', ion='ESI+',
         col=('Phenomenex', 'Kinetex PFP', 'PFP', 100, 3.0, 2.6), mpa='Formic acid in water', mpb='Formic acid in methanol', inj=None,
         prep='Liquid-Liquid Extraction (LLE)', prep_d='Liquid-liquid extraction of 200 µL spiked human serum, evaporation and reconstitution in 175 µL methanol/water (80:20, v/v). Extraction solvent not reported.',
         unit='ng/mL', run=6, flow=400, ntrans=0, set={'lloq': 1, 'uloq': 100},
         extra='Column p/n 00D-4477-Y0. Injection volume, %CV and calibration weighting are not reported. The table of contents says "in human plasma" but the sheet itself reports human serum throughout.',
         perf='% accuracy; number of replicates and %CV not reported', weighting='not reported',
         trans=[],
         val=[('25-OH-vitamin D3', 1, 100, 93.5, None, None, 0.9938), ('3-epi-25-OH-vitamin D3', 1, 100, 82.7, None, None, 0.9966),
              ('25-OH-vitamin D2', 1, 100, 119.3, None, None, 0.9958)]),
 6: dict(pages='36–38', title='Immunosuppressants in human whole blood (sirolimus, cyclosporin A, tacrolimus, everolimus)',
         analyte='Immunosuppressant panel: sirolimus, cyclosporin A, tacrolimus, everolimus', matrix='whole blood', app='Immunosuppressants', ion='ESI+',
         col=('Phenomenex', 'Kinetex XB-C18', 'XB-C18', 50, 2.1, 2.6),
         mpa='Mobile phase A from the Diagnotix reagent set (composition not reported)', mpb='Mobile phase B from the Diagnotix reagent set (composition not reported)',
         inj=20, prep='Other',
         prep_d="Diagnotix immunosuppressants reagent set, used according to the manufacturer's instructions; 50 µL calibrators in human whole blood. Extraction technique not described in the compendium. Reagent set available only in certain EU countries.",
         unit='ng/mL', run=3, flow=500, ntrans=19,
         extra='Column p/n 00B-4496-AN. The only chromatogram label reads "Tacrolimus 1 (824.6/7768.5)", which is not a valid transition as printed, so no transition is listed. Calibration weighting not stated.',
         weighting='linear regression (weighting not stated)',
         trans=[],
         val=[('Sirolimus', 1.5, 50.0, 100.2, 4.6, '57:1', 0.9979), ('Cyclosporin A', 23.6, 1473.0, 98.4, 2.8, '87:1', 0.9980),
              ('Tacrolimus', 1.6, 43.5, 101.7, 3.2, '275:1', 0.9965), ('Everolimus', 1.2, 39.7, 101.9, 3.2, '46:1', 0.9949)]),
 7: dict(pages='39–41', title='Tricyclic antidepressants (TCAs) and metabolites in human serum',
         analyte='TCA panel: amitriptyline, nortriptyline, E- and Z-10-OH-nortriptyline, imipramine, desipramine, clomipramine, norclomipramine, clozapine, norclozapine, zuclopenthixol',
         matrix='serum', app='Antidepressants', ion='ESI+', col=('Phenomenex', 'Luna Omega Polar C18', 'Polar C18', 100, 2.1, 1.6),
         mpa='Mobile phase A from the Diagnotix reagent set (composition not reported)', mpb='Mobile phase B from the Diagnotix reagent set (composition not reported)',
         inj=3, prep='Other',
         prep_d="Diagnotix psychotropic medication 1 reagent set, used according to the manufacturer's instructions; 25 µL calibrators in human serum. Extraction technique not described in the compendium. Reagent set available only in certain EU countries.",
         unit='μg/L', run=7.5, flow=400, ntrans=39,
         extra='Column as printed: "Phenomenex Kinetex Luna Omega Polar C18 (100 x 2.1 mm, 1.6 µm, 00D-4748-AN)". The sheet calls it 7 TCAs and 4 metabolites; the table also includes clozapine, norclozapine and zuclopenthixol. Weighting not stated.',
         weighting='linear regression (weighting not stated)',
         trans=[('Zuclopenthixol', 401.2, 221.0, '+', 0)],
         val=[('Zuclopenthixol', 3.5, 66.7, 93.0, 6.7, '109:1', 0.9981), ('Clozapine', 55.7, 922.0, 96.9, 5.6, '2106:1', 0.9977),
              ('Clomipramine', 19.0, 486.0, 94.5, 5.5, '431:1', 0.9977), ('Norclozapine', 46.1, 605.0, 98.5, 1.2, '1970:1', 0.9984),
              ('Norclomipramine', 21.7, 528.0, 103.2, 2.7, '565:1', 0.9993), ('Imipramine', 16.2, 406.0, 100.8, 2.2, '193:1', 0.9990),
              ('E-OH-Nortriptyline', 28.3, 306.0, 99.8, 4.3, '62:1', 0.9982), ('Amitriptyline', 13.8, 376.0, 106.8, 9.0, '106:1', 0.9973),
              ('Desipramine', 26.0, 486.0, 102.3, 5.5, '960:1', 0.9974), ('Nortriptyline', 15.7, 303.0, 99.3, 0.4, '436:1', 0.9974),
              ('Z-OH-Nortriptyline', 7.5, 121.0, 97.6, 4.7, '74:1', 0.9968)]),
 8: dict(pages='42–45', title='Neuroleptics in human serum (risperidone, 9-OH-risperidone, aripiprazole, clozapine, haloperidol, olanzapine, quetiapine)',
         analyte='Neuroleptic panel: risperidone, 9-OH-risperidone, aripiprazole, clozapine, haloperidol, olanzapine, quetiapine',
         matrix='serum', app='Antipsychotic Drugs', ion='ESI+', col=('Phenomenex', 'Kinetex Biphenyl', 'Biphenyl', 150, 2.1, 2.6),
         mpa='Mobile phase A from the Diagnotix reagent set (composition not reported)', mpb='Mobile phase B from the Diagnotix reagent set (composition not reported)',
         inj=5, prep='Other',
         prep_d="Diagnotix psychotropic medication 2 reagent set, used according to the manufacturer's instructions; 100 µL calibrators in serum. Extraction technique not described in the compendium. Reagent set available only in certain EU countries.",
         unit='μg/L', run=7, flow=450, ntrans=28, extra='Column p/n 00F-4622-AN.',
         trans=[('9-OH-Risperidone', 427.0, 207.2, '+', 1)],
         val=[('9-OH-Risperidone', 4.2, 134.0, 87.3, 6.4, '586:1', 0.9905), ('Aripiprazole', 13.4, 675.0, 90.4, 3.4, '4137:1', 0.9925),
              ('Clozapine', 63.6, 1157.0, 99.2, 3.0, '3938:1', 0.9920), ('Haloperidol', 1.8, 45.7, 97.1, 1.3, '396:1', 0.9988),
              ('Olanzapine', 5.5, 245.0, 96.1, 1.2, '56:1', 0.9940), ('Quetiapine', 17.5, 740.0, 92.6, 6.3, '1057:1', 0.9954),
              ('Risperidone', 4.7, 75.1, 101.3, 3.6, '298:1', 0.9917)]),
 9: dict(pages='46–49', title='Antidepressants in human serum (12 antidepressants and metabolites)',
         analyte='Antidepressant panel: citalopram, norcitalopram, fluoxetine, norfluoxetine, fluvoxamine, mirtazapine, normirtazapine, paroxetine, sertraline, norsertraline, venlafaxine, norvenlafaxine',
         matrix='serum', app='Antidepressants', ion='ESI+', col=('Phenomenex', 'Kinetex Biphenyl', 'Biphenyl', 150, 2.1, 2.6),
         mpa='Mobile phase A from the Diagnotix reagent set (composition not reported)', mpb='Mobile phase B from the Diagnotix reagent set (composition not reported)',
         inj=5, prep='Other',
         prep_d="Diagnotix psychotropic medication 3 reagent set, used according to the manufacturer's instructions; 100 µL calibrators in serum. Extraction technique not described in the compendium. Reagent set available only in certain EU countries.",
         unit='μg/L', run=7.5, flow=500, ntrans=39, extra='Column p/n 00F-4622-AN.',
         trans=[('Citalopram', 325.2, 109.0, '+', 1)],
         val=[('Citalopram', 10.0, 530.0, 93.7, 3.9, '387:1', 0.9991), ('Fluoxetine', 29.0, 1000.0, 94.5, 1.3, '343:1', 0.9990),
              ('Fluvoxamine', 15.0, 805.0, 91.2, 5.0, '779:1', 0.9971), ('Mirtazapine', 6.4, 202.0, 100.3, 8.0, '202:1', 0.9985),
              ('Norcitalopram', 6.2, 340.0, 92.4, 2.5, '144:1', 0.9998), ('Norfluoxetine', 33.0, 1000.0, 88.9, 2.1, '340:1', 0.9967),
              ('Normirtazapine', 6.5, 190.0, 99.1, 6.0, '110:1', 0.9970), ('Norsertraline', 25.0, 335.0, 101.8, 3.7, '141:1', 0.9937),
              ('Norvenlafaxine', 15.0, 740.0, 95.7, 3.0, '1609:1', 0.9976), ('Paroxetine', 5.3, 480.0, 103.4, 6.5, '229:1', 0.9981),
              ('Sertraline', 15.0, 500.0, 95.0, 6.5, '1427:1', 0.9983), ('Venlafaxine', 14.0, 770.0, 97.6, 1.7, '2087:1', 0.9979)]),
 10: dict(pages='25–29', title='Fentanyl and 28 fentanyl analogs in human whole blood', analyte='Fentanyl and 28 fentanyl analogs (29 compounds)',
          matrix='whole blood', app='Toxicology', ion='ESI+', col=('Phenomenex', 'Kinetex Biphenyl', 'Biphenyl', 150, 2.1, 2.6),
          mpa='Formic acid in water', mpb='Formic acid in methanol/acetonitrile (50:50, v/v)', inj=5, prep='Protein Precipitation (PPT)',
          prep_d='Protein precipitation of 400 µL spiked human whole blood, evaporation and reconstitution in 125 µL methanol/acetonitrile/water (20:20:60, v/v). Precipitation solvent not reported.',
          unit='ng/mL', run=17, flow=300, ntrans=63, set={'lloq': 0.1, 'uloq': 100},
          extra='Column p/n 00D-4759-AN. p-FBF/m-FBF and p-FIBF/m-FIBF are reported as combined isomer pairs. The S/N for N-methyl norfentanyl is printed as "70.1"; kept as printed.',
          perf='% accuracy, n=3; %CV not reported',
          trans=[('Butyryl fentanyl', 351.3, 188.0, '+', 1), ('N-Methyl norfentanyl', 247.2, 70.0, '+', 0)],
          val=[(n, 0.1, 100, a, None, s, r) for n, a, s, r in [
              ('2-Furanyl fentanyl', 80.7, '490:1', 0.9989), ('4-ANPP', 80.1, '497:1', 0.9990), ('Acetyl fentanyl', 88.3, '286:1', 0.9989),
              ('Acrylfentanyl', 81.1, '265:1', 0.9992), ('Alfentanil', 84.2, '234:1', 0.9999), ('Benzyl fentanyl', 86.5, '309:1', 0.9989),
              ('Beta-hydroxy fentanyl', 86.5, '358:1', 0.9999), ('Butyryl fentanyl', 81.6, '55:1', 0.9994), ('Carfentanil', 84.4, '158:1', 0.9999),
              ('Cis-3-methylfentanyl', 86.0, '60:1', 0.9995), ('Crotonyl fentanyl', 108.4, '78:1', 0.9997), ('Cyclopropyl fentanyl', 81.2, '121:1', 0.9989),
              ('Fentanyl', 90.6, '250:1', 0.9996), ('Iso-butyryl fentanyl', 88.6, '46:1', 0.9994), ('Methoxyacetyl fentanyl', 86.4, '738:1', 0.9997),
              ('N-Methyl norfentanyl', 105.4, '70.1 (as printed)', 0.9996), ('Norcarfentanil', 95.3, '113:1', 0.9995), ('Norfentanyl', 109.4, '35:1', 0.9997),
              ('o-FBF', 89.1, '129:1', 0.9995), ('para-Fluorofentanyl', 99.1, '47:1', 0.9997), ('p-FBF/m-FBF', 95.0, '61:1', 0.9997),
              ('p-FIBF/m-FIBF', 102.5, '55:1', 0.9999), ('p-Fluoro acrylfentanyl', 100.0, '226:1', 0.9997), ('Phenyl fentanyl', 83.8, '177:1', 0.9997),
              ('p-Methoxy acetyl fentanyl', 102.5, '224:1', 0.9998), ('Sufentanil', 98.7, '276:1', 0.9995), ('trans-3-Methylfentanyl', 99.2, '81:1', 0.9995)]]),
 11: dict(pages='18–20', title='Ethyl glucuronide (EtG) and ethyl sulfate (EtS) in human urine', analyte='EtG and EtS (alcohol biomarkers)',
          matrix='urine', app='Alcohol Biomarkers', ion='ESI-', col=('Chromsystems', 'Analytical column supplied with the MassChrom EtG/EtS kit', None, None, None, None),
          mpa='Mobile phase A supplied with the Chromsystems kit (composition not reported)', mpb='Mobile phase B supplied with the Chromsystems kit (composition not reported)',
          inj=20, prep='Other',
          prep_d="Chromsystems MassChrom® Ethyl Glucuronide, Ethyl Sulfate in Urine kit, used according to the manufacturer's instructions. Sample treatment not described in the compendium.",
          unit='μg/L', run=6, flow=500, ntrans=6,
          trans=[('EtG', 220.9, 75.0, '-', 1), ('EtS', 124.8, 79.9, '-', 1)],
          val=[('EtG', 83.1, 11878.0, 99.1, 5.9, '12:1', 0.9992), ('EtS', 45.8, 3262.0, 102.1, 3.9, '300:1', 0.9993)]),
 12: dict(pages='21–22', title='Phosphatidylethanol (PEth 16:0/18:1) in human whole blood', analyte='Phosphatidylethanol 16:0/18:1 (PEth)',
          matrix='whole blood', app='Alcohol Biomarkers', ion='ESI-', col=('Phenomenex', 'Luna Omega', None, 30, 2.1, 1.6),
          mpa='Ammonium formate in water/IPA/acetonitrile (30:10:60, v/v)', mpb='Ammonium formate in water/IPA/acetonitrile (1:79:20, v/v)', inj=10,
          prep='Protein Precipitation (PPT)',
          prep_d='100 µL human whole blood + 400 µL isopropyl alcohol spiked with internal standard; mix thoroughly, centrifuge 10 min at 13,500 rpm; transfer 200 µL supernatant to a vial for analysis.',
          unit='ng/mL', run=3.5, flow=450, ntrans=5, set={'lloq': 20, 'uloq': 2000},
          extra='Column as printed: "Phenomenex Luna Omega (30 x 2.1 mm, 1.6 µm, 00A-4748-AN)"; the phase is not named. The internal standard is not named. Weighting not stated.',
          perf='n=4 replicate injections', weighting='linear regression (weighting not stated)',
          trans=[('PEth 16:0/18:1', 701.5, 280.8, '-', 1)],
          val=[('PEth 16:0/18:1', 20, 2000, 101.6, 3.3, '805:1', 0.9922)]),
 13: dict(pages='92–94', title='Metanephrines in human serum (metanephrine, normetanephrine and 3-methoxytyramine)',
          analyte='Metanephrine, normetanephrine and 3-methoxytyramine (3-MT)', matrix='serum', app='Catecholamines', ion='ESI+',
          col=('Phenomenex', 'Kinetex HILIC', 'HILIC', 150, 2.1, 2.6),
          mpa='Mobile phase A from the Diagnotix reagent set (composition not reported)', mpb='Mobile phase B from the Diagnotix reagent set (composition not reported)',
          inj=20, prep='Other',
          prep_d="Diagnotix metanephrines reagent set, used according to the manufacturer's instructions; 500 µL calibrators in human serum. Extraction technique not described in the compendium. Reagent set available only in certain EU countries.",
          unit='nmol/L', run=5, flow=550, ntrans=13, extra='Column p/n 00F-4461-AN.',
          trans=[('3-MT', 151.1, 91.0, '+', 0)],
          val=[('Metanephrine', 0.16, 6.41, 106.3, 2.1, '80:1', 0.9996), ('Normetanephrine', 0.19, 7.22, 108.8, 4.8, '26:1', 0.9986),
               ('3-MT', 0.15, 5.83, 94.7, 3.9, '14:1', 0.9989)]),
 14: dict(pages='95–97', title='Methylmalonic acid (MMA) in human serum', analyte='Methylmalonic acid (MMA)', matrix='serum', app='Metabolic Disorders', ion='ESI-',
          col=('Phenomenex', 'Luna Omega Polar C18', 'Polar C18', 150, 2.1, 3.0),
          mpa='Mobile phase A from the Diagnotix reagent set (composition not reported)', mpb='Mobile phase B from the Diagnotix reagent set (composition not reported)',
          inj=15, prep='Other',
          prep_d="Diagnotix methylmalonic acid reagent set, used according to the manufacturer's instructions; 100 µL calibrators in human serum. Extraction technique not described in the compendium. Reagent set available only in certain EU countries.",
          unit='nmol/L', run=6, flow=600, ntrans=3, set={'lloq': 143.0, 'uloq': 1651.0}, extra='Column p/n 00F-4760-AN.',
          trans=[('MMA', 116.9, 73.0, '-', 1)],
          val=[('MMA', 143.0, 1651.0, 100.8, 1.0, '24:1', 0.9996)]),
 15: dict(pages='62–64', title='Antiretroviral drugs (NRTIs) in human plasma (lamivudine, abacavir, zidovudine, stavudine, didanosine, emtricitabine)',
          analyte='NRTI panel: lamivudine (3TC), abacavir (ABC), zidovudine (AZT), stavudine (d4T), didanosine (ddI), emtricitabine (FTC)',
          matrix='plasma', app='Therapeutic Drug Monitoring', ion='ESI+', col=('Phenomenex', 'Kinetex C18', 'C18', 50, 3.0, 2.6),
          mpa='Formic acid in water/methanol (90:10, v/v)', mpb='Formic acid in methanol with modifiers', inj=20, prep='Protein Precipitation (PPT)',
          prep_d='150 µL spiked human plasma + 400 µL methanol; vortex 3 min; centrifuge 5 min at 14,000 rpm; evaporate and reconstitute in 300 µL methanol/water (10:90, v/v); vortex and centrifuge 5 min at 10,000 rpm to remove insoluble material before analysis.',
          unit='nmol/L', run=4, flow=700, ntrans=18, extra='Column p/n 00B-4462-Y0. "Modifiers" in mobile phase B are not specified.',
          trans=[('Lamivudine (3TC)', 230.0, 112.0, '+', 1)],
          val=[('Lamivudine (3TC)', 5, 5000, 88.2, 1.9, '8:1', 0.9963), ('Abacavir (ABC)', 5, 5000, 99.4, 8.6, '11:1', 0.9939),
               ('Zidovudine (AZT)', 10, 5000, 101.9, 8.8, '7:1', 0.9963), ('Stavudine (d4T)', 50, 5000, 97.8, 8.0, '5:1', 0.9965),
               ('Didanosine (ddI)', 10, 5000, 101.7, 3.7, '9:1', 0.9963), ('Emtricitabine (FTC)', 10, 5000, 105.9, 9.0, '10:1', 0.9977)]),
 16: dict(pages='65–68', title='Antifungals in human plasma (caspofungin, fluconazole, hydroxyitraconazole, itraconazole, voriconazole)',
          analyte='Antifungal panel: caspofungin, fluconazole, hydroxyitraconazole, itraconazole, voriconazole', matrix='plasma', app='Antifungals', ion='ESI+',
          col=('Phenomenex', 'Kinetex Biphenyl', 'Biphenyl', 150, 2.1, 2.6), mpa='Formic acid in water', mpb='Formic acid in methanol', inj=25,
          prep='Protein Precipitation (PPT)', prep_d='Protein precipitation of 100 µL spiked human plasma with methanolic zinc sulfate, centrifugation and direct injection of the supernatant.',
          unit='μg/mL', run=5, flow=600, ntrans=0,
          extra='Column p/n 00F-4622-AN. Accuracy and S/N are not reported for this sheet. Weighting is inconsistent in the source: the text says 1/x² for all five compounds, while the calibration plots show 1/x for caspofungin, fluconazole and itraconazole and 1/x² for voriconazole.',
          perf='%CV, n=6; accuracy not reported', weighting='linear regression (1/x or 1/x², see below)',
          trans=[],
          val=[('Caspofungin', 0.09, 1.8, None, 10.6, None, 0.9889), ('Fluconazole', 0.2, 10, None, 16.5, None, 0.9962),
               ('Hydroxyitraconazole', 0.05, 1, None, 12.0, None, 0.9771), ('Itraconazole', 0.05, 1, None, 18.3, None, 0.9818),
               ('Voriconazole', 0.005, 2.5, None, 7.6, None, 0.9890)]),
 17: dict(pages='30–31', title='Mitragynine and 7-hydroxymitragynine in human urine (kratom alkaloids)', analyte='Mitragynine and 7-hydroxymitragynine',
          matrix='urine', app='Toxicology', ion='ESI+', col=('Phenomenex', 'Biphenyl', 'Biphenyl', 50, 3.0, 2.6),
          mpa='Formic acid in water', mpb='Formic acid in methanol/acetonitrile (50:50, v/v)', inj=10, prep='Enzymatic Hydrolysis',
          prep_d='100 µL urine + 25 µL IMCS Rapid Hydrolysis Buffer + 20 µL IMCSzyme + 10 µL internal standard (1 ng/mL); incubate 60 min at 55 °C; add 0.2 mL methanol and 0.625 mL water; centrifuge 10 min at 21,000 g; transfer 50 µL supernatant to a UHPLC vial.',
          unit='ng/mL', run=4.5, flow=500, ntrans=None, set={'lloq': 2, 'uloq': 500},
          extra='Column as printed: "Phenomenex Biphenyl column (50 × 3 mm, 2.6 µm, 00B-4462-Y0)"; the same part number is given for a Kinetex C18 column on the antiretroviral sheet, so check it. Internal standard not named.',
          trans=[('Mitragynine', 399.2, 174.1, '+', 1), ('7-Hydroxymitragynine', 415.2, 190.1, '+', 1)],
          val=[('Mitragynine', 2, 500, 87.4, 5.9, '28:1', 0.9993), ('7-Hydroxymitragynine', 2, 500, 86.8, 5.2, '13:1', 0.9986)]),
 18: dict(pages='23–24', title='11-nor-9-carboxy-THC (THC-COOH) in human hair', analyte='11-nor-9-carboxy-THC (THC-COOH)', matrix=None, app=None, ion='ESI-',
          col=('Phenomenex', 'Kinetex Phenyl-Hexyl', 'Phenyl-Hexyl', 50, 2.6, 3.0),
          mpa='Acetic acid in water', mpb='Acetic acid in methanol', inj=10, prep='Solid Phase Extraction (SPE)',
          prep_d="SPE on Phenomenex HPSAX 1 mL columns (SPEware, 412-0201R) from 25 mg clean, pulverised human hair spiked at four calibrator levels, following the manufacturer's SPE protocol; evaporate the eluate and reconstitute in 100 µL methanol.",
          unit='pg/mg', run=6.5, flow=750, ntrans=4, set={'lloq': 0.2, 'uloq': 2.0},
          extra='Column as printed: "Phenomenex Kinetex Phenomenex Phenyl-Hexyl (50 x 2.6 mm, 3 µm, 00B-4495-Y0)"; a 2.6 mm internal diameter is unusual, so check it. Weighting not stated.',
          weighting='linear regression (weighting not stated)',
          trans=[('THC-COOH', 342.9, 245.1, '-', 1)],
          val=[('THC-COOH', 0.2, 2.0, 99.4, 12.8, '15:1', 0.9996)]),
}

def main(dry):
    c = sqlite3.connect(DB)
    cur = c.cursor()
    for mid, d in M.items():
        assert cur.execute('select reference from methods where id=?', (mid,)).fetchone()[0].startswith('SCIEX 4500MD'), mid
        f = {k: None for k in CLEAR}
        f.update(title=d['title'], analyte=d['analyte'], ionization_mode=d['ion'], instrument_manufacturer='Sciex', instrument_model='Triple Quad 4500MD',
                 column_brand=d['col'][0], column_name=d['col'][1], column_stationary_phase=d['col'][2], column_length_mm=d['col'][3],
                 column_diameter_mm=d['col'][4], column_particle_size_um=d['col'][5], mobile_phase_a=d['mpa'], mobile_phase_b=d['mpb'],
                 injection_volume_ul=d['inj'], sample_prep_method=d['prep'], sample_prep_details=d['prep_d'],
                 lloq_unit=d['unit'], validation_units=d['unit'], reference=REF.format(pages=d['pages']), source_type='Vendor compendium',
                 source_authors='SCIEX', source_url=URL, is_derivatized=0,
                 notes=note(d['pages'], d['run'], d['flow'], d['ntrans'], d.get('extra', ''), d.get('perf', 'n=3 replicate injections'),
                            d.get('weighting', 'linear regression with 1/x weighting')))
        if d['matrix']: f['matrix'] = d['matrix']
        if d['app']: f['clinical_application'] = d['app']
        f.update(d.get('set', {}))
        cur.execute(f"update methods set {', '.join(k + '=?' for k in f)}, updated_at=datetime('now') where id=?", (*f.values(), mid))
        cur.execute('delete from gradient_steps where method_id=?', (mid,))
        cur.execute('delete from mrm_transitions where method_id=?', (mid,))
        for name, q1, q3, pol, quant in d['trans']:
            cur.execute('insert into mrm_transitions (method_id, compound_name, is_internal_standard, precursor_mz, product_mz, is_quantifier, polarity, is_derivatized) values (?,?,?,?,?,?,?,0)',
                        (mid, name, 0, q1, q3, quant, 'ESI+' if pol == '+' else 'ESI-'))
        cur.execute('delete from compound_validation where method_id=?', (mid,))
        mat = d['matrix'] or cur.execute('select matrix from methods where id=?', (mid,)).fetchone()[0]
        for name, lo, hi, acc, cv, sn, r2 in d['val']:
            n = f"Range {lo}–{hi} {d['unit']}. Values at the lowest calibrator." + (f' S/N {sn} (peak-to-peak).' if sn else '')
            cur.execute('insert into compound_validation (method_id, compound_name, lod, loq, r2, cv_percent, accuracy_percent, matrix, notes, lod_na, loq_na, r2_na, cv_percent_na, accuracy_percent_na) values (?,?,?,?,?,?,?,?,?,0,0,0,0,0)',
                        (mid, name, None, lo, r2, cv, acc, mat, n))
        print(f"{mid}: {len(d['trans'])} transitions, {len(d['val'])} validation rows · {d['title'][:70]}")
    if dry: c.rollback(); print('DRY RUN, rolled back')
    else: c.commit(); print('committed')

if __name__ == '__main__':
    main('--dry' in sys.argv)
