# apps/attendance/models.py
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
from apps.students.models import Student
from apps.classes.models import SchoolClass


# ---------------------------------------------------------------------------
# Term helpers
# ---------------------------------------------------------------------------

def _get_current_term() -> str:
    """
    Default callable for Attendance.term.

    Reads CURRENT_TERM from Django settings — the single place the school
    updates at the start of each term.

    WHY NOT derive from calendar month?
    The old _derive_term(month) mapped month <= 4 → term1, which meant
    April (month 4) always produced "term1" even though the school is in
    Term 3. School terms do not align with calendar months, so deriving
    term from the date is inherently wrong and was the root cause of
    attendance records landing on the wrong term.

    Set in settings.py:
        CURRENT_TERM = "term3"   # update at the start of each term
        CURRENT_YEAR = 2025
    """
    return getattr(settings, "CURRENT_TERM", "term3")


def _get_current_year() -> int:
    return getattr(settings, "CURRENT_YEAR", 2025)


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

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
    # FIX: default is now a callable that reads settings.CURRENT_TERM,
    # not a function that derives term from the calendar month.
    term = models.CharField(
        max_length=10,
        choices=Term.choices,
        default=_get_current_term,
    )
    year = models.PositiveIntegerField(
        default=_get_current_year,
    )
    date   = models.DateField()
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PRESENT,
    )
    notes      = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = "Attendance"
        verbose_name_plural = "Attendances"
        unique_together     = ["student", "school_class", "date"]
        ordering            = ["-date", "student"]
        indexes = [
            models.Index(fields=["date"]),
            models.Index(fields=["student", "term"]),
            models.Index(fields=["school_class", "date"]),
            models.Index(fields=["school_class", "term", "date"]),
        ]

    def __str__(self):
        return f"{self.student} — {self.date} — {self.get_status_display()}"

    # ------------------------------------------------------------------
    # Validation — called by full_clean(), ModelForms, and the admin.
    # The serializer calls full_clean() before any DB write (see
    # attendance_serializer.py) so this runs at the API boundary too.
    # ------------------------------------------------------------------

    def clean(self):
        super().clean()

        if self.date and self.date > timezone.localdate():
            raise ValidationError(
                {"date": "Attendance cannot be recorded for a future date."}
            )

        valid_terms = {choice[0] for choice in self.Term.choices}
        if self.term not in valid_terms:
            raise ValidationError(
                {
                    "term": (
                        f"'{self.term}' is not a valid term. "
                        f"Expected one of: {', '.join(sorted(valid_terms))}."
                    )
                }
            )

    # ------------------------------------------------------------------
    # Save — no full_clean() here (see docstring on old model for why)
    # ------------------------------------------------------------------

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

    # ------------------------------------------------------------------
    # Convenience properties
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
