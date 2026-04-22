# apps/attendance/models.py
from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
from apps.students.models import Student
from apps.classes.models import SchoolClass


def _get_current_term():
    """
    Derive the current academic term from the calendar month.
    Adjust the month ranges to match your school calendar.
        Term 1 : Jan – Apr  (or Sep – Dec in some systems)
        Term 2 : May – Aug
        Term 3 : Sep – Dec
    """
    month = timezone.localdate().month
    if month <= 4:
        return Attendance.Term.TERM1
    if month <= 8:
        return Attendance.Term.TERM2
    return Attendance.Term.TERM3


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
        # BUG FIX: derive term dynamically so records aren't always labelled "Term 1"
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
        # BUG FIX: was ["student", "date"] — missing school_class meant a student
        # enrolled in two classes (or re-enrolled) could never have two records on
        # the same date even in different classes, and the API's school_class filter
        # would silently return duplicate rows.  The true business key is the
        # triple (student, school_class, date).
        unique_together = ["student", "school_class", "date"]
        ordering = ["-date", "student"]
        indexes = [
            models.Index(fields=["date"]),
            models.Index(fields=["student", "term"]),
            models.Index(fields=["school_class", "date"]),
        ]

    def __str__(self):
        return f"{self.student} — {self.date} — {self.get_status_display()}"

    def clean(self):
        super().clean()
        if self.date and self.date > timezone.localdate():
            raise ValidationError(
                {"date": "Attendance cannot be recorded for a future date."}
            )
        # Auto-derive term from date when saving so it stays accurate even on
        # historical imports.
        if self.date:
            month = self.date.month
            if month <= 4:
                self.term = self.Term.TERM1
            elif month <= 8:
                self.term = self.Term.TERM2
            else:
                self.term = self.Term.TERM3

    def save(self, *args, **kwargs):
        self.full_clean()
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
