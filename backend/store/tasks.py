import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db.models import F
from django.utils import timezone

from .models import EmailLog

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_queued_email(self, email_log_id: int) -> None:
    """Deliver an outbox entry, retaining status and failures for admins."""
    try:
        email_log = EmailLog.objects.get(pk=email_log_id)
    except EmailLog.DoesNotExist:
        logger.warning("queued_email_missing", extra={"email_log_id": email_log_id})
        return

    if email_log.status == EmailLog.Status.SENT:
        return

    EmailLog.objects.filter(pk=email_log.pk).update(
        status=EmailLog.Status.SENDING,
        attempts=F("attempts") + 1,
        sending_at=timezone.now(),
        error_message="",
        backend=settings.EMAIL_BACKEND,
    )
    email_log.refresh_from_db()

    try:
        msg = EmailMultiAlternatives(
            subject=email_log.subject,
            body=email_log.body_text,
            from_email=email_log.from_email,
            to=[email_log.to_email],
        )
        if email_log.body_html:
            msg.attach_alternative(email_log.body_html, "text/html")
        if email_log.attachment_data:
            msg.attach(
                email_log.attachment_name,
                bytes(email_log.attachment_data),
                email_log.attachment_mimetype,
            )
        msg.send(fail_silently=False)
    except Exception as exc:
        updates = {
            "error_message": str(exc),
            "failed_at": timezone.now(),
            "status": EmailLog.Status.FAILED,
        }
        if self.request.retries < self.max_retries:
            updates["status"] = EmailLog.Status.RETRYING
        EmailLog.objects.filter(pk=email_log.pk).update(**updates)
        logger.exception("email_send_failed", extra={"email_log_id": email_log.pk})
        raise self.retry(exc=exc)

    EmailLog.objects.filter(pk=email_log.pk).update(
        status=EmailLog.Status.SENT,
        sent_at=timezone.now(),
        failed_at=None,
        error_message="",
    )
    logger.info("email_sent", extra={"email_log_id": email_log.pk, "to": email_log.to_email})
