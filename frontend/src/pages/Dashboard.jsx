import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

export default function Dashboard() {
  const { user } = useAuth()
  const { data: events } = useQuery({ queryKey: ['upcoming-events'], queryFn: () => api.get('/events/upcoming/').then(r => r.data) })
  const { data: enrollments } = useQuery({ queryKey: ['enrollments'], queryFn: () => api.get('/enrollments/').then(r => r.data) })
  const { data: flashcards } = useQuery({ queryKey: ['flashcards'], queryFn: () => api.get('/flashcards/').then(r => r.data) })

  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const dateStr = now.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }).toUpperCase()

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>DASH<em>BOARD</em></h1>
          <p className="subtitle">// usuario: {user?.username?.toUpperCase()} · {dateStr}</p>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'Share Tech Mono, monospace', fontSize: '1.4rem', color: 'var(--accent)', letterSpacing: '0.1em' }}>
          {timeStr}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrap blue">[M]</div>
          <div className="stat-info">
            <span className="stat-number">{String(enrollments?.length ?? 0).padStart(2, '0')}</span>
            <span className="stat-label">// materias</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap purple">[E]</div>
          <div className="stat-info">
            <span className="stat-number">{String(events?.length ?? 0).padStart(2, '0')}</span>
            <span className="stat-label">// eventos</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap green">[F]</div>
          <div className="stat-info">
            <span className="stat-number">{String(flashcards?.length ?? 0).padStart(2, '00')}</span>
            <span className="stat-label">// flashcards</span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dash-card">
          <h3>// eventos proximos</h3>
          {events?.length === 0 && <p className="empty">// no hay eventos</p>}
          <div className="event-list">
            {events?.slice(0, 5).map(ev => (
              <div key={ev.id} className="event-item">
                <div className="event-dot" style={{ background: ev.subject_color || 'var(--accent)' }} />
                <div className="event-info">
                  <span className="event-title">{ev.title}</span>
                  <span className="event-sub">// {ev.subject_name}</span>
                </div>
                <div className={`event-days ${ev.days_until <= 3 ? 'urgent' : ''}`}>
                  {ev.days_until === 0 ? 'TODAY' : ev.days_until < 0 ? 'PAST' : `T-${ev.days_until}D`}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dash-card">
          <h3>// materias anotadas</h3>
          {enrollments?.length === 0 && <p className="empty">// no hay materias</p>}
          <div className="subject-list">
            {enrollments?.map(en => (
              <div key={en.id} className="subject-item">
                <div className="subject-color" style={{ background: en.subject_color }} />
                <div className="subject-info">
                  <span className="subject-name">{en.subject_name}</span>
                  <span className="subject-code">{en.subject_code || 'N/A'}</span>
                </div>
                <span className={`subject-status status-${en.status}`}>{en.status.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}