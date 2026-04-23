import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'

export default function Flashcards() {
  const qc = useQueryClient()
  const [studyMode, setStudyMode] = useState(false)
  const [studyCards, setStudyCards] = useState([])
  const [studySubject, setStudySubject] = useState('')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState(null)

  const { data: flashcards } = useQuery({
    queryKey: ['flashcards'],
    queryFn: () => api.get('/flashcards/').then(r => r.data),
  })

  const { data: enrollments } = useQuery({
    queryKey: ['enrollments'],
    queryFn: () => api.get('/enrollments/').then(r => r.data),
  })

  const deleteCard = useMutation({
    mutationFn: id => api.delete(`/flashcards/${id}/`),
    onSuccess: () => qc.invalidateQueries(['flashcards'])
  })

  const review = useMutation({
    mutationFn: ({ id, result }) => api.post('/flashcard-reviews/', {
      flashcard: id, result, next_review: new Date().toISOString()
    }),
    onSuccess: () => {
      setFlipped(false)
      if (currentIdx + 1 >= studyCards.length) {
        setCurrentIdx(studyCards.length) // trigger done screen
      } else {
        setCurrentIdx(i => i + 1)
      }
    }
  })

  // Group flashcards by enrollment/subject
  const grouped = (flashcards || []).reduce((acc, fc) => {
    const en = enrollments?.find(e => e.id === fc.enrollment)
    const key = en ? en.subject_name : 'Sin materia'
    const color = en?.subject_color || '#6366f1'
    if (!acc[key]) acc[key] = { cards: [], color }
    acc[key].cards.push(fc)
    return acc
  }, {})

  const startStudy = (cards, subject) => {
    setStudyCards([...cards])
    setStudySubject(subject)
    setCurrentIdx(0)
    setFlipped(false)
    setStudyMode(true)
  }

  const current = studyCards[currentIdx]
  const done = studyMode && currentIdx >= studyCards.length

  if (studyMode) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Estudiando <em>{studySubject}</em></h1>
            <p className="subtitle">{currentIdx + 1} de {studyCards.length} flashcards</p>
          </div>
          <button type="button" className="btn-secondary" onClick={() => setStudyMode(false)}>✕ Salir</button>
        </div>

        {!done && current && (
          <div className="study-mode">
            <div className="study-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${(currentIdx / studyCards.length) * 100}%` }} />
              </div>
              <span>{currentIdx + 1} / {studyCards.length}</span>
            </div>

            <div className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)}>
              <div className="flashcard-inner">
                <div className="flashcard-front">
                  <span className="card-label">Pregunta</span>
                  <p>{current.question}</p>
                  <small>Hacé click para ver la respuesta</small>
                </div>
                <div className="flashcard-back">
                  <span className="card-label">Respuesta</span>
                  <p>{current.answer}</p>
                </div>
              </div>
            </div>

            {flipped && (
              <div className="review-buttons">
                <button type="button" className="review-btn fail" onClick={() => review.mutate({ id: current.id, result: 'fail' })}>✕ No lo sabía</button>
                <button type="button" className="review-btn hard" onClick={() => review.mutate({ id: current.id, result: 'hard' })}>△ Difícil</button>
                <button type="button" className="review-btn good" onClick={() => review.mutate({ id: current.id, result: 'good' })}>○ Bien</button>
                <button type="button" className="review-btn easy" onClick={() => review.mutate({ id: current.id, result: 'easy' })}>✓ Fácil</button>
              </div>
            )}
          </div>
        )}

        {done && (
          <div className="study-complete">
            <span className="complete-icon">🎉</span>
            <h2>¡Sesión completada!</h2>
            <p>Revisaste {studyCards.length} flashcards de {studySubject}</p>
            <button type="button" className="btn-primary" onClick={() => setStudyMode(false)}>Volver</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Flash<em>cards</em></h1>
          <p className="subtitle">Organizadas por materia · {flashcards?.length ?? 0} en total</p>
        </div>
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="empty-state">
          <span>◇</span>
          <p>No hay flashcards todavía</p>
          <small>Subí un PDF en Brain Drain y generá flashcards automáticamente con IA</small>
        </div>
      )}

      <div className="fc-folders">
        {Object.entries(grouped).map(([subject, { cards, color }]) => (
          <div key={subject} className="fc-folder">
            <div
              className="fc-folder-header"
              onClick={() => setExpandedGroup(expandedGroup === subject ? null : subject)}
            >
              <div className="fc-folder-left">
                <div className="fc-folder-color" style={{ background: color }} />
                <div>
                  <span className="fc-folder-name">{subject}</span>
                  <span className="fc-folder-count">{cards.length} flashcards</span>
                </div>
              </div>
              <div className="fc-folder-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={e => { e.stopPropagation(); startStudy(cards, subject) }}
                >
                  ▶ Estudiar
                </button>
                <span className="fc-chevron">{expandedGroup === subject ? '▲' : '▼'}</span>
              </div>
            </div>

            {expandedGroup === subject && (
              <div className="fc-folder-cards">
                {cards.map(fc => (
                  <div key={fc.id} className="fc-card-item">
                    <div className="fc-card-content">
                      <div className={`fc-difficulty d-${fc.difficulty}`}>{'★'.repeat(fc.difficulty)}</div>
                      <p className="fc-question">{fc.question}</p>
                      <p className="fc-answer">{fc.answer}</p>
                    </div>
                    <div className="fc-card-meta">
                      {fc.is_ai_generated && <span className="ai-badge">IA</span>}
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() => deleteCard.mutate(fc.id)}
                        title="Eliminar flashcard"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
