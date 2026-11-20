import { useState } from 'react'

export default function ShareCiteButton({ method }: { method: any }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<string|null>(null)

  const url = `${window.location.origin}/method/${method.id}`
  const year = new Date().getFullYear()

  const citations = {
    apa: `${method.submitted_by || 'Koiné contributors'} (${year}). ${method.analyte} — ${method.title}. Koiné LC-MS/MS Method Repository. ${url}`,
    vancouver: `${method.submitted_by || 'Koiné contributors'}. ${method.analyte}: ${method.title} [Internet]. Koiné; ${year} [cited ${new Date().toLocaleDateString('en-GB')}]. Available from: ${url}`,
    iso: `${method.submitted_by || 'Koiné contributors'}, ${year}. ${method.title}. Koiné Repository. [Online]. Available: ${url}`,
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
          border:'0.5px solid var(--border)',borderRadius:'8px',background:'var(--muted)',
          color:'var(--muted-foreground)',cursor:'pointer',fontSize:'12px'}}>
        🔗 Share & cite
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)}
            style={{position:'fixed',inset:0,zIndex:40}} />
          <div style={{position:'absolute',right:0,top:'calc(100% + 6px)',zIndex:50,
            background:'var(--popover)',border:'0.5px solid var(--border)',borderRadius:'12px',
            padding:'1rem',width:'380px',boxShadow:'0 8px 28px rgba(0,0,0,0.5)'}}>

            <p style={{fontSize:'12px',fontWeight:'500',color:'var(--foreground)',marginBottom:'10px'}}>
              Share this method
            </p>

            {/* URL */}
            <div style={{display:'flex',gap:'6px',marginBottom:'14px'}}>
              <input readOnly value={url}
                style={{flex:1,padding:'6px 8px',border:'0.5px solid var(--border)',
                  borderRadius:'6px',fontSize:'11px',background:'var(--muted)',
                  color:'var(--muted-foreground)',fontFamily:'monospace'}} />
              <button onClick={() => copy(url, 'url')}
                style={{padding:'6px 10px',background: copied==='url' ? 'color-mix(in srgb, var(--success) 15%, transparent)' : 'var(--primary)',
                  color: copied==='url' ? 'var(--success)' : 'var(--primary-foreground)',border:'none',
                  borderRadius:'6px',fontSize:'11px',cursor:'pointer',whiteSpace:'nowrap'}}>
                {copied==='url' ? '✓ Copied' : 'Copy URL'}
              </button>
            </div>

            <p style={{fontSize:'12px',fontWeight:'500',color:'var(--foreground)',marginBottom:'8px'}}>
              Cite this method
            </p>

            {Object.entries(citations).map(([fmt, text]) => (
              <div key={fmt} style={{marginBottom:'8px',padding:'8px',background:'var(--muted)',
                borderRadius:'8px',border:'0.5px solid var(--border)'}}>
                <div style={{display:'flex',justifyContent:'space-between',
                  alignItems:'center',marginBottom:'4px'}}>
                  <span style={{fontSize:'10px',fontWeight:'500',color:'var(--muted-foreground)',
                    textTransform:'uppercase',letterSpacing:'0.05em'}}>{fmt.toUpperCase()}</span>
                  <button onClick={() => copy(text, fmt)}
                    style={{fontSize:'10px',padding:'2px 8px',border:'0.5px solid var(--border)',
                      borderRadius:'4px',background: copied===fmt ? 'color-mix(in srgb, var(--success) 15%, transparent)' : 'var(--muted)',
                      color: copied===fmt ? 'var(--success)' : 'var(--muted-foreground)',cursor:'pointer'}}>
                    {copied===fmt ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <p style={{fontSize:'10px',color:'var(--muted-foreground)',lineHeight:'1.5',
                  fontFamily:'monospace',wordBreak:'break-word'}}>{text}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
