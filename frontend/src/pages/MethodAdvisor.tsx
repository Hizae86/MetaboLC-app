import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import MethodDraftGenerator from '../components/MethodDraftGenerator'
import TroubleshootingAdvisor from '../components/TroubleshootingAdvisor'
import SEO from '../components/SEO'
import axios from 'axios'

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api'
const STORAGE_KEY = 'dra-massa-chat'

interface MatchedMethod {
  id: number
  title: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  methods_found?: number
  matched_methods?: MatchedMethod[]
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
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [advisorTab, setAdvisorTab] = useState<'chat'|'draft'|'troubleshoot'>('chat')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)) } catch {}
  }, [messages])

  const clearConversation = () => {
    setMessages([])
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }

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
        methods_found: res.data.methods_found,
        matched_methods: res.data.matched_methods
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

      <SEO title="Ask Dra. Massa — AI LC-MS/MS Method Advisor"
        description="Get personalized LC-MS/MS method recommendations grounded in the MetaboLC repository — analytes, matrices, instrumentation, and validation." />

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:'14px',
        paddingBottom:'16px',borderBottom:'0.5px solid rgba(255,255,255,0.1)',marginBottom:'16px'}}>
        <div style={{position:'relative',flexShrink:0}}>
          <img src="/dra-massa.png" alt="Dra. Massa"
            style={{width:'64px',height:'64px',borderRadius:'50%',objectFit:'cover',
              border:'2px solid rgba(255,255,255,0.15)',display:'block'}}
            onError={(e) => { (e.target as HTMLImageElement).style.display='none' }} />
          <div style={{position:'absolute',inset:'-4px',borderRadius:'50%',
            border:'2px solid #5DCAA5',pointerEvents:'none'}} />
          <div style={{position:'absolute',bottom:'2px',right:'2px',width:'12px',height:'12px',
            borderRadius:'50%',background:'#1D9E75',border:'2px solid #060d1a'}} />
        </div>
        <div style={{flex:1}}>
          <p style={{fontSize:'16px',fontWeight:'500',color:'#f1f5f9',margin:'0 0 2px'}}>Dra. Massa</p>
          <p style={{fontSize:'12px',color:'#94a3b8',margin:'0 0 6px'}}>
            LC-MS/MS expert · Based on your method repository
          </p>
          <div style={{display:'flex',gap:'6px'}}>
            <span style={{fontSize:'11px',fontWeight:'500',padding:'2px 8px',borderRadius:'20px',
              background:'rgba(74,222,128,0.12)',color:'#4ade80',border:'0.5px solid rgba(74,222,128,0.35)'}}>
              ● Online
            </span>
            <span style={{fontSize:'11px',fontWeight:'500',padding:'2px 8px',borderRadius:'20px',
              background:'rgba(125,211,252,0.12)',color:'#7dd3fc',border:'0.5px solid rgba(125,211,252,0.35)'}}>
              Triple quad · QTRAP · HRMS
            </span>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center justify-between border-b border-white/10 mb-4">
        <div className="flex">
          {[
            { id: 'chat', label: '💬 Ask Dra. Massa' },
            { id: 'draft', label: '🧪 Method Draft' },
            { id: 'troubleshoot', label: '🔬 Troubleshoot' },
          ].map(tab => (
            <button key={tab.id}
              onClick={() => setAdvisorTab(tab.id as any)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all -mb-px
                ${advisorTab === tab.id
                  ? 'border-teal-400 text-teal-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
              {tab.label}
            </button>
          ))}
        </div>
        {advisorTab === 'chat' && messages.length > 0 && (
          <button onClick={clearConversation}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 mb-1">
            + New conversation
          </button>
        )}
      </div>

      {advisorTab === 'draft' && <MethodDraftGenerator />}
      {advisorTab === 'troubleshoot' && <TroubleshootingAdvisor />}

      {/* Chat area */}
      {advisorTab === 'chat' && <>
      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:'12px',
        padding:'1rem',background:'rgba(255,255,255,0.03)',borderRadius:'12px',
        border:'1px solid rgba(255,255,255,0.08)',marginBottom:'12px'}}>

        {messages.length === 0 && (
          <div>
            <div style={{textAlign:'center',marginBottom:'16px'}}>
              <p style={{fontSize:'14px',fontWeight:'500',color:'#f1f5f9',margin:'0 0 4px'}}>
                What method are you looking for?
              </p>
              <p style={{fontSize:'12px',color:'#94a3b8',margin:0}}>
                I'll search the repository and give you personalized recommendations
              </p>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px'}}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s.text)}
                  style={{border:'0.5px solid rgba(255,255,255,0.1)',borderRadius:'10px',padding:'10px 12px',
                    cursor:'pointer',background:'rgba(255,255,255,0.04)',textAlign:'left',transition:'border-color 0.15s',
                    position:'relative',overflow:'hidden'}}
                  onMouseEnter={e => (e.currentTarget.style.borderColor='#5DCAA5')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor='rgba(255,255,255,0.1)')}>
                  <p style={{fontSize:'10px',fontWeight:'500',color:'#5eead4',
                    textTransform:'uppercase',letterSpacing:'0.05em',margin:'0 0 4px',
                    display:'flex',alignItems:'center',gap:'4px'}}>
                    <i className={`ti ${s.icon}`} style={{fontSize:'11px'}} aria-hidden="true" />
                    {s.cat}
                  </p>
                  <p style={{fontSize:'12px',color:'#e2e8f0',margin:0,lineHeight:'1.4'}}>{s.text}</p>
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
                  border:'1.5px solid rgba(255,255,255,0.15)',marginRight:'8px',flexShrink:0,
                  alignSelf:'flex-start',marginTop:'4px'}} />
            )}
            <div style={{
              maxWidth:'75%',padding:'10px 14px',borderRadius:'12px',
              background:msg.role==='user'?'#1e3a5f':'rgba(255,255,255,0.05)',
              color:msg.role==='user'?'white':'#e2e8f0',
              border:msg.role==='assistant'?'1px solid rgba(255,255,255,0.1)':'none',
              fontSize:'0.875rem',lineHeight:'1.6',
            }}>
              {msg.role==='assistant'
                ? <div>{formatMsg(msg.content)}</div>
                : <p style={{margin:0}}>{msg.content}</p>}
              {msg.methods_found !== undefined && msg.methods_found > 0 && (
                <div style={{marginTop:'8px',paddingTop:'8px',borderTop:'1px solid rgba(255,255,255,0.1)'}}>
                  <div style={{fontSize:'0.75rem',color:'#94a3b8',display:'flex',alignItems:'center',gap:'4px',marginBottom: msg.matched_methods?.length ? '6px' : 0}}>
                    📊 Based on {msg.methods_found} method{msg.methods_found>1?'s':''} from the repository
                  </div>
                  {msg.matched_methods && msg.matched_methods.length > 0 && (
                    <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                      {msg.matched_methods.map(mm => (
                        <Link key={mm.id} to={`/method/${mm.id}`}
                          style={{fontSize:'0.7rem',padding:'3px 9px',borderRadius:'999px',
                            background:'rgba(125,211,252,0.12)',color:'#7dd3fc',
                            border:'1px solid rgba(125,211,252,0.3)',textDecoration:'none',
                            whiteSpace:'nowrap'}}>
                          {mm.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{display:'flex',alignItems:'flex-start',gap:'8px'}}>
            <img src="/dra-massa.png" alt="Dra. Massa"
              style={{width:'32px',height:'32px',borderRadius:'50%',objectFit:'cover',
                border:'1.5px solid rgba(255,255,255,0.15)',flexShrink:0}} />
            <div style={{padding:'10px 14px',borderRadius:'12px',background:'rgba(255,255,255,0.05)',
              border:'1px solid rgba(255,255,255,0.1)',display:'flex',gap:'4px',alignItems:'center'}}>
              {[0,1,2].map(j => (
                <div key={j} style={{width:'6px',height:'6px',borderRadius:'50%',
                  background:'#94a3b8',animation:`bounce 1s ${j*0.2}s infinite`}} />
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
          className="placeholder:text-slate-500"
          style={{flex:1,padding:'10px 14px',border:'1.5px solid rgba(255,255,255,0.12)',borderRadius:'10px',
            fontSize:'13px',resize:'none',outline:'none',fontFamily:'inherit',
            lineHeight:'1.5',color:'#e2e8f0',background:'rgba(255,255,255,0.04)',transition:'border-color 0.15s'}}
          onFocus={e => (e.target.style.borderColor='#5DCAA5')}
          onBlur={e => (e.target.style.borderColor='rgba(255,255,255,0.12)')}
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
