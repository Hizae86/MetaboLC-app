import { useState, useRef, useEffect } from 'react'
import MethodDraftGenerator from '../components/MethodDraftGenerator'
import TroubleshootingAdvisor from '../components/TroubleshootingAdvisor'
import axios from 'axios'

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
  methods_found?: number
}

const SUGGESTIONS = [
  { cat: 'Analytes', icon: 'ti-atom', text: 'Cortisol and cortisone in plasma with Sciex' },
  { cat: 'Matrices', icon: 'ti-droplet', text: 'Best sample prep for immunosuppressants in whole blood' },
  { cat: 'Instrumentation', icon: 'ti-microscope', text: 'Column selection for a Waters Xevo TQ-XS' },
  { cat: 'MRM transitions', icon: 'ti-chart-bar', text: 'Suggest MRM transitions for tacrolimus' },
  { cat: 'Comparison', icon: 'ti-arrows-left-right', text: 'Compare vitamin D methods across vendors' },
  { cat: 'Validation', icon: 'ti-file-check', text: 'What LLOQ can I expect for benzodiazepines in urine?' },
]

export default function MethodAdvisor() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [advisorTab, setAdvisorTab] = useState<'chat'|'draft'|'troubleshoot'>('chat')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text?: string) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    const userMsg: Message = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    try {
      const conversation = messages.map(m => ({ role: m.role, content: m.content }))
      const res = await axios.post(`${API}/methods/chat`, { message: msg, conversation })
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.reply,
        methods_found: res.data.methods_found
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, there was an error. Please try again.'
      }])
    } finally { setLoading(false) }
  }

  const formatMsg = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('• ') || line.startsWith('- '))
        return <li key={i} style={{marginLeft:'1rem',marginBottom:'2px'}}>{line.slice(2)}</li>
      if (line.match(/^\d+\./))
        return <li key={i} style={{marginLeft:'1rem',marginBottom:'2px'}}>{line}</li>
      if (line.trim() === '') return <br key={i} />
      return <p key={i} style={{marginBottom:'4px',margin:'0 0 4px'}}>{line}</p>
    })
  }

  return (
    <div style={{maxWidth:'800px',margin:'0 auto',height:'calc(100vh - 120px)',
      display:'flex',flexDirection:'column'}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:'14px',
        paddingBottom:'16px',borderBottom:'0.5px solid #e5e7eb',marginBottom:'16px'}}>
        <div style={{position:'relative',flexShrink:0}}>
          <img src="/dra-massa.png" alt="Dra. Massa"
            style={{width:'64px',height:'64px',borderRadius:'50%',objectFit:'cover',
              border:'2px solid #1e3a5f',display:'block'}}
            onError={(e) => { (e.target as HTMLImageElement).style.display='none' }} />
          <div style={{position:'absolute',inset:'-4px',borderRadius:'50%',
            border:'2px solid #5DCAA5',pointerEvents:'none'}} />
          <div style={{position:'absolute',bottom:'2px',right:'2px',width:'12px',height:'12px',
            borderRadius:'50%',background:'#1D9E75',border:'2px solid white'}} />
        </div>
        <div style={{flex:1}}>
          <p style={{fontSize:'16px',fontWeight:'500',color:'#111827',margin:'0 0 2px'}}>Dra. Massa</p>
          <p style={{fontSize:'12px',color:'#6b7280',margin:'0 0 6px'}}>
            LC-MS/MS expert · Based on your method repository
          </p>
          <div style={{display:'flex',gap:'6px'}}>
            <span style={{fontSize:'11px',fontWeight:'500',padding:'2px 8px',borderRadius:'20px',
              background:'#E1F5EE',color:'#085041',border:'0.5px solid #5DCAA5'}}>
              ● Online
            </span>
            <span style={{fontSize:'11px',fontWeight:'500',padding:'2px 8px',borderRadius:'20px',
              background:'#E6F1FB',color:'#0C447C',border:'0.5px solid #85B7EB'}}>
              Triple quad · QTRAP · HRMS
            </span>
          </div>
        </div>
        {/* Mini mass spec SVG */}
        <svg width="120" height="60" viewBox="0 0 120 60" fill="none"
          xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{flexShrink:0}}>
          <rect x="2" y="15" width="36" height="30" rx="3" fill="#E6F1FB" stroke="#85B7EB" strokeWidth="0.5"/>
          <text x="20" y="34" fontSize="7" fill="#0C447C" textAnchor="middle" fontFamily="monospace">Q1</text>
          <rect x="42" y="20" width="16" height="20" rx="2" fill="#E1F5EE" stroke="#5DCAA5" strokeWidth="0.5"/>
          <text x="50" y="33" fontSize="6" fill="#085041" textAnchor="middle" fontFamily="monospace">CID</text>
          <rect x="62" y="15" width="36" height="30" rx="3" fill="#E6F1FB" stroke="#85B7EB" strokeWidth="0.5"/>
          <text x="80" y="34" fontSize="7" fill="#0C447C" textAnchor="middle" fontFamily="monospace">Q3</text>
          <rect x="102" y="20" width="16" height="20" rx="2" fill="#EEEDFE" stroke="#AFA9EC" strokeWidth="0.5"/>
          <text x="110" y="33" fontSize="5" fill="#3C3489" textAnchor="middle" fontFamily="monospace">Det</text>
          <line x1="38" y1="30" x2="42" y2="30" stroke="#5DCAA5" strokeWidth="1"/>
          <line x1="58" y1="30" x2="62" y2="30" stroke="#5DCAA5" strokeWidth="1"/>
          <line x1="98" y1="30" x2="102" y2="30" stroke="#AFA9EC" strokeWidth="1"/>
          <line x1="10" y1="50" x2="115" y2="50" stroke="#D3D1C7" strokeWidth="0.5"/>
          <line x1="25" y1="50" x2="25" y2="44" stroke="#378ADD" strokeWidth="1.5"/>
          <line x1="40" y1="50" x2="40" y2="47" stroke="#378ADD" strokeWidth="1"/>
          <line x1="55" y1="50" x2="55" y2="42" stroke="#1D9E75" strokeWidth="1.5"/>
          <line x1="70" y1="50" x2="70" y2="46" stroke="#378ADD" strokeWidth="1"/>
          <line x1="85" y1="50" x2="85" y2="43" stroke="#378ADD" strokeWidth="2"/>
          <text x="14" y="58" fontSize="5" fill="#888780" fontFamily="monospace">m/z →</text>
        </svg>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-slate-100 mb-4">
        {[
          { id: 'chat', label: '💬 Ask Dra. Massa' },
          { id: 'draft', label: '🧪 Method Draft' },
          { id: 'troubleshoot', label: '🔬 Troubleshoot' },
        ].map(tab => (
          <button key={tab.id}
            onClick={() => setAdvisorTab(tab.id as any)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all -mb-px
              ${advisorTab === tab.id
                ? 'border-teal-500 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {advisorTab === 'draft' && <MethodDraftGenerator />}
      {advisorTab === 'troubleshoot' && <TroubleshootingAdvisor />}

      {/* Chat area */}
      {advisorTab === 'chat' && <>
      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:'12px',
        padding:'1rem',background:'#f9fafb',borderRadius:'12px',
        border:'1px solid #e5e7eb',marginBottom:'12px'}}>

        {messages.length === 0 && (
          <div>
            <div style={{textAlign:'center',marginBottom:'16px'}}>
              <p style={{fontSize:'14px',fontWeight:'500',color:'#111827',margin:'0 0 4px'}}>
                What method are you looking for?
              </p>
              <p style={{fontSize:'12px',color:'#6b7280',margin:0}}>
                I'll search the repository and give you personalized recommendations
              </p>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px'}}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s.text)}
                  style={{border:'0.5px solid #e5e7eb',borderRadius:'10px',padding:'10px 12px',
                    cursor:'pointer',background:'white',textAlign:'left',transition:'border-color 0.15s',
                    position:'relative',overflow:'hidden'}}
                  onMouseEnter={e => (e.currentTarget.style.borderColor='#5DCAA5')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor='#e5e7eb')}>
                  <p style={{fontSize:'10px',fontWeight:'500',color:'#0F6E56',
                    textTransform:'uppercase',letterSpacing:'0.05em',margin:'0 0 4px',
                    display:'flex',alignItems:'center',gap:'4px'}}>
                    <i className={`ti ${s.icon}`} style={{fontSize:'11px'}} aria-hidden="true" />
                    {s.cat}
                  </p>
                  <p style={{fontSize:'12px',color:'#111827',margin:0,lineHeight:'1.4'}}>{s.text}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{display:'flex',
            justifyContent:msg.role==='user'?'flex-end':'flex-start'}}>
            {msg.role === 'assistant' && (
              <img src="/dra-massa.png" alt="Dra. Massa"
                style={{width:'32px',height:'32px',borderRadius:'50%',objectFit:'cover',
                  border:'1.5px solid #1e3a5f',marginRight:'8px',flexShrink:0,
                  alignSelf:'flex-start',marginTop:'4px'}} />
            )}
            <div style={{
              maxWidth:'75%',padding:'10px 14px',borderRadius:'12px',
              background:msg.role==='user'?'#1e3a5f':'white',
              color:msg.role==='user'?'white':'#111827',
              border:msg.role==='assistant'?'1px solid #e5e7eb':'none',
              fontSize:'0.875rem',lineHeight:'1.6',
            }}>
              {msg.role==='assistant'
                ? <div>{formatMsg(msg.content)}</div>
                : <p style={{margin:0}}>{msg.content}</p>}
              {msg.methods_found !== undefined && msg.methods_found > 0 && (
                <div style={{marginTop:'8px',paddingTop:'8px',borderTop:'1px solid #e5e7eb',
                  fontSize:'0.75rem',color:'#6b7280',display:'flex',alignItems:'center',gap:'4px'}}>
                  📊 Based on {msg.methods_found} method{msg.methods_found>1?'s':''} from the repository
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{display:'flex',alignItems:'flex-start',gap:'8px'}}>
            <img src="/dra-massa.png" alt="Dra. Massa"
              style={{width:'32px',height:'32px',borderRadius:'50%',objectFit:'cover',
                border:'1.5px solid #1e3a5f',flexShrink:0}} />
            <div style={{padding:'10px 14px',borderRadius:'12px',background:'white',
              border:'1px solid #e5e7eb',display:'flex',gap:'4px',alignItems:'center'}}>
              {[0,1,2].map(j => (
                <div key={j} style={{width:'6px',height:'6px',borderRadius:'50%',
                  background:'#9ca3af',animation:`bounce 1s ${j*0.2}s infinite`}} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{display:'flex',gap:'8px',alignItems:'flex-end'}}>
        <textarea value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() }}}
          placeholder="Ask about a compound, matrix, instrument or method… (Enter to send)"
          rows={2}
          style={{flex:1,padding:'10px 14px',border:'1.5px solid #e5e7eb',borderRadius:'10px',
            fontSize:'13px',resize:'none',outline:'none',fontFamily:'inherit',
            lineHeight:'1.5',color:'#111827',background:'white',transition:'border-color 0.15s'}}
          onFocus={e => (e.target.style.borderColor='#5DCAA5')}
          onBlur={e => (e.target.style.borderColor='#e5e7eb')}
        />
        <button onClick={() => send()} disabled={!input.trim() || loading}
          style={{display:'flex',alignItems:'center',gap:'6px',padding:'10px 16px',
            background:'#1e3a5f',color:'white',border:'none',borderRadius:'10px',
            fontSize:'13px',fontWeight:'500',cursor:'pointer',height:'fit-content',
            opacity:!input.trim()||loading?0.5:1}}>
          <i className="ti ti-send" aria-hidden="true" />
          Send
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </>
}
    </div>
  )
}
