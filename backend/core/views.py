class UploadedDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = UploadedDocumentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return UploadedDocument.objects.filter(enrollment__user=self.request.user)

    def perform_create(self, serializer):
        doc = serializer.save()
        # Intentar async, si falla el broker, procesar sync
        try:
            process_document.delay(str(doc.id))
        except Exception as exc:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Celery no disponible, procesando sincrónicamente: {exc}")
            process_document.run(str(doc.id))  # ejecuta la tarea sync