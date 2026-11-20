/** Turns a free-text sample-prep protocol into steps and pulls out the
 *  volumes, times, speeds and temperatures mentioned in each step. */
export const parseSteps = (text: string) => {
  if (!text) return []
  const lines = text.split(/\n+/).map((s: string) => s.trim()).filter((s: string) => s.length > 8)
  if (lines.length > 1) return lines.map((s: string) => s.replace(/^\d+\.\s*/, '').trim())
  return text
    .split(/(?<=\.)\s+(?=[A-Z])|(?<=,)\s+(?=the supernatant|the pellet|samples were|reconstitut)/i)
    .map((s: string) => s.replace(/^\d+\.\s*/, '').trim())
    .filter((s: string) => s.length > 8)
}

export const extractParams = (text: string) => {
  const params: {label: string, type: string}[] = []
  const vol = [...text.matchAll(/(\d+[\s.]?\d*)\s*(µL|mL|uL)/gi)]
  vol.forEach(m => params.push({label: `${m[1]} ${m[2]}`, type: 'vol'}))
  const time = [...text.matchAll(/(\d+[\s.]?\d*)\s*(min|sec|h\b|hours?)/gi)]
  time.forEach(m => params.push({label: `${m[1]} ${m[2]}`, type: 'time'}))
  const speed = [...text.matchAll(/(\d[\d,]*)\s*(rpm|×\s*g|x\s*g|xg)/gi)]
  speed.forEach(m => params.push({label: `${m[1]} ${m[2]}`, type: 'speed'}))
  const temp = [...text.matchAll(/(\d+)\s*°?C|room\s*temp|RT\b/gi)]
  temp.forEach(m => params.push({label: m[0].trim(), type: 'temp'}))
  return params.slice(0, 4)
}

