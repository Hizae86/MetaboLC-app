import { useState } from 'react'

export default function ShareCiteButton({ method }: { method: any }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<string|null>(null)

  const url = `${window.location.origin}/method/${method.id}`
  const year = new Date().getFullYear()

  const citations = {
    apa: `${method.submitted_by || 'MetaboLC contributors'} (${year}). ${method.analyte} — ${method.title}. MetaboLC LC-MS/MS Method Repository. ${url}`,
    vancouver: `${method.submitted_by || 'MetaboLC contributors'}. ${method.analyte}: ${method.title} [Internet]. MetaboLC; ${year} [cited ${new Date().toLocaleDateString('en-GB')}]. Available from: ${url}`,
    iso: `${method.submitted_by || 'MetaboLC contributors'}, ${year}. ${method.title}. MetaboLC Repository. [Online]. Available: ${url}`,
  }

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div style={{position:'relative'}}>
      <button onClick={() => setOpen(!open)}
        style={{display:'flex',alignItems:'center',gap:'5px',padding:'6px 12px',
          border:'0.5px solid rgba(255,255,255,0.15)',borderRadius:'8px',background:'rgba(255,255,255,0.05)',
          color:'#94a3b8',cursor:'pointer',fontSize:'12px'}}>
        🔗 Share & cite
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)}
            style={{position:'fixed',inset:0,zIndex:40}} />
          <div style={{position:'absolute',right:0,top:'calc(100% + 6px)',zIndex:50,
            background:'#0e1b2e',border:'0.5px solid rgba(255,255,255,0.12)',borderRadius:'12px',
            padding:'1rem',width:'380px',boxShadow:'0 8px 28px rgba(0,0,0,0.5)'}}>

            <p style={{fontSize:'12px',fontWeight:'500',color:'#f1f5f9',marginBottom:'10px'}}>
              Share this method
            </p>

            {/* URL */}
            <div style={{display:'flex',gap:'6px',marginBottom:'14px'}}>
              <input readOnly value={url}
                style={{flex:1,padding:'6px 8px',border:'0.5px solid rgba(255,255,255,0.15)',
                  borderRadius:'6px',fontSize:'11px',background:'rgba(255,255,255,0.05)',
                  color:'#94a3b8',fontFamily:'monospace'}} />
              <button onClick={() => copy(url, 'url')}
                style={{padding:'6px 10px',background: copied==='url' ? 'rgba(74,222,128,0.15)' : '#38bdf8',
                  color: copied==='url' ? '#4ade80' : '#03131f',border:'none',
                  borderRadius:'6px',fontSize:'11px',cursor:'pointer',whiteSpace:'nowrap'}}>
                {copied==='url' ? '✓ Copied' : 'Copy URL'}
              </button>
            </div>

            <p style={{fontSize:'12px',fontWeight:'500',color:'#f1f5f9',marginBottom:'8px'}}>
              Cite this method
            </p>

            {Object.entries(citations).map(([fmt, text]) => (
              <div key={fmt} style={{marginBottom:'8px',padding:'8px',background:'rgba(255,255,255,0.04)',
                borderRadius:'8px',border:'0.5px solid rgba(255,255,255,0.1)'}}>
                <div style={{display:'flex',justifyContent:'space-between',
                  alignItems:'center',marginBottom:'4px'}}>
                  <span style={{fontSize:'10px',fontWeight:'500',color:'#94a3b8',
                    textTransform:'uppercase',letterSpacing:'0.05em'}}>{fmt.toUpperCase()}</span>
                  <button onClick={() => copy(text, fmt)}
                    style={{fontSize:'10px',padding:'2px 8px',border:'0.5px solid rgba(255,255,255,0.15)',
                      borderRadius:'4px',background: copied===fmt ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)',
                      color: copied===fmt ? '#4ade80' : '#94a3b8',cursor:'pointer'}}>
                    {copied===fmt ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <p style={{fontSize:'10px',color:'#94a3b8',lineHeight:'1.5',
                  fontFamily:'monospace',wordBreak:'break-word'}}>{text}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
