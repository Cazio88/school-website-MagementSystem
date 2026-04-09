from django.db import models
from django.conf import settings
from apps.subjects.models import Subject
from apps.classes.models import SchoolClass

class Teacher(models.Model):
    teacher_id = models.CharField(
        max_length=20,
        unique=True
    )
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.SET_NULL,
        null=True
    )
    school_class = models.ForeignKey(
        SchoolClass,
        on_delete=models.SET_NULL,
        null=True
    )
    hire_date = models.DateField()

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        super().save(*args, **kwargs)
        if is_new and self.user and not self.user.has_usable_password():
            self.user.set_password("teacher123")
            self.user.save(update_fields=["password"])

    @property
    def full_name(self):
        return self.user.get_full_name() or self.user.username

    def __str__(self):
        return self.teacher_id
