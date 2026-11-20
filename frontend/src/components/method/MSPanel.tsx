import { Zap } from 'lucide-react'
import TransitionsTable from './TransitionsTable'
import { Block, Panel, Specs } from './parts'
import { ION_MOBILITY_PARAMS, sourceParams } from '@/lib/vendors'

// High-resolution (Orbitrap) acquisition settings; shown only when recorded.
const HRMS_PARAMS = [
  { label: 'Acquisition mode', field: 'data_acquisition_mode', unit: '', text: true },
  { label: 'Full MS resolution', field: 'fullms_resolution', unit: '' },
  { label: 'Full MS scan range', field: 'fullms_scan_range', unit: 'm/z', text: true },
  { label: 'ddMS² resolution', field: 'ddms2_resolution', unit: '' },
  { label: 'Isolation window', field: 'ddms2_isolation_window', unit: 'm/z' },
  { label: 'Stepped NCE', field: 'nce_stepped', unit: '', text: true },
  { label: 'Capillary temperature', field: 'capillary_temp_c', unit: '°C' },
  { label: 'S-lens RF level', field: 's_lens_rf_level', unit: '' },
]

const present = (v: unknown) => v !== null && v !== undefined && v !== ''

export default function MSPanel({ method }: { method: any }) {
  const vendor = method.instrument_manufacturer
  const source = [
    // Some vendor labels already carry the unit ("Spray Voltage (kV)"); don't print it twice.
    ...sourceParams(vendor).map(p => ({ label: p.unit ? p.label.replace(` (${p.unit})`, '') : p.label, value: method[p.field], unit: p.unit, text: p.field === 'collision_gas' })),
    ...HRMS_PARAMS.map(p => ({ label: p.label, value: method[p.field], unit: p.unit, text: p.text })),
  ].filter(p => present(p.value))
  const mobility = ION_MOBILITY_PARAMS
    .filter(p => p.field !== 'ion_mobility_device')
    .map(p => ({ label: p.label, value: method[p.field], unit: p.unit, text: p.text }))
    .filter(p => present(p.value))
  const hasMobility = present(method.ion_mobility_device) || mobility.length > 0

  return (
    <Panel title="Mass spectrometry" icon={Zap} accent="var(--istd)">
      <Block label="Instrument">
        <Specs items={[
          { label: 'Mass spectrometer', value: [vendor, method.instrument_model].filter(Boolean).join(' '), text: true },
          { label: 'Ionization', value: method.ionization_mode, text: true },
        ]} />
      </Block>

      <Block label={`Source parameters${vendor ? ` · ${vendor} naming` : ''}`}>
        {source.length > 0
          ? <Specs items={source} columns={3} />
          : <p className="text-xs text-muted-foreground/70">No source parameters reported.</p>}
      </Block>

      {hasMobility && (
        <Block label={`Ion mobility${method.ion_mobility_device ? ` · ${method.ion_mobility_device}` : ''}`}>
          {mobility.length > 0
            ? <Specs items={mobility} columns={3} />
            : <p className="text-xs text-muted-foreground/70">Device used; settings not reported.</p>}
        </Block>
      )}

      <Block label="MRM transitions">
        <TransitionsTable method={method} />
      </Block>
    </Panel>
  )
}
