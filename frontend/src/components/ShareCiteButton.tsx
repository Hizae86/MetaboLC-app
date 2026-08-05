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
          border:'0.5px solid #d1d5db',borderRadius:'8px',background:'white',
          color:'#6b7280',cursor:'pointer',fontSize:'12px'}}>
        🔗 Share & cite
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)}
            style={{position:'fixed',inset:0,zIndex:40}} />
          <div style={{position:'absolute',right:0,top:'calc(100% + 6px)',zIndex:50,
            background:'white',border:'0.5px solid #e5e7eb',borderRadius:'12px',
            padding:'1rem',width:'380px',boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}>

            <p style={{fontSize:'12px',fontWeight:'500',color:'#111827',marginBottom:'10px'}}>
              Share this method
            </p>

            {/* URL */}
            <div style={{display:'flex',gap:'6px',marginBottom:'14px'}}>
              <input readOnly value={url}
                style={{flex:1,padding:'6px 8px',border:'0.5px solid #d1d5db',
                  borderRadius:'6px',fontSize:'11px',background:'#f9fafb',
                  color:'#374151',fontFamily:'monospace'}} />
              <button onClick={() => copy(url, 'url')}
                style={{padding:'6px 10px',background: copied==='url' ? '#EAF3DE' : '#1e3a5f',
                  color: copied==='url' ? '#27500A' : 'white',border:'none',
                  borderRadius:'6px',fontSize:'11px',cursor:'pointer',whiteSpace:'nowrap'}}>
                {copied==='url' ? '✓ Copied' : 'Copy URL'}
              </button>
            </div>

            <p style={{fontSize:'12px',fontWeight:'500',color:'#111827',marginBottom:'8px'}}>
              Cite this method
            </p>

            {Object.entries(citations).map(([fmt, text]) => (
              <div key={fmt} style={{marginBottom:'8px',padding:'8px',background:'#f9fafb',
                borderRadius:'8px',border:'0.5px solid #e5e7eb'}}>
                <div style={{display:'flex',justifyContent:'space-between',
                  alignItems:'center',marginBottom:'4px'}}>
                  <span style={{fontSize:'10px',fontWeight:'500',color:'#6b7280',
                    textTransform:'uppercase',letterSpacing:'0.05em'}}>{fmt.toUpperCase()}</span>
                  <button onClick={() => copy(text, fmt)}
                    style={{fontSize:'10px',padding:'2px 8px',border:'0.5px solid #d1d5db',
                      borderRadius:'4px',background: copied===fmt ? '#EAF3DE' : 'white',
                      color: copied===fmt ? '#27500A' : '#6b7280',cursor:'pointer'}}>
                    {copied===fmt ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <p style={{fontSize:'10px',color:'#374151',lineHeight:'1.5',
                  fontFamily:'monospace',wordBreak:'break-word'}}>{text}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
