from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .auth.views import LoginView, RegisterView, LogoutView, ProfileView
from .views import (
    CareerViewSet, SubjectViewSet, EnrollmentViewSet,
    ScheduleSlotViewSet, AcademicEventViewSet,
    UploadedDocumentViewSet, FlashcardViewSet,
    FlashcardReviewViewSet, StudyPlanViewSet, AgentChatViewSet
)

router = DefaultRouter()
router.register('careers', CareerViewSet, basename='career')
router.register('subjects', SubjectViewSet, basename='subject')
router.register('enrollments', EnrollmentViewSet, basename='enrollment')
router.register('schedule-slots', ScheduleSlotViewSet, basename='schedule-slot')
router.register('events', AcademicEventViewSet, basename='event')
router.register('documents', UploadedDocumentViewSet, basename='document')
router.register('flashcards', FlashcardViewSet, basename='flashcard')
router.register('flashcard-reviews', FlashcardReviewViewSet, basename='flashcard-review')
router.register('study-plans', StudyPlanViewSet, basename='studyplan')
router.register('agent', AgentChatViewSet, basename='agent')

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/profile/', ProfileView.as_view(), name='profile'),
    path('', include(router.urls)),
]
