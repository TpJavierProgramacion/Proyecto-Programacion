import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=1)
def process_document(self, document_id: str):
    try:
        from core.models import UploadedDocument

        doc = UploadedDocument.objects.get(id=document_id)
        doc.status = 'processing'
        doc.save(update_fields=['status'])

        file_path = doc.file.path
        logger.info(f"[process_document] Iniciando {file_path}")

        # Verificar que el archivo exista físicamente
        import os
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"El archivo no existe en disco: {file_path}")

        # Intentar importar lector de PDFs
        try:
            import pypdf
            reader_class = pypdf.PdfReader
        except ImportError:
            try:
                import PyPDF2
                reader_class = PyPDF2.PdfReader
                logger.warning("[process_document] Usando PyPDF2 fallback")
            except ImportError:
                raise ImportError("No está instalado pypdf ni PyPDF2. Ejecutá: pip install pypdf")

        with open(file_path, 'rb') as f:
            reader = reader_class(f)
            text_parts = []
            for i, page in enumerate(reader.pages):
                try:
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text)
                except Exception as page_err:
                    logger.warning(f"Error extrayendo página {i}: {page_err}")
            text = '\n'.join(text_parts)

        doc.extracted_text = text
        doc.page_count = len(reader.pages)
        doc.status = 'indexed'
        doc.processed_at = timezone.now()
        doc.save(update_fields=['extracted_text', 'page_count', 'status', 'processed_at'])

        logger.info(f"[process_document] OK: {doc.filename} ({doc.page_count} páginas)")
        return {'status': 'ok', 'pages': doc.page_count}

    except UploadedDocument.DoesNotExist:
        logger.error(f"[process_document] Documento {document_id} no encontrado en DB")
        return {'status': 'error', 'reason': 'not_found'}

    except FileNotFoundError as fnf:
        logger.error(f"[process_document] {fnf}")
        # No tiene sentido reintentar si el archivo no está en disco
        try:
            from core.models import UploadedDocument
            doc = UploadedDocument.objects.get(id=document_id)
            doc.status = 'error'
            doc.save(update_fields=['status'])
        except Exception:
            pass
        return {'status': 'error', 'reason': 'file_not_found'}

    except Exception as exc:
        logger.exception(f"[process_document] Error inesperado: {exc}")
        try:
            from core.models import UploadedDocument
            doc = UploadedDocument.objects.get(id=document_id)
            doc.status = 'error'
            doc.save(update_fields=['status'])
        except Exception:
            pass
        # Un solo reintento para errores transitorios
        raise self.retry(exc=exc, countdown=30)