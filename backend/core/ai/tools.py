import json
from datetime import date
from .client import groq_client
from .prompts import FLASHCARD_GENERATION_PROMPT, STUDY_PLAN_PROMPT

class AgentTools:
    def __init__(self, user):
        self.user = user

    def get_calendar(self, **kwargs):
        from ..models import Enrollment, AcademicEvent
        enrollments = Enrollment.objects.filter(user=self.user, status='active')
        events = AcademicEvent.objects.filter(
            enrollment__in=enrollments, date__gte=date.today()
        ).order_by('date').select_related('enrollment__subject')[:20]
        return {'events': [{'id': str(e.id), 'title': e.title, 'type': e.event_type,
                            'subject': e.enrollment.subject.name,
                            'date': e.date.strftime('%Y-%m-%d'),
                            'days_until': (e.date.date() - date.today()).days,
                            'enrollment_id': str(e.enrollment_id)} for e in events]}

    def get_documents(self, enrollment_id=None, **kwargs):
        from ..models import UploadedDocument
        docs = UploadedDocument.objects.filter(enrollment__user=self.user, status='indexed')
        if enrollment_id:
            docs = docs.filter(enrollment_id=enrollment_id)
        return {'documents': [{'id': str(d.id), 'filename': d.filename, 'pages': d.page_count} for d in docs]}

    def generate_flashcards(self, document_id=None, count=10, **kwargs):
        from ..models import UploadedDocument, Flashcard
        try:
            doc = UploadedDocument.objects.get(id=document_id)
            text = doc.extracted_text[:3000]
            prompt = FLASHCARD_GENERATION_PROMPT.format(count=count, text=text)
            response = groq_client.chat([{'role': 'user', 'content': prompt}])
            data = json.loads(response['message']['content'])
            created = []
            for fc in data.get('flashcards', []):
                flashcard = Flashcard.objects.create(
                    enrollment=doc.enrollment, source_document=doc,
                    question=fc['question'], answer=fc['answer'],
                    difficulty=fc.get('difficulty', 3), is_ai_generated=True
                )
                created.append({'id': str(flashcard.id), 'question': fc['question']})
            return {'created': len(created), 'flashcards': created}
        except Exception as e:
            return {'error': str(e)}

    def create_study_plan(self, enrollment_id=None, exam_event_id=None, hours_per_day=2, **kwargs):
        from ..models import Enrollment, AcademicEvent, StudyPlan, StudyPlanItem, UploadedDocument
        try:
            enrollment = Enrollment.objects.get(id=enrollment_id, user=self.user)
            event = AcademicEvent.objects.get(id=exam_event_id)
            days_available = (event.date.date() - date.today()).days
            if days_available <= 0:
                return {'error': 'El examen ya pasó o es hoy'}
            
            docs = UploadedDocument.objects.filter(enrollment=enrollment, status='indexed')
            combined_text = ' '.join([d.extracted_text[:800] for d in docs[:3]])
            prompt = STUDY_PLAN_PROMPT.format(
                subject=enrollment.subject.name, exam_date=event.date.strftime('%Y-%m-%d'),
                days_available=days_available, hours_per_day=hours_per_day,
                topics=combined_text[:1500] or f'Temas de {enrollment.subject.name}'
            )
            response = groq_client.chat([{'role': 'user', 'content': prompt}])
            data = json.loads(response['message']['content'])
            plan = StudyPlan.objects.create(
                enrollment=enrollment, target_event=event, title=data['title'],
                agent_reasoning=data.get('reasoning', ''), generated_by_agent=True
            )
            for item in data.get('items', []):
                StudyPlanItem.objects.create(
                    plan=plan, title=item['title'], description=item.get('description', ''),
                    scheduled_date=item['scheduled_date'],
                    duration_minutes=item.get('duration_minutes', 60), order=item.get('order', 0)
                )
            return {'plan_id': str(plan.id), 'title': plan.title, 'items': len(data.get('items', []))}
        except Exception as e:
            return {'error': str(e)}

    def execute(self, tool_name, **kwargs):
        tools = {
            'get_calendar': self.get_calendar,
            'get_documents': self.get_documents,
            'generate_flashcards': self.generate_flashcards,
            'create_study_plan': self.create_study_plan,
        }
        if tool_name not in tools:
            return {'error': f'Herramienta {tool_name} no existe'}
        return tools[tool_name](**kwargs)