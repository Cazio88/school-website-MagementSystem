import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.fees.models import PaymentTransaction
from apps.fees.services.termii import TermiiSMSService, TermiiSMSError
from apps.fees.services.templates import fee_payment_received

logger = logging.getLogger(__name__)


@receiver(post_save, sender=PaymentTransaction)
def notify_parent_on_payment(
    sender,
    instance: PaymentTransaction,
    created: bool,
    **kwargs,
):
    if not created:
        return

    fee     = instance.fee
    student = fee.student

    parent_phone  = student.parent_phone
    parent_name   = student.parent_name or "Parent"
    student_name  = student.full_name
    student_class = str(student.school_class) if student.school_class else "N/A"

    if not parent_phone:
        logger.warning(
            "No parent_phone for student %s (fee pk=%s). SMS skipped.",
            student, fee.pk,
        )
        return

    message = fee_payment_received(
        parent_name=parent_name,
        student_name=student_name,
        student_class=student_class,
        amount_paid=instance.amount,
        balance=fee.balance,
        term=fee.get_term_display(),
        transaction_id=instance.pk,
    )

    try:
        TermiiSMSService().send(phone=parent_phone, message=message)
    except TermiiSMSError as exc:
        logger.error(
            "Failed to send SMS for transaction pk=%s to %s: %s",
            instance.pk, parent_phone, exc,
        )
    except Exception as exc:                          # ← add this
        logger.error(
            "Unexpected SMS error for transaction pk=%s: %s",
            instance.pk, exc,
        )