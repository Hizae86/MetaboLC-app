import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import axios from 'axios'

/** The Koiné mark; it turns slowly while the assistant is answering. */
const KoineMark = ({ size, busy = false }: { size: number; busy?: boolean }) => (
  <img src="/koine-mark.svg" width={size} height={size} alt="" aria-hidden="true"
    style={{ display: 'block', width: size, height: size, animation: busy ? 'koine-spin 1.6s linear infinite' : undefined }} />
)

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
  methods_found?: number
}

const QUICK = [
  'Cortisol in plasma with Sciex',
  'Immunosuppressants in whole blood',
  'Vitamin D methods comparison',
]

export default function DraMassaFAB() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // Escape closes the panel. No ⌘K binding here: CommandPalette owns that
  // shortcut globally, and both components previously registered the same
  // listener, so whichever mounted last silently won.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

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
        content: 'Error connecting. Please try again.'
      }])
    } finally { setLoading(false) }
  }

  const formatMsg = (text: string) => text.split('\n').map((line, i) => {
    if (line.startsWith('• ') || line.startsWith('- '))
      return <li key={i} style={{marginLeft:'1rem',marginBottom:'2px',fontSize:'12px'}}>{line.slice(2)}</li>
    if (line.trim() === '') return <br key={i} />
    return <p key={i} style={{margin:'0 0 3px',fontSize:'12px',lineHeight:'1.5'}}>{line}</p>
  })

  // The assistant page already is the assistant: no second way in.
  if (pathname === '/advisor') return null

  return (
    <div className="no-print">
      {/* Backdrop */}
      {open && (
        <div onClick={() => setOpen(false)}
          style={{position:'fixed',inset:0,zIndex:40,background:'rgba(0,0,0,0.15)'}} />
      )}

      {/* Chat panel */}
      {open && (
        <div style={{position:'fixed',bottom:'80px',right:'24px',
          width:'360px',height:'520px',zIndex:50,
          background:'white',borderRadius:'16px',
          border:'0.5px solid #e5e7eb',
          boxShadow:'0 8px 32px rgba(0,0,0,0.12)',
          display:'flex',flexDirection:'column',overflow:'hidden'}}>

          {/* Header */}
          <div style={{background:'#1e3a5f',padding:'12px 16px',
            display:'flex',alignItems:'center',gap:'10px'}}>
            <div style={{position:'relative',flexShrink:0}}>
              <KoineMark size={36} busy={loading} />
              <div style={{position:'absolute',bottom:'0',right:'0',width:'9px',height:'9px',
                borderRadius:'50%',background:'#1D9E75',border:'2px solid #1e3a5f'}} />
            </div>
            <div style={{flex:1}}>
              <p style={{fontSize:'13px',fontWeight:'500',color:'white',margin:'0 0 1px'}}>Assistant</p>
              <p style={{fontSize:'10px',color:'#94a3b8',margin:0}}>LC-MS/MS Method Advisor</p>
            </div>
            <button onClick={() => setOpen(false)}
              style={{background:'none',border:'none',color:'#94a3b8',
                cursor:'pointer',fontSize:'18px',lineHeight:1,padding:'2px'}}>×</button>
          </div>

          {/* Messages */}
          <div style={{flex:1,overflowY:'auto',padding:'12px',
            display:'flex',flexDirection:'column',gap:'10px',background:'#f9fafb'}}>

            {messages.length === 0 && (
              <div>
                <p style={{fontSize:'12px',color:'#6b7280',marginBottom:'10px',textAlign:'center'}}>
                  Ask me about methods in the repository
                </p>
                {QUICK.map((q, i) => (
                  <button key={i} onClick={() => send(q)}
                    style={{width:'100%',textAlign:'left',padding:'7px 10px',marginBottom:'5px',
                      border:'0.5px solid #e5e7eb',borderRadius:'8px',background:'white',
                      fontSize:'11px',color:'#374151',cursor:'pointer',lineHeight:'1.4',
                      transition:'border-color 0.15s'}}
                    onMouseEnter={e=>(e.currentTarget.style.borderColor='#5DCAA5')}
                    onMouseLeave={e=>(e.currentTarget.style.borderColor='#e5e7eb')}>
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{display:'flex',
                justifyContent:msg.role==='user'?'flex-end':'flex-start',gap:'6px'}}>
                {msg.role === 'assistant' && (
                  <div style={{flexShrink:0,alignSelf:'flex-start',marginTop:'2px',display:'flex'}}>
                    <KoineMark size={24} />
                  </div>
                )}
                <div style={{
                  maxWidth:'80%',padding:'8px 10px',borderRadius:'10px',
                  background:msg.role==='user'?'#1e3a5f':'white',
                  color:msg.role==='user'?'white':'#111827',
                  border:msg.role==='assistant'?'0.5px solid #e5e7eb':'none',
                }}>
                  {msg.role==='assistant'
                    ? <div>{formatMsg(msg.content)}</div>
                    : <p style={{margin:0,fontSize:'12px'}}>{msg.content}</p>}
                  {msg.methods_found !== undefined && msg.methods_found > 0 && (
                    <p style={{margin:'6px 0 0',fontSize:'10px',color:'#6b7280',
                      borderTop:'1px solid #e5e7eb',paddingTop:'4px'}}>
                      📊 {msg.methods_found} method{msg.methods_found>1?'s':''} from repository
                    </p>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{display:'flex',gap:'6px',alignItems:'flex-start'}}>
                <div style={{flexShrink:0,display:'flex'}}>
                  <KoineMark size={24} busy />
                </div>
                <div style={{padding:'8px 10px',borderRadius:'10px',background:'white',
                  border:'0.5px solid #e5e7eb',display:'flex',gap:'3px',alignItems:'center'}}>
                  {[0,1,2].map(j => (
                    <div key={j} style={{width:'5px',height:'5px',borderRadius:'50%',
                      background:'#9ca3af',animation:`bounce 1s ${j*0.2}s infinite`}} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{padding:'10px 12px',borderTop:'0.5px solid #e5e7eb',
            display:'flex',gap:'6px',alignItems:'flex-end',background:'white'}}>
            <textarea ref={inputRef} value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() }}}
              placeholder="Ask about a method… (Enter to send)"
              rows={2}
              style={{flex:1,padding:'7px 10px',border:'1px solid #e5e7eb',
                borderRadius:'8px',fontSize:'12px',resize:'none',outline:'none',
                fontFamily:'inherit',lineHeight:'1.4',color:'#111827',
                transition:'border-color 0.15s'}}
              onFocus={e=>(e.target.style.borderColor='#5DCAA5')}
              onBlur={e=>(e.target.style.borderColor='#e5e7eb')} />
            <button onClick={() => send()} disabled={!input.trim() || loading}
              style={{padding:'7px 12px',background:'#1e3a5f',color:'white',border:'none',
                borderRadius:'8px',fontSize:'12px',cursor:'pointer',
                opacity:!input.trim()||loading?0.4:1,height:'fit-content'}}>
              ↑
            </button>
          </div>
        </div>
      )}

      {/* FAB button */}
      <button onClick={() => setOpen(prev => !prev)}
        style={{position:'fixed',bottom:'24px',right:'24px',zIndex:50,
          width:'56px',height:'56px',borderRadius:'50%',border:'none',
          cursor:'pointer',padding:0,overflow:'hidden',background:'#060d1a',
          display:'flex',alignItems:'center',justifyContent:'center',
          outline:'1px solid rgba(56,189,248,0.4)',
          boxShadow:'0 4px 16px rgba(0,0,0,0.25), 0 0 18px rgba(56,189,248,0.25)',
          transition:'transform 0.15s'}}
        onMouseEnter={e=>(e.currentTarget.style.transform='scale(1.08)')}
        onMouseLeave={e=>(e.currentTarget.style.transform='scale(1)')}
        title="Ask the assistant" aria-label={open ? 'Close the assistant' : 'Ask the assistant'}>
        {open ? <X size={22} color="white" /> : <KoineMark size={34} busy={loading} />}
      </button>

      <style>{`
        @keyframes koine-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { img[src='/koine-mark.svg'] { animation: none !important; } }
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  )
}
