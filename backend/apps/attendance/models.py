# apps/attendance/models.py
from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
from apps.students.models import Student
from apps.classes.models import SchoolClass


def _derive_term(month: int) -> str:
    """Map a calendar month to a Term value."""
    if month <= 4:
        return Attendance.Term.TERM1
    if month <= 8:
        return Attendance.Term.TERM2
    return Attendance.Term.TERM3


def _get_current_term():
    """Default callable — derives term from today's date at record creation."""
    return _derive_term(timezone.localdate().month)


class Attendance(models.Model):

    class Term(models.TextChoices):
        TERM1 = "term1", "Term 1"
        TERM2 = "term2", "Term 2"
        TERM3 = "term3", "Term 3"

    class Status(models.TextChoices):
        PRESENT = "present", "Present"
        ABSENT  = "absent",  "Absent"
        LATE    = "late",    "Late"

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="attendances",
    )
    school_class = models.ForeignKey(
        SchoolClass,
        on_delete=models.CASCADE,
        related_name="attendances",
    )
    term = models.CharField(
        max_length=10,
        choices=Term.choices,
        default=_get_current_term,
    )
    date = models.DateField()
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PRESENT,
    )
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Attendance"
        verbose_name_plural = "Attendances"
        unique_together = ["student", "school_class", "date"]
        ordering = ["-date", "student"]
        indexes = [
            models.Index(fields=["date"]),
            models.Index(fields=["student", "term"]),
            models.Index(fields=["school_class", "date"]),
            # IMPROVEMENT: composite index for term-scoped summary queries
            # (e.g. /attendance/?school_class=X&term=term1)
            models.Index(fields=["school_class", "term", "date"]),
        ]

    def __str__(self):
        return f"{self.student} — {self.date} — {self.get_status_display()}"

    def clean(self):
        super().clean()

        if self.date and self.date > timezone.localdate():
            raise ValidationError(
                {"date": "Attendance cannot be recorded for a future date."}
            )

        # Derive term from the record's own date so historical imports are
        # always labelled correctly, regardless of when they're created.
        if self.date:
            self.term = _derive_term(self.date.month)

    def save(self, *args, **kwargs):
        # BUG FIX: Removed full_clean() from save().
        #
        # Calling full_clean() inside save() causes two problems:
        #   1. bulk_create / bulk_update bypass save() entirely, so validation
        #      is inconsistently applied — you get a false sense of safety.
        #   2. Django admin and DRF already call full_clean() before save(),
        #      so placing it here too runs validation twice and can surface
        #      confusing duplicate errors.
        #
        # Validation is now enforced at the API boundary in the serializer
        # (via validate()) and in the viewset (via perform_create/perform_update).
        # The clean() method remains for use with ModelForms and the admin.
        #
        # We do still derive term here so that any direct .save() call (e.g.
        # from management commands or bulk operations) keeps the field accurate.
        if self.date:
            self.term = _derive_term(self.date.month)
        super().save(*args, **kwargs)

    # ------------------------------------------------------------------
    # Convenience helpers
    # ------------------------------------------------------------------

    @property
    def is_present(self) -> bool:
        return self.status == self.Status.PRESENT

    @property
    def is_absent(self) -> bool:
        return self.status == self.Status.ABSENT

    @property
    def is_late(self) -> bool:
        return self.status == self.Status.LATE
