UNIBOT_SYSTEM_PROMPT = """Sos UniBot, asistente académico universitario argentino. Respondé siempre en español, de forma concisa y directa.
Tenés acceso a los datos académicos reales del estudiante que se muestran abajo.
Cuando el usuario pida un plan de estudio, usá los IDs reales de sus materias y eventos.
Cada sesión del plan debe tener un tema específico y detallado de qué estudiar ese día."""

FLASHCARD_GENERATION_PROMPT = """Analizá el siguiente texto y generá {count} flashcards de estudio.
Respondé ÚNICAMENTE con JSON válido, sin texto adicional ni markdown:

{"flashcards": [{"question": "pregunta clara y específica", "answer": "respuesta concisa y completa", "difficulty": 3}]}

Texto:
{text}"""

STUDY_PLAN_PROMPT = """Generá un plan de estudio DETALLADO para:
Materia: {subject}
Fecha del examen: {exam_date}
Días disponibles: {days_available}
Horas por día: {hours_per_day}
Contenido disponible de apuntes/documentos: {topics}

REGLAS OBLIGATORIAS:
1. Cada ítem del plan debe ser un TEMA ESPECÍFICO de la materia (no genérico como "Repaso general").
2. Usá los temas reales que aparecen en el contenido disponible. Si no hay contenido, inferí temas típicos de la materia.
3. La descripción debe decir EXACTAMENTE qué subtemas cubrir ese día.
4. El título de cada ítem debe ser el nombre del tema a estudiar.

Respondé ÚNICAMENTE con JSON válido sin markdown:
{"title": "título del plan", "reasoning": "por qué este orden tiene sentido", "items": [{"title": "Nombre del tema específico", "description": "Qué subtemas, ejercicios y enfoque tener ese día. Mencioná conceptos concretos.", "scheduled_date": "YYYY-MM-DD", "duration_minutes": 90, "order": 1}]}"""