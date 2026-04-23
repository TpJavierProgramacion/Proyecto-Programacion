import { useState, useRef, useEffect } from 'react'
import api from '../api/client'

const INITIAL_MSG = { role: 'assistant', content: '¡Hola! Soy UniBot 🤖 Tu asistente académico. Puedo ayudarte a organizar tu estudio, analizar tus apuntes y prepararte para los exámenes. ¿Por dónde empezamos?' }
const STORAGE_KEY = 'unibot_chat_messages'
const SESSION_KEY = 'unibot_session_id'

function loadMessages() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : [INITIAL_MSG]
  } catch { return [INITIAL_MSG] }
}

export default function Chat() {
  const [messages, setMessages] = useState(loadMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY) || null)
  const bottomRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  }, [messages])

  useEffect(() => {
    if (sessionId) localStorage.setItem(SESSION_KEY, sessionId)
  }, [sessionId])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const { data } = await api.post('/agent/chat/', {
        message: userMsg,
        session_id: sessionId
      })
      if (data.session_id) setSessionId(data.session_id)
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }])

      if (data.study_plan_created) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '📅 El plan de estudio fue agregado al calendario. Podés verlo en la sección Calendario.',
          isSystem: true
        }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Hubo un error al conectar con el agente. Verificá que Ollama esté corriendo y esperá unos segundos.' }])
    } finally {
      setLoading(false)
    }
  }

  const newSession = () => {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(STORAGE_KEY)
    setSessionId(null)
    setMessages([INITIAL_MSG])
  }

  const suggestions = [
    '¿Qué exámenes tengo próximamente?',
    'Generá un plan de estudio para mi próximo parcial',
    '¿Cuáles son mis materias activas?',
    'Mostrá mis documentos cargados',
  ]

  return (
    <div className="page chat-page">
      <div className="page-header">
        <div>
          <h1>Uni<em>Bot</em> AI</h1>
          <p className="subtitle">Tu asistente académico inteligente</p>
        </div>
        <button type="button" className="btn-secondary" onClick={newSession}>+ Nueva sesión</button>
      </div>

      <div className="chat-container">
        <div className="messages">
          {messages.map((msg, i) => (
            <div key={i} className={`message message-${msg.role}`}>
              {msg.role === 'assistant' && <div className="bot-avatar">U</div>}
              <div className={`message-bubble ${msg.isSystem ? 'system-msg' : ''}`}>
                <p>{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="message message-assistant">
              <div className="bot-avatar">U</div>
              <div className="message-bubble typing"><span /><span /><span /></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {messages.length === 1 && (
          <div className="suggestions">
            {suggestions.map((s, i) => (
              <button key={i} type="button" className="suggestion-chip" onClick={() => setInput(s)}>{s}</button>
            ))}
          </div>
        )}

        <div className="chat-input-bar">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Preguntale algo a UniBot..."
            disabled={loading}
          />
          <button type="button" className="send-btn" onClick={sendMessage} disabled={loading || !input.trim()}>▶</button>
        </div>
      </div>
    </div>
  )
}
