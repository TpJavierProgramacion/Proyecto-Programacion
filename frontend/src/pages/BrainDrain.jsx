import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

const STATUS_LABELS = {
  pending: { label: 'Pendiente', color: '#64748b' },
  processing: { label: 'Procesando...', color: '#f59e0b' },
  indexed: { label: 'Listo ✓', color: '#22c55e' },
  error: { label: 'Error', color: '#ef4444' },
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!n || n <= 0 || !isFinite(n)) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${parseFloat((n / k ** i).toFixed(1))} ${sizes[i]}`;
}

function getStatusInfo(status) {
  return STATUS_LABELS[status] || { label: status || 'Desconocido', color: '#94a3b8' };
}

function validateFile(file) {
  if (!file) return 'No se seleccionó ningún archivo.';
  if (typeof file.size !== 'number') return 'No se pudo leer el tamaño del archivo.';
  if (file.size > MAX_FILE_SIZE) return 'El archivo excede el límite de 50 MB.';
  if (file.type !== 'application/pdf' && !file.name?.toLowerCase().endsWith('.pdf')) {
    return 'Solo se permiten archivos PDF.';
  }
  return null;
}

export default function BrainDrain() {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const dragCounter = useRef(0);

  const [enrollment, setEnrollment] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [generatingId, setGeneratingId] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const { data: docs, isLoading: docsLoading, isError: docsError } = useQuery({
    queryKey: ['documents'],
    queryFn: () => api.get('/documents/').then((r) => r.data),
    refetchInterval: 5000,
  });

  const { data: enrollments } = useQuery({
    queryKey: ['enrollments'],
    queryFn: () => api.get('/enrollments/').then((r) => r.data),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, enrollmentId }) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('enrollment', enrollmentId);
      const { data } = await api.post('/documents/', fd);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      setUploadError('');
      setNotice({ msg: 'Documento subido. Procesando...', type: 'success' });
    },
    onError: (err) => {
      setUploadError(
        err.response?.data?.detail ||
        err.response?.data?.file?.[0] ||
        err.message ||
        'Error al subir el archivo'
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/documents/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      setNotice({ msg: 'Documento eliminado', type: 'success' });
    },
  });

  const handleFile = useCallback(
    (file) => {
      if (!enrollment) { setUploadError('Seleccioná una materia primero'); return; }
      const error = validateFile(file);
      if (error) { setUploadError(error); return; }
      setUploadError('');
      uploadMutation.mutate({ file, enrollmentId: enrollment });
    },
    [enrollment, uploadMutation]
  );

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    if (!enrollment) return;
    dragCounter.current += 1;
    if (dragCounter.current === 1) setIsDragging(true);
  }, [enrollment]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) { dragCounter.current = 0; setIsDragging(false); }
  }, []);

  const handleDragOver = useCallback((e) => e.preventDefault(), []);
  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  const handleZoneClick = useCallback(() => {
    if (!enrollment) { setUploadError('Seleccioná una materia primero'); return; }
    fileRef.current?.click();
  }, [enrollment]);

  const handleGenerateFlashcards = useCallback(async (docId) => {
    setGeneratingId(docId);
    try {
      await api.post('/flashcards/generate/', { document_id: docId, count: 10 });
      qc.invalidateQueries({ queryKey: ['flashcards'] });
      setNotice({ msg: '¡Flashcards generadas!', type: 'success' });
    } catch {
      setUploadError('Error al generar flashcards. Verificá que el servicio de IA esté disponible.');
    } finally {
      setGeneratingId(null);
    }
  }, [qc]);

  const handleDelete = useCallback((id) => {
    if (!window.confirm('¿Eliminar este documento permanentemente?')) return;
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Brain <em>Drain</em></h1>
          <p className="subtitle">Subí tus apuntes y dejá que la IA los analice</p>
        </div>
      </div>

      {notice && (
        <div style={{
          padding: '0.6rem 0.9rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem',
          background: notice.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: notice.type === 'success' ? '#166534' : '#991b1b',
          border: `1px solid ${notice.type === 'success' ? '#86efac' : '#fca5a5'}`,
        }}>
          {notice.msg}
        </div>
      )}

      <div className="brain-drain-grid">
        <div className="upload-section">
          <div className="field">
            <label htmlFor="enrollment-select">Materia</label>
            <select id="enrollment-select" value={enrollment} onChange={(e) => { setEnrollment(e.target.value); setUploadError(''); }}>
              <option value="">Seleccionar materia...</option>
              {enrollments?.map((en) => (
                <option key={en.id} value={en.id}>{en.subject_name || 'Sin nombre'}</option>
              ))}
            </select>
          </div>

          <div
            role="button" tabIndex={0} aria-label="Zona de carga de archivos PDF"
            className={`drop-zone ${isDragging ? 'dragging' : ''} ${!enrollment ? 'disabled' : ''}`}
            onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
            onDrop={handleDrop} onClick={handleZoneClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleZoneClick(); }}}
          >
            <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={handleFileChange} />
            <div className="drop-icon">◎</div>
            {uploadMutation.isPending ? <p>Subiendo...</p> : (
              <p>{!enrollment ? 'Seleccioná una materia primero' : 'Arrastrá tu PDF acá o hacé click'}</p>
            )}
            <small>Solo archivos PDF · Máx 50MB</small>
          </div>

          {uploadError && <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem' }}>{uploadError}</div>}

          {uploadMutation.isPending && (
            <div className="upload-progress">
              <div className="progress-bar"><div className="progress-fill indeterminate" /></div>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>Subiendo archivo...</span>
            </div>
          )}
        </div>

        <div className="docs-section">
          <h3>Documentos cargados ({Array.isArray(docs) ? docs.length : 0})</h3>

          {docsLoading && <p style={{ color: 'var(--text-2)' }}>Cargando documentos...</p>}
          {docsError && <div style={{ color: '#ef4444', fontSize: '0.875rem' }}>Error al cargar documentos</div>}

          {!docsLoading && !docsError && Array.isArray(docs) && docs.length === 0 && (
            <div className="empty-state">
              <span>◎</span><p>No hay documentos</p><small>Subí tu primer PDF para comenzar</small>
            </div>
          )}

          <div className="doc-list">
            {Array.isArray(docs) && docs.map((doc) => {
              if (!doc || typeof doc !== 'object') return null;
              const status = getStatusInfo(doc.status);
              const canGenerate = doc.status === 'indexed';
              const isProcessing = doc.status === 'pending' || doc.status === 'processing';

              return (
                <div key={doc.id || Math.random()} className="doc-item">
                  <div className="doc-icon">PDF</div>
                  <div className="doc-info">
                    <span className="doc-name">{doc.filename || 'documento.pdf'}</span>
                    <span className="doc-meta">
                      {doc.page_count ? `${doc.page_count} págs · ` : ''}
                      {formatFileSize(doc.file_size)}
                    </span>
                  </div>
                  <span className="doc-status" style={{ color: status.color }}>{status.label}</span>

                  {canGenerate && (
                    <button type="button" className="btn-sm" onClick={() => handleGenerateFlashcards(doc.id)} disabled={generatingId === doc.id}>
                      {generatingId === doc.id ? '...' : '⚡ Flashcards'}
                    </button>
                  )}

                  {isProcessing && (
                    <span style={{ fontSize: '0.75rem', color: '#f59e0b', marginLeft: 8 }}>⏳ Esperando IA...</span>
                  )}

                  {doc.status === 'error' && (
                    <span style={{ fontSize: '0.75rem', color: '#ef4444', marginLeft: 8 }}>❌ Falló el procesamiento</span>
                  )}

                  <button type="button" className="delete-btn" onClick={() => handleDelete(doc.id)} disabled={deleteMutation.isPending} aria-label="Eliminar" title="Eliminar">✕</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}