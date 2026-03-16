from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models

from apps.students.models import Student
from apps.subjects.models import Subject
from apps.classes.models import SchoolClass


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GRADE_THRESHOLDS = [
    (90, "1", "HIGHEST"),
    (80, "2", "HIGHER"),
    (60, "3", "HIGH"),
    (55, "4", "HIGH AVERAGE"),
    (50, "5", "AVERAGE"),
    (45, "6", "LOW AVERAGE"),
    (40, "7", "LOW"),
    (35, "8", "LOWER"),
    (0,  "9", "LOWEST"),
]

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

    # Computed fields — never set these directly; they are derived on save()
    score    = models.FloatField(default=0, editable=False)
    grade    = models.CharField(max_length=2,  blank=True, editable=False)
    remark   = models.CharField(max_length=20, blank=True, editable=False)

    subject_position = models.IntegerField(null=True, blank=True, default=None)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["student", "subject", "term"]
        ordering        = ["-created_at"]

    def __str__(self):
        return f"{self.student} – {self.subject} – {self.score}"

    # ------------------------------------------------------------------
    # Grade / remark derivation
    # ------------------------------------------------------------------

    @staticmethod
    def compute_grade_and_remark(score: float) -> tuple[str, str]:
        """
        Return (grade, remark) for a given total score.
        Moved from module level — it belongs on the model it serves.
        """
        for threshold, grade, remark in GRADE_THRESHOLDS:
            if score >= threshold:
                return grade, remark
        return "9", "LOWEST"

    # ------------------------------------------------------------------
    # Save
    # ------------------------------------------------------------------

    def save(self, *args, **kwargs):
        self.score          = round(self.reopen + self.ca + self.exams, 1)
        self.grade, self.remark = self.compute_grade_and_remark(self.score)
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
    term             = models.CharField(max_length=10, choices=TERM_CHOICES)
    year             = models.PositiveIntegerField(
        validators=[MinValueValidator(2000), MaxValueValidator(2100)],
    )
    attendance       = models.PositiveIntegerField(
        validators=[MinValueValidator(0)],
    )
    attendance_total = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],   # total of zero makes no sense
    )
    interest       = models.TextField(blank=True)
    conduct        = models.CharField(max_length=100)
    teacher_remark = models.TextField()
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        # fix: prevents duplicate reports for the same student/term/year
        unique_together = ["student", "term", "year"]
        ordering        = ["-year", "term"]

    def __str__(self):
        return f"{self.student} – {self.term} {self.year}"