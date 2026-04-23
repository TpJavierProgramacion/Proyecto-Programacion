import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'

const COLORS = ['#6366f1','#f59e0b','#22c55e','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899','#14b8a6','#84cc16']
const DAYS_FULL = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const DAYS_SHORT = ['LUN','MAR','MIÉ','JUE','VIE','SÁB']
const EMPTY_SLOT = { day_of_week: 0, start_time: '08:00', end_time: '10:00', classroom: '' }

const inputStyle = {
  background: 'var(--bg-input)',
  border: 'none',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text)',
  fontFamily: 'Roboto Mono, monospace',
  fontSize: '0.88rem',
  padding: '10px 12px',
  outline: 'none',
  width: '100%',
  letterSpacing: '0.05em',
  transition: 'border-color 180ms',
}

const selectStyle = { ...inputStyle }

function InputField({ label, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
    </div>
  )
}

function SlotRow({ slot, index, onUpdate, onRemove, canRemove }) {
  return (
    <div className="slot-row">
      <select
        value={slot.day_of_week}
        onChange={e => onUpdate(index, 'day_of_week', parseInt(e.target.value))}
        style={{ ...selectStyle, width: 'auto' }}
      >
        {DAYS_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
      </select>
      <input
        type="time"
        value={slot.start_time}
        onChange={e => onUpdate(index, 'start_time', e.target.value)}
        style={{ ...inputStyle, width: 'auto' }}
      />
      <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>→</span>
      <input
        type="time"
        value={slot.end_time}
        onChange={e => onUpdate(index, 'end_time', e.target.value)}
        style={{ ...inputStyle, width: 'auto' }}
      />
      <input
        type="text"
        value={slot.classroom}
        onChange={e => onUpdate(index, 'classroom', e.target.value)}
        placeholder="Aula (opcional)"
        style={{ ...inputStyle, flex: 1 }}
      />
      {canRemove && (
        <button
          className="delete-btn"
          onClick={() => onRemove(index)}
          style={{ color: 'var(--accent)', fontSize: '1rem' }}
        >×</button>
      )}
    </div>
  )
}

export default function Materias() {
  const qc = useQueryClient()
  const [step, setStep] = useState('list')
  const [careerForm, setCareerForm] = useState({ name: '', code: '' })
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', year: 1, credits: 0, color: '#6366f1', career: '' })
  const [enrollForm, setEnrollForm] = useState({ subject: '', academic_year: new Date().getFullYear(), semester: 1 })
  const [slots, setSlots] = useState([{ ...EMPTY_SLOT }])
  const [editingId, setEditingId] = useState(null)
  const [editSlots, setEditSlots] = useState([])
  const [deletedSlotIds, setDeletedSlotIds] = useState([])
  const [error, setError] = useState('')

  const { data: careers = [] } = useQuery({ queryKey: ['careers'], queryFn: () => api.get('/careers/').then(r => r.data) })
  const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: () => api.get('/subjects/').then(r => r.data) })
  const { data: enrollments = [] } = useQuery({ queryKey: ['enrollments'], queryFn: () => api.get('/enrollments/').then(r => r.data) })

  const createCareer = useMutation({
    mutationFn: d => api.post('/careers/', d),
    onSuccess: () => { qc.invalidateQueries(['careers']); setStep('list'); setCareerForm({ name: '', code: '' }); setError('') },
    onError: err => setError(JSON.stringify(err.response?.data || 'Error'))
  })

  const createSubject = useMutation({
    mutationFn: d => api.post('/subjects/', d),
    onSuccess: () => { qc.invalidateQueries(['subjects']); setStep('list'); setSubjectForm({ name: '', code: '', year: 1, credits: 0, color: '#6366f1', career: '' }); setError('') },
    onError: err => setError(JSON.stringify(err.response?.data || 'Error'))
  })

  const createEnrollment = useMutation({
    mutationFn: async (d) => {
      const res = await api.post('/enrollments/', d)
      const enrollmentId = res.data.id
      try {
        for (const slot of slots) {
          await api.post('/schedule-slots/', { ...slot, enrollment: enrollmentId })
        }
      } catch (slotErr) {
        try { await api.delete(`/enrollments/${enrollmentId}/`) } catch {}
        throw slotErr
      }
      return res
    },
    onSuccess: () => {
      qc.invalidateQueries(['enrollments'])
      setStep('list')
      setSlots([{ ...EMPTY_SLOT }])
      setEnrollForm({ subject: '', academic_year: new Date().getFullYear(), semester: 1 })
      setError('')
    },
    onError: err => setError(JSON.stringify(err.response?.data || 'Error al guardar horarios'))
  })

  const deleteEnrollment = useMutation({
    mutationFn: id => api.delete(`/enrollments/${id}/`),
    onSuccess: () => qc.invalidateQueries(['enrollments'])
  })

  const saveEditSlots = useMutation({
    mutationFn: async ({ enrollmentId }) => {
      for (const id of deletedSlotIds) {
        await api.delete(`/schedule-slots/${id}/`)
      }
      for (const slot of editSlots) {
        if (slot.id) {
          await api.patch(`/schedule-slots/${slot.id}/`, {
            day_of_week: slot.day_of_week,
            start_time: slot.start_time,
            end_time: slot.end_time,
            classroom: slot.classroom
          })
        } else {
          await api.post('/schedule-slots/', { ...slot, enrollment: enrollmentId })
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries(['enrollments'])
      setEditingId(null); setEditSlots([]); setDeletedSlotIds([])
    },
    onError: err => setError(JSON.stringify(err.response?.data || 'Error al editar horarios'))
  })

  const startEdit = (en) => {
    setEditingId(en.id)
    setEditSlots(en.schedule_slots?.map(s => ({ ...s })) || [])
    setDeletedSlotIds([])
  }
  const cancelEdit = () => { setEditingId(null); setEditSlots([]); setDeletedSlotIds([]) }

  const addSlot = () => setSlots(prev => [...prev, { ...EMPTY_SLOT }])
  const removeSlot = (i) => setSlots(prev => prev.filter((_, idx) => idx !== i))
  const updateSlot = (i, f, v) => setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, [f]: v } : s))

  const addEditSlot = () => setEditSlots(prev => [...prev, { ...EMPTY_SLOT }])
  const removeEditSlot = (i) => {
    const slot = editSlots[i]
    if (slot.id) setDeletedSlotIds(prev => [...prev, slot.id])
    setEditSlots(prev => prev.filter((_, idx) => idx !== i))
  }
  const updateEditSlot = (i, f, v) => setEditSlots(prev => prev.map((s, idx) => idx === i ? { ...s, [f]: v } : s))

  const handleCreateEnrollment = () => {
    setError('')
    if (!enrollForm.subject) { setError('// ERROR: seleccioná una materia'); return }
    for (const slot of slots) {
      if (slot.start_time >= slot.end_time) {
        setError('// ERROR: la hora de inicio debe ser menor que la de fin')
        return
      }
    }
    createEnrollment.mutate(enrollForm)
  }

  return (
    <div className="page">

      {/* ── HEADER ── */}
      <div className="page-header">
        <div>
          <h1>MATE<em>RIAS</em></h1>
          <p className="subtitle">// Administracion De Materias</p>
        </div>
        {step === 'list' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={() => { setStep('add-career'); setError('') }}>CARRERAS</button>
            <button className="btn-secondary" onClick={() => { setStep('add-subject'); setError('') }}>MATERIAS</button>
            <button className="btn-primary" onClick={() => { setStep('add-enrollment'); setError('') }}>HORARIOS</button>
          </div>
        )}
      </div>

      {/* ── ERROR ── */}
      {error && (
        <div className="auth-error" style={{ marginBottom: 20 }}>{error}</div>
      )}

      {/* ── FORM: Nueva carrera ── */}
      {step === 'add-career' && (
        <div className="form-card">
          <h2>Nueva Carrera</h2>
          <div className="form-grid">
            <InputField label="nombre">
              <input
                style={inputStyle}
                type="text"
                value={careerForm.name}
                onChange={e => setCareerForm({ ...careerForm, name: e.target.value })}
                placeholder="Ingeniería en Computación"
              />
            </InputField>
            <InputField label="código">
              <input
                style={inputStyle}
                type="text"
                value={careerForm.code}
                onChange={e => setCareerForm({ ...careerForm, code: e.target.value })}
                placeholder="IC"
              />
            </InputField>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={() => createCareer.mutate(careerForm)}>Crear Carrera</button>
            <button className="btn-secondary" onClick={() => setStep('list')}>cancelar</button>
          </div>
        </div>
      )}

      {/* ── FORM: Nueva materia ── */}
      {step === 'add-subject' && (
        <div className="form-card">
          <h2>Nueva Materia</h2>
          <div className="form-grid">
            <InputField label="carrera">
              <select
                style={selectStyle}
                value={subjectForm.career}
                onChange={e => setSubjectForm({ ...subjectForm, career: e.target.value })}
              >
                <option value="">Selecciona Carrera</option>
                {careers.map(c => <option key={c.id} value={c.id}>{c. name}</option>)}
              </select>
            </InputField>
            <InputField label="nombre">
              <input
                style={inputStyle}
                type="text"
                value={subjectForm.name}
                onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })}
                placeholder="Algoritmos y Estructuras"
              />
            </InputField>
            <InputField label="código">
              <input
                style={inputStyle}
                type="text"
                value={subjectForm.code}
                onChange={e => setSubjectForm({ ...subjectForm, code: e.target.value })}
                placeholder="AyED"
              />
            </InputField>
            <InputField label="año">
              <input
                style={inputStyle}
                type="number"
                value={subjectForm.year}
                onChange={e => setSubjectForm({ ...subjectForm, year: parseInt(e.target.value) })}
                min={1} max={6}
              />
            </InputField>
          </div>
          <div className="field" style={{ marginBottom: 20 }}>
            <label>color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
              {COLORS.map(c => (
                <div
                  key={c}
                  onClick={() => setSubjectForm({ ...subjectForm, color: c })}
                  style={{
                    width: 22, height: 22,
                    background: c,
                    cursor: 'pointer',
                    outline: subjectForm.color === c ? `2px solid var(--accent)` : '2px solid transparent',
                    outlineOffset: 2,
                    transition: 'outline 0.15s'
                  }}
                />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={() => createSubject.mutate(subjectForm)}>Crear Horario</button>
            <button className="btn-secondary" onClick={() => setStep('list')}>cancelar</button>
          </div>
        </div>
      )}

      {/* ── FORM: Nueva inscripción ── */}
      {step === 'add-enrollment' && (
        <div className="form-card">
          <h2>Nueva Cursada</h2>
          <div className="form-grid">
            <InputField label="materia">
              <select
                style={selectStyle}
                value={enrollForm.subject}
                onChange={e => setEnrollForm({ ...enrollForm, subject: e.target.value })}
              >
                <option value="">Selecciona Materia</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </InputField>
            <InputField label="año académico">
              <input
                style={inputStyle}
                type="number"
                value={enrollForm.academic_year}
                onChange={e => setEnrollForm({ ...enrollForm, academic_year: parseInt(e.target.value) })}
              />
            </InputField>
            <InputField label="cuatrimestre">
              <select
                style={selectStyle}
                value={enrollForm.semester}
                onChange={e => setEnrollForm({ ...enrollForm, semester: parseInt(e.target.value) })}
              >
                <option value={1}>1° Cuatrimestre</option>
                <option value={2}>2° Cuatrimestre</option>
              </select>
            </InputField>
          </div>

          <div className="schedule-section">
            <h2 style={{ marginBottom: 14 }}>Agregar Más Materias</h2>
            {slots.map((slot, i) => (
              <SlotRow key={i} slot={slot} index={i} onUpdate={updateSlot} onRemove={removeSlot} canRemove={slots.length > 1} />
            ))}
            <button className="btn-sm" onClick={addSlot} style={{ marginTop: 4 }}>Agregar Horarios</button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button className="btn-primary" onClick={handleCreateEnrollment}>// Crear Horario</button>
            <button className="btn-secondary" onClick={() => setStep('list')}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── EMPTY STATE ── */}
      {enrollments.length === 0 && step === 'list' && (
        <div className="empty-state">
          <span>[ ]</span>
          <p>No Hay Materias</p>
        </div>
      )}

      {/* ── LISTA ── */}
      {enrollments.length > 0 && step === 'list' && (
        <div className="enrollments-list">
          {enrollments.map((en) => (
            <div key={en.id} className="enrollment-card">
              <div className="enrollment-color" style={{ background: en.subject_color || 'var(--accent)' }} />
              <div className="enrollment-info" style={{ flex: 1 }}>
                <div className="enrollment-header">
                  <span className="enrollment-name">{en.subject_name}</span>
                  <span className="enrollment-career">// {en.career_name}</span>
                </div>
                <div className="enrollment-meta">
                  <span>{en.academic_year} · {en.semester === 1 ? 'Q1' : 'Q2'}</span>
                  <span className={`subject-status status-${en.status}`}>{en.status.toUpperCase()}</span>
                </div>

                {/* Schedule chips */}
                {editingId !== en.id && en.schedule_slots?.length > 0 && (
                  <div className="schedule-chips">
                    {en.schedule_slots.map(slot => (
                      <span key={slot.id} className="schedule-chip">
                        {DAYS_SHORT[slot.day_of_week]} {slot.start_time?.slice(0, 5)}–{slot.end_time?.slice(0, 5)}
                        {slot.classroom && ` · ${slot.classroom}`}
                      </span>
                    ))}
                  </div>
                )}

                {/* Edit slots panel */}
                {editingId === en.id && (
                  <div className="schedule-section" style={{ marginTop: 12 }}>
                    <h3 style={{ marginBottom: 12 }}>Editar Slots</h3>
                    {editSlots.map((slot, i) => (
                      <SlotRow key={slot.id || `new-${i}`} slot={slot} index={i} onUpdate={updateEditSlot} onRemove={removeEditSlot} canRemove={true} />
                    ))}
                    {editSlots.length === 0 && (
                      <p style={{ color: 'var(--text-3)', fontSize: '0.72rem', letterSpacing: '0.1em', marginBottom: 10 }}>
                        // no slots — add one below
                      </p>
                    )}
                    <button className="btn-sm" onClick={addEditSlot}>Añadir Horario</button>
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      <button className="btn-primary" style={{ fontSize: '0.65rem', padding: '7px 16px' }} onClick={() => saveEditSlots.mutate({ enrollmentId: en.id })}>
                        Guardar
                      </button>
                      <button className="btn-secondary" style={{ fontSize: '0.65rem', padding: '7px 16px' }} onClick={cancelEdit}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                {editingId !== en.id && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button className="btn-sm" onClick={() => startEdit(en)}>Editar</button>
                    <button
                      className="btn-sm"
                      onClick={() => deleteEnrollment.mutate(en.id)}
                      style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                    >Eliminar</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}