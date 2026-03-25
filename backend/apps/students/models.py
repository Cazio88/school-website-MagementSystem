from django.db import models
from django.conf import settings
from cloudinary.models import CloudinaryField
from apps.classes.models import SchoolClass


class Student(models.Model):

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="student_profile"
    )

    admission_number = models.CharField(max_length=50, unique=True)
    student_name     = models.CharField(max_length=255, blank=True, default="")

    school_class = models.ForeignKey(
        SchoolClass,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="students"
    )

    photo = CloudinaryField(
        resource_type="image",
        folder="students",
        blank=True,
        null=True,
    )

    date_of_birth  = models.DateField(null=True, blank=True)
    parent_name    = models.CharField(max_length=100, blank=True, default="")
    parent_phone   = models.CharField(max_length=20,  blank=True, default="")  # ← NEW
    address        = models.TextField(blank=True, null=True)
    admission_date = models.DateField(auto_now_add=True)

    class Meta:
        ordering = ["user__username"]

    @property
    def full_name(self):
        return (
            self.student_name
            or self.user.get_full_name()
            or self.user.username
        )

    def __str__(self):
        return f"{self.full_name} ({self.admission_number})"