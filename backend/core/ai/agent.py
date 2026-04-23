import json
import re
from datetime import date, datetime
from .client import groq_client
from .tools import AgentTools
from ..models import AgentSession, AgentMessage

SYSTEM_PROMPT = """Sos UniBot, asistente académico universitario argentino. Respondé siempre en español, de forma concisa y amigable.
Tenés acceso a los datos académicos reales del estudiante que se muestran abajo.
Cuando el usuario pida un plan de estudio, usá los IDs reales de sus materias y eventos para crearlo.
Si el usuario menciona una materia o examen, buscalo en los datos y usá su ID real.
Cuando creés un plan de estudio, confirmá que lo agregaste al calendario con las fechas desde hoy hasta el examen."""

def detect_intent(message):
    msg = message.lower()
    if any(w in msg for w in ['plan', 'planif', 'organiz', 'prepar', 'estudiar para', 'estudio para']):
        return 'study_plan'
    if any(w in msg for w in ['examen', 'parcial', 'final', 'fecha', 'cuándo', 'cuando', 'próximo', 'proximo', 'evento']):
        return 'calendar'
    if any(w in msg for w in ['flashcard', 'tarjeta', 'memorizar', 'repasar', 'generar']):
        return 'flashcards'
    if any(w in msg for w in ['pdf', 'documento', 'archivo', 'apunte']):
        return 'documents'
    if any(w in msg for w in ['materia', 'cursada', 'horario', 'inscripc']):
        return 'enrollments'
    return None

class UniBotAgent:
    def __init__(self, user, session=None):
        self.user = user
        self.tools = AgentTools(user)
        self.session = session or AgentSession.objects.create(user=user)

    def _save_message(self, role, content, tool_name='', tool_input=None, tool_output=None, tokens=0):
        AgentMessage.objects.create(
            session=self.session, role=role, content=content,
            tool_name=tool_name, tool_input=tool_input,
            tool_output=tool_output, tokens_used=tokens
        )

    def _get_context(self):
        parts = []
        try:
            calendar = self.tools.get_calendar()
            if calendar.get('events'):
                events_text = '\n'.join([
                    f" - {e['title']} | Materia: {e['subject']} | Fecha: {e['date']} | Días restantes: {e['days_until']} | ID evento: {e['id']} | ID inscripción: {e['enrollment_id']}"
                    for e in calendar['events'][:8]
                ])
                parts.append(f"PRÓXIMOS EVENTOS:\n{events_text}")
        except Exception:
            pass

        try:
            from ..models import Enrollment, UploadedDocument
            enrollments = Enrollment.objects.filter(user=self.user, status='active').select_related('subject')
            if enrollments:
                enroll_text = '\n'.join([f" - {e.subject.name} | ID inscripción: {e.id}" for e in enrollments])
                parts.append(f"MATERIAS ACTIVAS:\n{enroll_text}")

            docs = UploadedDocument.objects.filter(enrollment__user=self.user, status='indexed').select_related('enrollment__subject')
            if docs:
                docs_text = '\n'.join([f" - {d.filename} | Materia: {d.enrollment.subject.name} | ID doc: {d.id} | ID inscripción: {d.enrollment_id}" for d in docs])
                parts.append(f"DOCUMENTOS INDEXADOS:\n{docs_text}")
        except Exception:
            pass

        return '\n\n'.join(parts)

    def _create_study_plan_to_calendar(self, enrollment_id, exam_event_id, hours_per_day=2):
        """Create study plan and add items as calendar events."""
        from ..models import Enrollment, AcademicEvent, StudyPlan, StudyPlanItem, UploadedDocument
        from django.utils import timezone
        import math

        try:
            enrollment = Enrollment.objects.get(id=enrollment_id, user=self.user)
            exam_event = AcademicEvent.objects.get(id=exam_event_id)
            days_until = (exam_event.date.date() - date.today()).days

            if days_until <= 0:
                return {'error': 'El examen ya pasó'}

            # Get docs for context - ahora leemos más texto para extraer temas reales
            docs = UploadedDocument.objects.filter(enrollment=enrollment, status='indexed')
            topics_text = ''
            if docs:
                # Unimos hasta 1500 chars para tener más contexto de temas
                topics_text = ' '.join([d.extracted_text[:800] for d in docs[:3]])

            # Ask Groq to generate the plan
            from .prompts import STUDY_PLAN_PROMPT
            prompt = STUDY_PLAN_PROMPT.format(
                subject=enrollment.subject.name,
                exam_date=exam_event.date.strftime('%Y-%m-%d'),
                days_available=days_until,
                hours_per_day=hours_per_day,
                topics=topics_text[:1500] if topics_text else f'Temas típicos de {enrollment.subject.name}'
            )

            response = groq_client.chat([{'role': 'user', 'content': prompt}])
            raw = response['message']['content']

            # Parse JSON
            try:
                clean = re.sub(r'```json|```', '', raw).strip()
                data = json.loads(clean)
            except Exception:
                # Fallback: create a plan based on subject name
                data = self._generate_fallback_plan(enrollment.subject.name, exam_event.date.date(), days_until, hours_per_day)

            # Save StudyPlan
            plan = StudyPlan.objects.create(
                enrollment=enrollment,
                target_event=exam_event,
                title=data.get('title', f'Plan de estudio - {enrollment.subject.name}'),
                agent_reasoning=data.get('reasoning', ''),
                generated_by_agent=True,
                status='active'
            )

            # Save items AND create calendar events
            items_created = 0
            for item_data in data.get('items', []):
                try:
                    item_date = item_data.get('scheduled_date', date.today().isoformat())
                    StudyPlanItem.objects.create(
                        plan=plan,
                        title=item_data['title'],
                        description=item_data.get('description', ''),
                        scheduled_date=item_date,
                        duration_minutes=item_data.get('duration_minutes', 60),
                        order=item_data.get('order', items_created)
                    )
                    # Create as calendar event
                    AcademicEvent.objects.create(
                        enrollment=enrollment,
                        title=f"📚 {item_data['title']}",
                        event_type='assignment',
                        date=timezone.make_aware(datetime.combine(datetime.strptime(item_date, '%Y-%m-%d').date(), datetime.min.time().replace(hour=18))),
                        notes=item_data.get('description', ''),
                    )
                    items_created += 1
                except Exception:
                    continue

            return {
                'success': True,
                'plan_id': str(plan.id),
                'title': plan.title,
                'items_created': items_created,
                'days_until_exam': days_until
            }
        except Exception as e:
            return {'error': str(e)}

    def _generate_fallback_plan(self, subject, exam_date, days_until, hours_per_day):
        """Generate a basic study plan with subject-specific topics."""
        from datetime import timedelta
        items = []
        sessions_per_day = max(1, hours_per_day // 2)

        # Temas inferidos del nombre de la materia en vez de genéricos
        subject_lower = subject.lower()
        if any(w in subject_lower for w in ['álgebra', 'algebra', 'matemática', 'analisis', 'cálculo', 'calculo']):
            topics = ['Números reales y complejos', 'Funciones y límites', 'Derivadas y aplicaciones', 'Integrales y técnicas', 'Ecuaciones diferenciales', 'Repaso de ejercicios tipo parcial']
        elif any(w in subject_lower for w in ['física', 'fisica', 'mecánica', 'mecanica']):
            topics = ['Cinemática y dinámica', 'Trabajo y energía', 'Momentum y colisiones', 'Rotación y torque', 'Fluidos y termodinámica', 'Resolución de problemas']
        elif any(w in subject_lower for w in ['programación', 'programacion', 'algoritmo', 'computación', 'computacion', 'estructura de datos']):
            topics = ['Tipos de datos y estructuras básicas', 'Algoritmos de ordenamiento', 'Estructuras dinámicas (pilas, colas, listas)', 'Árboles y grafos', 'Complejidad algorítmica', 'Práctica de ejercicios de parcial']
        elif any(w in subject_lower for w in ['historia', 'sociología', 'sociologia', 'filosofía', 'filosofia']):
            topics = ['Contexto histórico inicial', 'Autores principales y sus obras', 'Conceptos fundamentales', 'Corrientes y debates', 'Análisis de fuentes', 'Síntesis para el examen']
        else:
            # Fallback inteligente basado en palabras del nombre
            words = [w for w in subject.split() if len(w) > 3]
            if len(words) >= 2:
                topics = [f'Fundamentos de {words[0]}', f'{words[0]} aplicado a {words[1]}', f'Métodos y técnicas de {words[0]}', f'Casos y ejercicios prácticos', f'Integración de conceptos', f'Repaso final integrador']
            else:
                topics = ['Fundamentos y conceptos básicos', 'Desarrollo de temas principales', 'Métodos y aplicaciones', 'Ejercicios prácticos', 'Casos de estudio', 'Repaso general integrador']

        # Distribuir topics en los días disponibles
        total_topics = len(topics)
        for i, topic in enumerate(topics):
            day_offset = max(1, int((i / max(total_topics - 1, 1)) * (days_until - 1))) if i < total_topics - 1 else days_until - 1
            if day_offset < 0:
                day_offset = 0
            scheduled = (date.today() + timedelta(days=day_offset)).isoformat()
            items.append({
                'title': topic,
                'description': f'Estudio de {topic} para {subject}. Revisar teoría, resolver ejercicios y preparar resumen.',
                'scheduled_date': scheduled,
                'duration_minutes': hours_per_day * 60 // max(len(topics) // max(days_until, 1), 1),
                'order': i + 1
            })

        return {'title': f'Plan de estudio — {subject}', 'reasoning': 'Plan generado a partir de temas típicos de la materia', 'items': items}

    def _find_matching_event(self, message, events):
        """Try to find the event the user is referring to."""
        msg_lower = message.lower()
        for event in events:
            if event['subject'].lower() in msg_lower:
                return event
            for word in event['title'].lower().split():
                if len(word) > 3 and word in msg_lower:
                    return event
        return events[0] if events else None

    def chat(self, user_message):
        self._save_message('user', user_message)

        context = self._get_context()
        system_with_context = SYSTEM_PROMPT
        if context:
            system_with_context += f'\n\nDATOS ACTUALES DEL ESTUDIANTE:\n{context}'

        # Build message history (last 8)
        history = list(self.session.messages.filter(role__in=['user', 'assistant']).order_by('created_at'))
        messages = [{'role': 'system', 'content': system_with_context}]
        for msg in history[-8:]:
            messages.append({'role': msg.role, 'content': msg.content})
        messages.append({'role': 'user', 'content': user_message})

        intent = detect_intent(user_message)
        study_plan_created = False

        # Auto-execute study plan creation
        if intent == 'study_plan':
            try:
                calendar = self.tools.get_calendar()
                events = calendar.get('events', [])
                if events:
                    event = self._find_matching_event(user_message, events)
                    if event:
                        result = self._create_study_plan_to_calendar(
                            enrollment_id=event['enrollment_id'],
                            exam_event_id=event['id'],
                            hours_per_day=2
                        )
                        self._save_message('tool', str(result), tool_name='create_study_plan', tool_output=result)
                        if result.get('success'):
                            study_plan_created = True
                            tool_info = f"\n\n[SISTEMA: Plan de estudio creado exitosamente. Título: '{result['title']}', {result['items_created']} sesiones de estudio agregadas al calendario hasta el examen en {result['days_until_exam']} días.]"
                            messages[-1]['content'] = user_message + tool_info
            except Exception:
                pass

        elif intent == 'calendar':
            try:
                calendar = self.tools.get_calendar()
                self._save_message('tool', str(calendar), tool_name='get_calendar', tool_output=calendar)
                if calendar.get('events'):
                    cal_info = f"\n\n[DATOS: {json.dumps(calendar, ensure_ascii=False)}]"
                    messages[-1]['content'] = user_message + cal_info
            except Exception:
                pass

        response = groq_client.chat(messages)
        content = response['message']['content']
        tokens = response.get('eval_count', 0)

        self._save_message('assistant', content, tokens=tokens)
        return {
            'message': content,
            'session_id': str(self.session.id),
            'tokens_used': tokens,
            'study_plan_created': study_plan_created
        }