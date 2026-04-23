import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bio = models.TextField(blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'users'


class Career(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='careers', null=True, blank=True)
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20)
    class Meta:
        db_table = 'careers'
    def __str__(self): return self.name


class Subject(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    career = models.ForeignKey(Career, on_delete=models.CASCADE, related_name='subjects')
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, blank=True)
    year = models.PositiveSmallIntegerField(default=1)
    credits = models.PositiveSmallIntegerField(default=0)
    color = models.CharField(max_length=7, default='#6366f1')
    class Meta:
        db_table = 'subjects'
    def __str__(self): return f"{self.code} - {self.name}"


class Enrollment(models.Model):
    STATUS_CHOICES = [('active','Cursando'),('passed','Aprobada'),('failed','Desaprobada'),('pending','Pendiente')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='enrollments')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='enrollments')
    academic_year = models.PositiveSmallIntegerField()
    semester = models.PositiveSmallIntegerField(choices=[(1,'1°'),(2,'2°')])
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')
    final_grade = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    class Meta:
        db_table = 'enrollments'


class ScheduleSlot(models.Model):
    DAY_CHOICES = [(0,'Lunes'),(1,'Martes'),(2,'Miércoles'),(3,'Jueves'),(4,'Viernes'),(5,'Sábado')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    enrollment = models.ForeignKey(Enrollment, on_delete=models.CASCADE, related_name='schedule_slots')
    day_of_week = models.PositiveSmallIntegerField(choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    classroom = models.CharField(max_length=50, blank=True)
    class Meta:
        db_table = 'schedule_slots'


class AcademicEvent(models.Model):
    EVENT_TYPES = [('exam_partial','Parcial'),('exam_final','Final'),('exam_retake','Recuperatorio'),('assignment','TP'),('project','Proyecto'),('other','Otro')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    enrollment = models.ForeignKey(Enrollment, on_delete=models.CASCADE, related_name='events')
    title = models.CharField(max_length=200)
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    date = models.DateTimeField()
    location = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    grade = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    reminder_sent = models.BooleanField(default=False)
    class Meta:
        db_table = 'academic_events'
        ordering = ['date']


class Note(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    enrollment = models.ForeignKey(Enrollment, on_delete=models.CASCADE, related_name='notes')
    title = models.CharField(max_length=200)
    content = models.TextField(blank=True)
    git_repo_path = models.CharField(max_length=500, blank=True)
    last_commit_hash = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        db_table = 'notes'


class UploadedDocument(models.Model):
    STATUS_CHOICES = [('pending','Pendiente'),('processing','Procesando'),('indexed','Indexado'),('error','Error')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    enrollment = models.ForeignKey(Enrollment, on_delete=models.CASCADE, related_name='documents')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    file = models.FileField(upload_to='documents/%Y/%m/')
    filename = models.CharField(max_length=255)
    file_size = models.PositiveBigIntegerField()
    mime_type = models.CharField(max_length=100)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')
    page_count = models.PositiveIntegerField(null=True, blank=True)
    extracted_text = models.TextField(blank=True)
    embedding_id = models.CharField(max_length=100, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    class Meta:
        db_table = 'uploaded_documents'


class Flashcard(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    enrollment = models.ForeignKey(Enrollment, on_delete=models.CASCADE, related_name='flashcards')
    source_document = models.ForeignKey(UploadedDocument, on_delete=models.SET_NULL, null=True, blank=True, related_name='flashcards')
    question = models.TextField()
    answer = models.TextField()
    difficulty = models.PositiveSmallIntegerField(default=3)
    is_ai_generated = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'flashcards'


class FlashcardReview(models.Model):
    RESULT_CHOICES = [('easy','Fácil'),('good','Bien'),('hard','Difícil'),('fail','Falló')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    flashcard = models.ForeignKey(Flashcard, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    result = models.CharField(max_length=10, choices=RESULT_CHOICES)
    next_review = models.DateTimeField()
    reviewed_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'flashcard_reviews'


class ExamSimulation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    enrollment = models.ForeignKey(Enrollment, on_delete=models.CASCADE, related_name='simulations')
    title = models.CharField(max_length=200)
    questions = models.JSONField()
    score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'exam_simulations'


class StudyPlan(models.Model):
    STATUS_CHOICES = [('draft','Borrador'),('active','Activo'),('completed','Completado'),('archived','Archivado')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    enrollment = models.ForeignKey(Enrollment, on_delete=models.CASCADE, related_name='study_plans')
    target_event = models.ForeignKey(AcademicEvent, on_delete=models.SET_NULL, null=True, blank=True, related_name='study_plans')
    title = models.CharField(max_length=200)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')
    generated_by_agent = models.BooleanField(default=True)
    agent_reasoning = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'study_plans'


class StudyPlanItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(StudyPlan, on_delete=models.CASCADE, related_name='items')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    scheduled_date = models.DateField()
    duration_minutes = models.PositiveIntegerField(default=60)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    class Meta:
        db_table = 'study_plan_items'
        ordering = ['scheduled_date', 'order']


class AgentSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='agent_sessions')
    enrollment = models.ForeignKey(Enrollment, on_delete=models.SET_NULL, null=True, blank=True, related_name='agent_sessions')
    context = models.JSONField(default=dict)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    class Meta:
        db_table = 'agent_sessions'


class AgentMessage(models.Model):
    ROLE_CHOICES = [('user','Usuario'),('assistant','Agente'),('system','Sistema'),('tool','Herramienta')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(AgentSession, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    tool_name = models.CharField(max_length=100, blank=True)
    tool_input = models.JSONField(null=True, blank=True)
    tool_output = models.JSONField(null=True, blank=True)
    tokens_used = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'agent_messages'
        ordering = ['created_at']
