import { useState, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'

const DAYS_HEADER = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7)

const EVENT_COLORS = {
  exam_partial: '#ffcc00',
  exam_final: '#ff2a2a',
  exam_retake: '#ff8800',
  assignment: '#aaaaff',
  project: '#cc88ff',
  other: '#666666',
}
const EVENT_LABELS = {
  exam_partial: 'PARCIAL', exam_final: 'FINAL', exam_retake: 'RECUP',
  assignment: 'TP', project: 'PROY', other: 'OTRO',
}

function isSameDay(dateStr, day, month, year) {
  const d = new Date(dateStr)
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
}

function isSameDayDate(dateStr, date) {
  const d = new Date(dateStr)
  return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate()
}

export default function Calendar() {
  const qc = useQueryClient()
  const today = new Date()
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [view, setView] = useState('month')
  const [selectedDay, setSelectedDay] = useState(today)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', event_type: 'exam_partial', date: '', enrollment: '', notes: '', location: '' })

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const { data: events = [] } = useQuery({
    queryKey: ['events', year, month],
    queryFn: () => api.get(`/events/by_month/?year=${year}&month=${month + 1}`).then(r => r.data),
  })

  const { data: allSlots = [] } = useQuery({
    queryKey: ['schedule-slots'],
    queryFn: () => api.get('/schedule-slots/').then(r => r.data),
  })

  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments'],
    queryFn: () => api.get('/enrollments/').then(r => r.data),
  })

  const createEvent = useMutation({
    mutationFn: d => api.post('/events/', d),
    onSuccess: () => { qc.invalidateQueries(['events']); setShowForm(false); setForm({ title: '', event_type: 'exam_partial', date: '', enrollment: '', notes: '', location: '' }) }
  })

  const deleteEvent = useMutation({
    mutationFn: id => api.delete(`/events/${id}/`),
    onSuccess: () => qc.invalidateQueries(['events'])
  })

  // Build month grid
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()

  const cells = []
  for (let i = firstDayOfWeek - 1; i >= 0; i--) cells.push({ day: prevMonthDays - i, current: false })
  for (let i = 1; i <= daysInMonth; i++) cells.push({ day: i, current: true })
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - daysInMonth - firstDayOfWeek + 2, current: false })

  const getEventsForDay = (day, m, y) => events.filter(e => isSameDay(e.date, day, m, y))

  // Get unique subject colors for a day (for dot indicators)
  const getSubjectDotsForDay = (day, m, y) => {
    const dayEvents = getEventsForDay(day, m, y)
    const seen = new Set()
    return dayEvents.reduce((dots, ev) => {
      const color = ev.subject_color || EVENT_COLORS[ev.event_type] || '#666'
      if (!seen.has(color)) { seen.add(color); dots.push({ color, event: ev }) }
      return dots
    }, [])
  }

  // Week view
  const getWeekStart = (d) => {
    const start = new Date(d)
    const dow = start.getDay()
    start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1))
    return start
  }

  const weekStart = getWeekStart(selectedDay)
  const weekDays = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const isToday = (d) => {
    if (!d) return false
    // Acepta tanto Date como cell {day, current}
    const date = d instanceof Date ? d : (d.current ? new Date(year, month, d.day) : null)
    if (!date) return false
    return isSameDayDate(today.toISOString(), date)
  }
  const isSelected = (cell) => cell.current && cell.day === selectedDay.getDate() && month === selectedDay.getMonth() && year === selectedDay.getFullYear()

  const { data: weekEvents = [] } = useQuery({
    queryKey: ['events', weekStart.getFullYear(), weekStart.getMonth()],
    queryFn: () => api.get(`/events/by_month/?year=${weekStart.getFullYear()}&month=${weekStart.getMonth() + 1}`).then(r => r.data),
    enabled: view === 'week',
  })

  const cellStyle = (cell) => ({
    background: isSelected(cell) ? 'var(--accent-dim)' : isToday(cell) && cell.current ? 'rgba(255,42,42,0.05)' : 'var(--bg-card)',
    borderRight: '1px solid var(--border)',
    borderBottom: '1px solid var(--border)',
    padding: '8px 6px',
    minHeight: '80px',
    cursor: cell.current ? 'pointer' : 'default',
    opacity: cell.current ? 1 : 0.25,
    boxSizing: 'border-box',
    position: 'relative',
    transition: 'background 150ms',
  })

  return (
    <div style={{ padding: '44px 52px', width: '100%', boxSizing: 'border-box' }}>
      <div className="page-header">
        <div>
          <h1>CALEN<em>DARIO</em></h1>
          <p className="subtitle">// academic_events · schedule()</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="view-toggle">
            <button type="button" className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>MES</button>
            <button type="button" className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>SEMANA</button>
          </div>
          <button type="button" className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? '[X] CANCEL' : '[+] EVENTO'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="form-card" style={{ marginBottom: 24 }}>
          <h3>// new_event()</h3>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <div className="field"><label>// título</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Primer parcial" /></div>
            <div className="field"><label>// tipo</label>
              <select value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })}>
                {Object.entries(EVENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="field"><label>// materia</label>
              <select value={form.enrollment} onChange={e => setForm({ ...form, enrollment: e.target.value })}>
                <option value="">seleccionar...</option>
                {enrollments.map(en => <option key={en.id} value={en.id}>{en.subject_name}</option>)}
              </select>
            </div>
            <div className="field"><label>// fecha_hora</label><input type="datetime-local" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div className="field"><label>// lugar</label><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Aula 12..." /></div>
            <div className="field"><label>// notas</label><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Temas..." /></div>
          </div>
          <button type="button" className="btn-primary" onClick={() => createEvent.mutate(form)}>{'>> GUARDAR'}</button>
        </div>
      )}

      {/* MONTH VIEW */}
      {view === 'month' && (
        <div>
          <div className="cal-nav">
            <button type="button" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>{'<<'}</button>
            <span>{MONTHS[month].toUpperCase()} {year}</span>
            <button type="button" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>{'>'+'>'}</button>
            <button type="button" className="btn-sm today-btn" onClick={() => { setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(today) }}>TODAY</button>
          </div>

          {/* Subject legend */}
          {enrollments.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {enrollments.map(en => (
                <div key={en.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.62rem', color: 'var(--text-2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  <div style={{ width: 8, height: 8, background: en.subject_color, borderRadius: '50%', flexShrink: 0 }} />
                  {en.subject_name}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', border: '1px solid var(--border)', width: '100%' }}>
            {DAYS_HEADER.map(d => (
              <div key={d} style={{ background: 'var(--bg-2)', padding: '8px 6px', textAlign: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.15em', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                {d}
              </div>
            ))}
            {cells.map((cell, i) => {
              const dots = cell.current ? getSubjectDotsForDay(cell.day, month, year) : []
              const isT = cell.current && cell.day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

              return (
                <div key={i} style={cellStyle(cell)} onClick={() => cell.current && setSelectedDay(new Date(year, month, cell.day))}>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'Share Tech Mono, monospace', display: 'block', marginBottom: 4, color: isT ? 'var(--accent)' : 'var(--text)', fontWeight: isT ? 700 : 400, letterSpacing: '0.05em' }}>
                    {String(cell.day).padStart(2, '0')}
                    {isT && <span style={{ color: 'var(--accent)', marginLeft: 3, animation: 'blink-dot 1s step-end infinite' }}>●</span>}
                  </span>
                  {/* Color dots for subjects */}
                  {dots.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 2 }}>
                      {dots.slice(0, 4).map((dot, di) => (
                        <div key={di} style={{ width: 6, height: 6, borderRadius: '50%', background: dot.color, flexShrink: 0 }} title={dot.event.subject_name} />
                      ))}
                      {dots.length > 4 && <span style={{ fontSize: '0.55rem', color: 'var(--text-3)' }}>+{dots.length - 4}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Selected day panel */}
          <div style={{ marginTop: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '20px 24px' }}>
            <h3 style={{ marginBottom: 14 }}>
              // {String(selectedDay.getDate()).padStart(2, '0')}.{String(selectedDay.getMonth() + 1).padStart(2, '0')}.{selectedDay.getFullYear()}
            </h3>
            {(() => {
              const dayEvs = getEventsForDay(selectedDay.getDate(), selectedDay.getMonth(), selectedDay.getFullYear())
              const dow = selectedDay.getDay() === 0 ? 6 : selectedDay.getDay() - 1
              const daySlots = allSlots.filter(s => s.day_of_week === dow)
              const subjectForSlot = (slot) => {
                const en = enrollments.find(e => e.id === slot.enrollment)
                return en?.subject_name || 'CLASE'
              }

              return (
                <>
                  {daySlots.map(slot => {
                    const en = enrollments.find(e => e.id === slot.enrollment)
                    return (
                      <div key={slot.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px dashed var(--border)' }}>
                        <span style={{ fontSize: '0.68rem', fontFamily: 'Share Tech Mono, monospace', color: 'var(--text-3)', minWidth: 90, letterSpacing: '0.08em' }}>
                          {slot.start_time?.slice(0, 5)} → {slot.end_time?.slice(0, 5)}
                        </span>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                          {en && <div style={{ width: 6, height: 6, borderRadius: '50%', background: en.subject_color, flexShrink: 0 }} />}
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.04em' }}>{en?.subject_name?.toUpperCase() || 'CLASE'}</span>
                          {slot.classroom && <span style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>// {slot.classroom}</span>}
                        </div>
                      </div>
                    )
                  })}
                  {dayEvs.map(ev => (
                    <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px dashed var(--border)', borderLeft: `2px solid ${ev.subject_color || EVENT_COLORS[ev.event_type] || '#666'}`, paddingLeft: 12 }}>
                      <span style={{ fontSize: '0.68rem', fontFamily: 'Share Tech Mono, monospace', color: 'var(--text-3)', minWidth: 80, letterSpacing: '0.08em' }}>
                        {new Date(ev.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: ev.subject_color || EVENT_COLORS[ev.event_type], flexShrink: 0 }} />
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.04em' }}>{ev.title}</span>
                          <span style={{ fontSize: '0.6rem', border: `1px solid ${EVENT_COLORS[ev.event_type]}`, color: EVENT_COLORS[ev.event_type], padding: '1px 6px', letterSpacing: '0.12em' }}>{EVENT_LABELS[ev.event_type]}</span>
                        </div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-2)', letterSpacing: '0.05em' }}>// {ev.subject_name}</span>
                        {ev.location && <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>// loc: {ev.location}</span>}
                        {ev.notes && <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>// {ev.notes}</span>}
                      </div>
                      <button type="button" className="delete-btn" onClick={() => deleteEvent.mutate(ev.id)}>[X]</button>
                    </div>
                  ))}
                  {dayEvs.length === 0 && daySlots.length === 0 && (
                    <p style={{ color: 'var(--text-3)', fontSize: '0.68rem', letterSpacing: '0.12em' }}>// no_events_found</p>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* WEEK VIEW */}
      {view === 'week' && (
        <div>
          <div className="cal-nav">
            <button type="button" onClick={() => { const d = new Date(selectedDay); d.setDate(d.getDate() - 7); setSelectedDay(d) }}>{'<<'}</button>
            <span>{weekDays[0].getDate().toString().padStart(2,'0')}.{(weekDays[0].getMonth()+1).toString().padStart(2,'0')} → {weekDays[5].getDate().toString().padStart(2,'0')}.{(weekDays[5].getMonth()+1).toString().padStart(2,'0')}.{year}</span>
            <button type="button" onClick={() => { const d = new Date(selectedDay); d.setDate(d.getDate() + 7); setSelectedDay(d) }}>{'>'+'>'}</button>
            <button type="button" className="btn-sm today-btn" onClick={() => setSelectedDay(today)}>TODAY</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(6, 1fr)', border: '1px solid var(--border)', width: '100%', overflowX: 'auto' }}>
            <div style={{ height: 52, borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', background: 'var(--bg-2)' }} />
            {weekDays.map((day, di) => (
              <div key={di} style={{ height: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, borderBottom: '1px solid var(--border)', borderRight: di < 5 ? '1px solid var(--border)' : 'none', background: isToday(day) ? 'rgba(255,42,42,0.05)' : 'var(--bg-2)' }}>
                <span style={{ fontSize: '0.55rem', color: 'var(--text-3)', letterSpacing: '0.15em' }}>
                  {['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'][day.getDay()]}
                </span>
                <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '1rem', color: isToday(day) ? 'var(--accent)' : 'var(--text)', letterSpacing: '0.05em' }}>
                  {String(day.getDate()).padStart(2, '0')}
                </span>
              </div>
            ))}

            {HOURS.map(h => (
              <Fragment key={`row-${h}`}>
                <div style={{ height: 48, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '4px 6px 0 0', fontSize: '0.6rem', fontFamily: 'Share Tech Mono, monospace', color: 'var(--text-3)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', letterSpacing: '0.05em' }}>
                  {h}:00
                </div>
                {weekDays.map((day, di) => {
                  const dayOfWeek = di
                  const slots = allSlots.filter(s => s.day_of_week === dayOfWeek)
                  const dayEvs = weekEvents.filter(e => isSameDayDate(e.date, day))

                  return (
                    <div key={`${h}-${di}`} style={{ height: 48, borderBottom: '1px solid var(--border)', borderRight: di < 5 ? '1px solid var(--border)' : 'none', position: 'relative', background: 'var(--bg-card)' }}>
                      {h === 7 && slots.map(slot => {
                        const en = enrollments.find(e => e.id === slot.enrollment)
                        const [sh, sm] = slot.start_time.split(':').map(Number)
                        const [eh, em] = slot.end_time.split(':').map(Number)
                        const top = ((sh - 7) + sm / 60) * 48
                        const height = ((eh - sh) + (em - sm) / 60) * 48
                        return (
                          <div key={slot.id} style={{ position: 'absolute', top, height, left: 2, right: 2, padding: '3px 5px', fontSize: '0.6rem', overflow: 'hidden', zIndex: 1, background: en ? en.subject_color + '20' : 'rgba(255,255,255,0.04)', borderLeft: `2px solid ${en?.subject_color || 'var(--border-strong)'}`, color: 'var(--text-2)', letterSpacing: '0.05em', fontFamily: 'Roboto Mono, monospace' }}>
                            {en?.subject_name?.toUpperCase().slice(0, 8)}
                          </div>
                        )
                      })}
                      {h === 7 && dayEvs.map(ev => {
                        const d = new Date(ev.date)
                        const top = ((d.getHours() - 7) + d.getMinutes() / 60) * 48
                        const color = ev.subject_color || EVENT_COLORS[ev.event_type] || '#666'
                        return (
                          <div key={ev.id} style={{ position: 'absolute', top: Math.max(0, top), height: 36, left: 2, right: 2, padding: '3px 5px', fontSize: '0.6rem', overflow: 'hidden', zIndex: 2, background: color + '20', borderLeft: `2px solid ${color}`, color: 'var(--text)', letterSpacing: '0.05em', fontFamily: 'Roboto Mono, monospace' }}>
                            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title.toUpperCase()}</span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
