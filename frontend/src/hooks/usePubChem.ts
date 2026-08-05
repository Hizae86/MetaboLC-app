import { useState } from 'react'

interface PubChemData {
  formula: string
  exactMass: number
  iupacName: string
  cid: number
  adducts: { name: string; mz: number; diff: number }[]
}

const ADDUCTS = [
  { name: 'M+H', delta: 1.007276 },
  { name: 'M+Na', delta: 22.989218 },
  { name: 'M+K', delta: 38.963158 },
  { name: 'M+NH4', delta: 18.034164 },
  { name: 'M-H', delta: -1.007276 },
  { name: 'M+Cl', delta: 34.969402 },
  { name: 'M+FA-H', delta: 44.997655 },
  { name: 'M+2H', delta: 1.007276 / 2, charge: 2 },
]

export function usePubChem() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookup = async (
    compoundName: string,
    observedMz?: number
  ): Promise<PubChemData | null> => {
    setLoading(true)
    setError(null)
    try {
      // Step 1: get CID from name
      const cidRes = await fetch(
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(compoundName)}/cids/JSON`
      )
      if (!cidRes.ok) throw new Error('Compound not found in PubChem')
      const cidData = await cidRes.json()
      const cid = cidData.IdentifierList.CID[0]

      // Step 2: get properties
      const propRes = await fetch(
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,ExactMass,IUPACName/JSON`
      )
      const propData = await propRes.json()
      const props = propData.PropertyTable.Properties[0]

      const exactMass = parseFloat(props.ExactMass)

      // Step 3: calculate adducts and match to observed m/z
      const adducts = ADDUCTS.map(a => {
        const mz = a.charge
          ? (exactMass + a.delta * (a.charge)) / a.charge
          : exactMass + a.delta
        const diff = observedMz ? Math.abs(mz - observedMz) : 999
        return { name: a.name, mz: parseFloat(mz.toFixed(4)), diff: parseFloat(diff.toFixed(4)) }
      }).sort((a, b) => a.diff - b.diff)

      return {
        formula: props.MolecularFormula,
        exactMass,
        iupacName: props.IUPACName,
        cid,
        adducts,
      }
    } catch (err: any) {
      setError(err.message || 'PubChem lookup failed')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { lookup, loading, error }
}
