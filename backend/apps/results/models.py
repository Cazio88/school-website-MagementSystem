from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models

from apps.students.models import Student
from apps.subjects.models import Subject
from apps.classes.models import SchoolClass


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TERM_CHOICES = (
    ("term1", "Term 1"),
    ("term2", "Term 2"),
    ("term3", "Term 3"),
)


# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------

class Result(models.Model):

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="results",
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="results",
    )
    school_class = models.ForeignKey(
        SchoolClass,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="results",
    )
    term = models.CharField(max_length=10, choices=TERM_CHOICES)

    # Score breakdown — each component is capped at its maximum
    reopen = models.FloatField(
        default=0,
        help_text="Re-open/RDA score (max 20)",
        validators=[MinValueValidator(0), MaxValueValidator(20)],
    )
    ca = models.FloatField(
        default=0,
        help_text="CA/MGT score (max 40)",
        validators=[MinValueValidator(0), MaxValueValidator(40)],
    )
    exams = models.FloatField(
        default=0,
        help_text="Exams score (max 40)",
        validators=[MinValueValidator(0), MaxValueValidator(40)],
    )

    # Computed total — derived on save(), never set directly.
    # grade/remark are intentionally NOT stored: they depend on the student's
    # school level (B79 / B16 / NKG) and are computed at query time in the view.
    score = models.FloatField(default=0, editable=False)

    subject_position = models.IntegerField(null=True, blank=True, default=None)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["student", "subject", "term"]
        ordering        = ["-created_at"]

    def __str__(self):
        return f"{self.student} – {self.subject} – {self.score}"

    def save(self, *args, **kwargs):
        self.score = round(self.reopen + self.ca + self.exams, 1)
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

class Report(models.Model):

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="reports",
    )
    term = models.CharField(max_length=10, choices=TERM_CHOICES)
    year = models.PositiveIntegerField(
        validators=[MinValueValidator(2000), MaxValueValidator(2100)],
    )

    attendance       = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0)])
    attendance_total = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])

    interest       = models.TextField(blank=True)
    conduct        = models.CharField(max_length=100, blank=True)
    teacher_remark = models.TextField(blank=True)

    # Term calendar dates — editable by teachers via the report page
    vacation_date   = models.DateField(null=True, blank=True)
    resumption_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["student", "term", "year"]
        ordering        = ["-year", "term"]

    def __str__(self):
        return f"{self.student} – {self.term} {self.year}"