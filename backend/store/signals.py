"""
Django signals for the store app.
Automatically sends emails when Order status or payment_status changes.
"""
import logging
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)

# We use pre_save to capture old values before they are overwritten,
# and post_save to trigger emails after the save is committed.

_order_status_before: dict = {}
_payment_status_before: dict = {}


@receiver(pre_save, sender="store.Order")
def capture_order_old_status(sender, instance, **kwargs):
    """Cache the old status values before saving so we can detect changes."""
    if instance.pk:
        try:
            old = sender.objects.get(pk=instance.pk)
            _order_status_before[instance.pk]   = old.status
            _payment_status_before[instance.pk] = old.payment_status
        except sender.DoesNotExist:
            pass


@receiver(post_save, sender="store.Order")
def on_order_saved(sender, instance, created, **kwargs):
    """After an Order is saved, send the appropriate email notification."""
    from .utils import send_order_status_email, send_payment_status_email

    if created:
        # New order — confirmation email is sent directly from OrderViewSet.create,
        # so we don't duplicate it here.
        _order_status_before.pop(instance.pk, None)
        _payment_status_before.pop(instance.pk, None)
        return

    old_status   = _order_status_before.pop(instance.pk, None)
    old_payment  = _payment_status_before.pop(instance.pk, None)

    # Order status changed?
    if old_status and old_status != instance.status:
        logger.info("order_status_changed",
                    extra={"order_id": instance.pk,
                           "from": old_status, "to": instance.status})
        send_order_status_email(instance)

    # Payment status changed?
    if old_payment and old_payment != instance.payment_status:
        logger.info("payment_status_changed",
                    extra={"order_id": instance.pk,
                           "from": old_payment, "to": instance.payment_status})
        send_payment_status_email(instance)
