# apps/attendance/models.py

from django.db import models
from django.utils import timezone
from apps.students.models import Student
from apps.classes.models import SchoolClass


class Attendance(models.Model):

    TERM_CHOICES = (
        ("term1", "Term 1"),
        ("term2", "Term 2"),
        ("term3", "Term 3"),
    )

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
        choices=TERM_CHOICES,
        default="term1",
    )
    date   = models.DateField()
    status = models.CharField(
        max_length=10,
        choices=[
            ("present", "Present"),
            ("absent",  "Absent"),
            ("late",    "Late"),
        ],
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ["student", "date"]

    def __str__(self):
        return f"{self.student} - {self.date} - {self.status}"