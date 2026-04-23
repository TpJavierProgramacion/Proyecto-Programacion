from rest_framework import serializers
from datetime import date, timedelta
from django.utils import timezone
from .models import (
    Career, Subject, Enrollment, ScheduleSlot,
    AcademicEvent, UploadedDocument,
    Flashcard, FlashcardReview,
    StudyPlan, StudyPlanItem, AgentSession, AgentMessage
)


class CareerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Career
        fields = ('id', 'name', 'code')

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class SubjectSerializer(serializers.ModelSerializer):
    career_name = serializers.CharField(source='career.name', read_only=True)
    class Meta:
        model = Subject
        fields = ('id', 'career', 'career_name', 'name', 'code', 'year', 'credits', 'color')


class ScheduleSlotSerializer(serializers.ModelSerializer):
    day_label = serializers.SerializerMethodField()
    class Meta:
        model = ScheduleSlot
        fields = ('id', 'enrollment', 'day_of_week', 'day_label', 'start_time', 'end_time', 'classroom')
        read_only_fields = ('id',)

    def get_day_label(self, obj):
        days = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
        return days[obj.day_of_week]


class EnrollmentSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)
    subject_color = serializers.CharField(source='subject.color', read_only=True)
    career_name = serializers.CharField(source='subject.career.name', read_only=True)
    schedule_slots = ScheduleSlotSerializer(many=True, read_only=True)

    class Meta:
        model = Enrollment
        fields = ('id', 'subject', 'subject_name', 'subject_code', 'subject_color', 'career_name', 'academic_year', 'semester', 'status', 'final_grade', 'schedule_slots')
        read_only_fields = ('id',)

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class AcademicEventSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='enrollment.subject.name', read_only=True)
    subject_color = serializers.CharField(source='enrollment.subject.color', read_only=True, default='#6366f1')
    days_until = serializers.SerializerMethodField()

    class Meta:
        model = AcademicEvent
        fields = ('id', 'enrollment', 'subject_name', 'subject_color', 'title', 'event_type', 'date', 'location', 'notes', 'grade', 'reminder_sent', 'days_until')
        read_only_fields = ('id', 'reminder_sent')

    def get_days_until(self, obj):
        return (obj.date.date() - date.today()).days


class UploadedDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = UploadedDocument
        fields = ('id', 'enrollment', 'filename', 'file', 'file_size', 'mime_type', 'status', 'page_count', 'uploaded_at', 'processed_at')
        read_only_fields = ('id', 'status', 'page_count', 'uploaded_at', 'processed_at', 'filename', 'file_size', 'mime_type')

    def create(self, validated_data):
        validated_data['uploaded_by'] = self.context['request'].user
        f = validated_data.get('file')
        validated_data['filename'] = f.name
        validated_data['file_size'] = f.size
        validated_data['mime_type'] = getattr(f, 'content_type', 'application/pdf')
        return super().create(validated_data)


class FlashcardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Flashcard
        fields = ('id', 'enrollment', 'source_document', 'question', 'answer', 'difficulty', 'is_ai_generated', 'created_at')
        read_only_fields = ('id', 'is_ai_generated', 'created_at')


class FlashcardReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = FlashcardReview
        fields = ('id', 'flashcard', 'result', 'next_review', 'reviewed_at')
        read_only_fields = ('id', 'reviewed_at', 'next_review')

    def create(self, validated_data):
        intervals = {'easy': 4, 'good': 2, 'hard': 1, 'fail': 0}
        days = intervals.get(validated_data.get('result'), 1)
        validated_data['next_review'] = timezone.now() + timedelta(days=days)
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class StudyPlanItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudyPlanItem
        fields = ('id', 'title', 'description', 'scheduled_date', 'duration_minutes', 'is_completed', 'completed_at', 'order')
        read_only_fields = ('id',)


class StudyPlanSerializer(serializers.ModelSerializer):
    items = StudyPlanItemSerializer(many=True, read_only=True)
    class Meta:
        model = StudyPlan
        fields = ('id', 'enrollment', 'target_event', 'title', 'status', 'generated_by_agent', 'agent_reasoning', 'created_at', 'items')
        read_only_fields = ('id', 'generated_by_agent', 'agent_reasoning', 'created_at')


class AgentMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentMessage
        fields = ('id', 'role', 'content', 'tool_name', 'created_at')
        read_only_fields = ('id', 'created_at')


class AgentSessionSerializer(serializers.ModelSerializer):
    messages = AgentMessageSerializer(many=True, read_only=True)
    class Meta:
        model = AgentSession
        fields = ('id', 'enrollment', 'started_at', 'ended_at', 'messages')
        read_only_fields = ('id', 'started_at')
