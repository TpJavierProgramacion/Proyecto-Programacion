from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Career, Subject, Enrollment, AcademicEvent, UploadedDocument, Flashcard, StudyPlan

admin.site.register(User, UserAdmin)
admin.site.register(Career)
admin.site.register(Subject)
admin.site.register(Enrollment)
admin.site.register(AcademicEvent)
admin.site.register(UploadedDocument)
admin.site.register(Flashcard)
admin.site.register(StudyPlan)
