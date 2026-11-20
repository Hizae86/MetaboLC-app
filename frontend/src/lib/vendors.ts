/** Vendor-specific vocabularies: instrument models, the source parameters each
 *  vendor exposes (and what they call them) and the per-transition columns. */
export const INSTRUMENTS: Record<string, string[]> = {
  'Sciex': [
    'QTRAP 3200', 'Citrine Triple Quad', 'Triple Quad 3500', 'Triple Quad 4500', 'Triple Quad 4500MD',
    'Triple Quad 5500', 'Triple Quad 5500+', 'Triple Quad 6500',
    'Triple Quad 6500+', 'Triple Quad 7500',
    'QTRAP 4500', 'QTRAP 5500', 'QTRAP 6500+',
    'ZenoTOF 7600', 'Other'
  ],
  'Waters': [
    'Xevo TQ-S', 'Xevo TQ-S micro', 'Xevo TQ-Absolute', 'Xevo TQ-XS',
    'Xevo TQD', 'Quattro Premier XE', 'Quattro Micro',
    'Xevo G3 Q-TOF', 'SELECT SERIES MRT', 'SYNAPT XS', 'Other'
  ],
  'Thermo Fisher': [
    'TSQ Vantage', 'TSQ Quantis', 'TSQ Quantis Plus', 'TSQ Altis', 'TSQ Altis Plus',
    'TSQ Fortis', 'TSQ Endura', 'TSQ Quantiva',
    'Q Exactive', 'Q Exactive Plus', 'Q Exactive HF',
    'Orbitrap Exploris 120', 'Orbitrap Exploris 240', 'Orbitrap Exploris 480',
    'Orbitrap Astral', 'Orbitrap Fusion Lumos', 'Other'
  ],
  'Agilent': [
    '6410', '6420', '6430', '6460', '6470', '6475', '6490', '6495C', '6495D', 'Ultivo LC/TQ', 'InfinityLab LC/TQ',
    '6545', '6546', '6560 Ion Mobility Q-TOF', 'Other'
  ],
  'Shimadzu': [
    'LCMS-8040', 'LCMS-8045', 'LCMS-8050', 'LCMS-8060', 'LCMS-8060NX',
    'LCMS-8090', 'LCMS-9030', 'LCMS-9050', 'Other'
  ],
  'Bruker': [
    'EVOQ Triple Quad', 'EVOQ Cube', 'EVOQ Elite',
    'timsTOF', 'timsTOF Pro', 'timsTOF Pro 2', 'timsTOF HT',
    'timsTOF Flex', 'impact II', 'Other'
  ],
  'PerkinElmer': ['QSight 210', 'QSight 220', 'QSight 225', 'Other'],
  'Other': ['Other']
}

export const MANUFACTURERS = ['Sciex', 'Waters', 'Thermo Fisher', 'Agilent', 'Shimadzu', 'Bruker', 'PerkinElmer', 'Other']

export const MS_SOURCE_PARAMS: Record<string, {label: string, field: string, unit: string}[]> = {
  'Sciex': [
    {label: 'IonSpray Voltage ESI+ (IS+)', field: 'capillary_voltage_pos_v', unit: 'V'},
    {label: 'IonSpray Voltage ESI- (IS-)', field: 'capillary_voltage_neg_v', unit: 'V'},
    {label: 'IonSpray Voltage (IS)', field: 'ion_spray_voltage', unit: 'V'},
    {label: 'Curtain Gas (CUR)', field: 'curtain_gas', unit: 'psi'},
    {label: 'Collision Gas (CAD)', field: 'collision_gas', unit: ''},
    {label: 'Source Temp (TEM)', field: 'source_temperature_c', unit: '°C'},
    {label: 'Ion Source Gas 1 (GS1)', field: 'gas1', unit: 'psi'},
    {label: 'Ion Source Gas 2 (GS2)', field: 'gas2', unit: 'psi'},
  ],
  'Waters': [
    {label: 'Capillary Voltage ESI+', field: 'capillary_voltage_pos_v', unit: 'kV'},
    {label: 'Capillary Voltage ESI-', field: 'capillary_voltage_neg_v', unit: 'kV'},
    {label: 'Capillary Voltage', field: 'capillary_voltage_v', unit: 'kV'},
    {label: 'Desolvation Temperature', field: 'desolvation_temperature_c', unit: '°C'},
    {label: 'Desolvation Gas', field: 'desolvation_gas_flow_lh', unit: 'L/h'},
    {label: 'Cone Gas', field: 'cone_gas_flow_lh', unit: 'L/h'},
    {label: 'Source Temperature', field: 'source_temperature_c', unit: '°C'},
  ],
  'Shimadzu': [
    {label: 'Interface Voltage', field: 'interface_voltage_kv', unit: 'kV'},
    {label: 'Heating Gas', field: 'heating_gas_flow', unit: 'L/min'},
    {label: 'DL Temperature', field: 'dl_temperature', unit: '°C'},
    {label: 'Interface Temperature', field: 'interface_temperature', unit: '°C'},
    {label: 'Nebulizing Gas', field: 'nebulizing_gas', unit: 'L/min'},
    {label: 'Heat Block', field: 'heat_block_temperature', unit: '°C'},
  ],
  'PerkinElmer': [
    {label: 'ElectroSpray Voltage ESI+', field: 'capillary_voltage_pos_v', unit: 'V'},
    {label: 'ElectroSpray Voltage ESI-', field: 'capillary_voltage_neg_v', unit: 'V'},
    {label: 'ElectroSpray Voltage', field: 'ion_spray_voltage', unit: 'V'},
    {label: 'Source Temperature', field: 'source_temperature_c', unit: '°C'},
    {label: 'HSID Temperature', field: 'desolvation_temperature_c', unit: '°C'},
    {label: 'Drying Gas', field: 'drying_gas', unit: 'L/h'},
    {label: 'Nebulizer Gas', field: 'nebulizing_gas', unit: 'L/h'},
    {label: 'Heating Gas', field: 'heating_gas_flow', unit: 'L/h'},
  ],
  'Agilent': [
    {label: 'Capillary Voltage ESI+', field: 'capillary_voltage_pos_v', unit: 'V'},
    {label: 'Capillary Voltage ESI-', field: 'capillary_voltage_neg_v', unit: 'V'},
    {label: 'Capillary Voltage', field: 'capillary_voltage_v', unit: 'V'},
    {label: 'Gas Temperature', field: 'gas_temperature', unit: '°C'},
    {label: 'Gas Flow', field: 'gas_flow_lmin', unit: 'L/min'},
    {label: 'Nebulizer Pressure', field: 'nebulizer_pressure_psi', unit: 'psi'},
    {label: 'Sheath Gas Heater', field: 'sheath_gas_heater_c', unit: '°C'},
    {label: 'Sheath Gas Flow', field: 'sheath_gas_flow_lmin', unit: 'L/min'},
    {label: 'Nozzle Voltage', field: 'nozzle_voltage_v', unit: 'V'},
  ],
  'Thermo Fisher': [
    {label: 'Spray Voltage ESI+ (kV)', field: 'capillary_voltage_pos_v', unit: 'kV'},
    {label: 'Spray Voltage ESI- (kV)', field: 'capillary_voltage_neg_v', unit: 'kV'},
    {label: 'Spray Voltage (kV)', field: 'capillary_voltage_v', unit: 'kV'},
    {label: 'Sheath Gas Flow', field: 'sheath_gas_flow_lmin', unit: 'Arb'},
    {label: 'Aux Gas Flow', field: 'aux_gas_flow', unit: 'Arb'},
    {label: 'Sweep Gas Flow', field: 'sweep_gas_flow', unit: 'Arb'},
    {label: 'Ion Transfer Tube Temp', field: 'ion_transfer_tube_temp_c', unit: '°C'},
    {label: 'Vaporizer Temp', field: 'vaporizer_temp_c', unit: '°C'},
    {label: 'Source Temperature', field: 'source_temperature_c', unit: '°C'},
    {label: 'Desolvation Temperature', field: 'desolvation_temperature_c', unit: '°C'},
  ],
  'Bruker': [
    {label: 'Ion Source Voltage ESI+', field: 'capillary_voltage_pos_v', unit: 'V'},
    {label: 'Ion Source Voltage ESI-', field: 'capillary_voltage_neg_v', unit: 'V'},
    {label: 'Probe Gas Flow', field: 'gas1', unit: 'units'},
    {label: 'Probe Gas Temperature', field: 'source_temperature_c', unit: '°C'},
    {label: 'Cone Gas Flow', field: 'gas2', unit: 'units'},
    {label: 'Cone Gas Temperature', field: 'desolvation_temperature_c', unit: '°C'},
    {label: 'Nebulizing Gas', field: 'nebulizer_pressure_psi', unit: 'units'},
    {label: 'Collision Gas', field: 'collision_gas', unit: 'mTorr'},
  ],
}

export const MFR_PARAMS: Record<string, {headers: string[], fields: string[]}> = {
  'Sciex':         { headers: ['Polarity', 'CE (eV)', 'DP (V)', 'CXP (V)'],           fields: ['polarity', 'collision_energy_ev', 'declustering_potential', 'cell_exit_potential'] },
  'PerkinElmer':   { headers: ['Polarity', 'CE (eV)', 'EV (V)', 'CCL2 (V)'],          fields: ['polarity', 'collision_energy_ev', 'declustering_potential', 'cell_exit_potential'] },
  'Waters':        { headers: ['Polarity', 'CE (eV)', 'Cone (V)'],                     fields: ['polarity', 'collision_energy_ev', 'cone_voltage'] },
  'Agilent':       { headers: ['Polarity', 'CE (eV)', 'Frag (V)', 'Cell Acc'],         fields: ['polarity', 'collision_energy_ev', 'declustering_potential', 'cell_accelerator_voltage'] },
  'Shimadzu':      { headers: ['Polarity', 'CE (eV)', 'Q1 Bias', 'Q3 Bias'],           fields: ['polarity', 'collision_energy_ev', 'q1_pre_bias', 'q3_pre_bias'] },
  'Thermo Fisher': { headers: ['Polarity', 'CE (eV)', 'RF Lens (V)', 'Resolution', 'Max IT (ms)'], fields: ['polarity', 'collision_energy_ev', 'rf_lens_v', 'ms_resolution', 'max_inject_time_ms'] },
  'Bruker':        { headers: ['Polarity', 'CE (eV)'],                     fields: ['polarity', 'collision_energy_ev'] },
  'Other':         { headers: ['Polarity', 'CE (eV)', 'DP (V)'],           fields: ['polarity', 'collision_energy_ev', 'declustering_potential'] },
}

/** Ion / differential mobility device in front of the MS (Sciex SelexION DMS,
 *  Thermo FAIMS…). Vendor-neutral fields, shown only when recorded. */
export const ION_MOBILITY_PARAMS: {label: string, field: string, unit: string, text?: boolean}[] = [
  {label: 'Device', field: 'ion_mobility_device', unit: '', text: true},
  {label: 'Separation voltage (SV)', field: 'im_separation_voltage_v', unit: 'V'},
  {label: 'Compensation voltage (CoV)', field: 'im_compensation_voltage_v', unit: 'V'},
  {label: 'DMS offset (DMO)', field: 'im_offset_v', unit: 'V'},
  {label: 'Cell temperature', field: 'im_temperature_c', unit: '°C'},
  {label: 'Resolution enhancement', field: 'im_resolution', unit: '', text: true},
  {label: 'Modifier', field: 'im_modifier', unit: '', text: true},
]

export const DEFAULT_SOURCE_PARAMS = [
  {label: 'Capillary Voltage', field: 'capillary_voltage_v', unit: 'V'},
  {label: 'Source Temperature', field: 'source_temperature_c', unit: '°C'},
]

export const transitionParams = (manufacturer?: string) => MFR_PARAMS[manufacturer || ''] || MFR_PARAMS['Other']
export const sourceParams = (manufacturer?: string) => MS_SOURCE_PARAMS[manufacturer || ''] || DEFAULT_SOURCE_PARAMS
