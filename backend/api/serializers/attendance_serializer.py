# api/serializers/attendance_serializer.py
import logging

from django.utils import timezone
from rest_framework import serializers

from apps.attendance.models import Attendance

logger = logging.getLogger(__name__)


class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()

    class Meta:
        model  = Attendance
        fields = [
            "id",
            "student",
            "student_name",
            "school_class",
            "term",
            "year",
            "date",
            "status",
            "notes",
        ]
        # FIX: term and year are now read-only — the backend (perform_create)
        # is the sole authority for stamping them. Clients can read these
        # values but can never supply conflicting ones that would cause
        # validate() to see different values than what actually gets saved.
        read_only_fields = ["id", "student_name", "term", "year"]

    # ------------------------------------------------------------------
    # SerializerMethodField
    # ------------------------------------------------------------------

    def get_student_name(self, obj):
        return str(obj.student)

    # ------------------------------------------------------------------
    # Field-level validation
    # ------------------------------------------------------------------

    def validate_date(self, value):
        """Reject future dates before anything else runs."""
        if value > timezone.localdate():
            raise serializers.ValidationError(
                "Attendance cannot be recorded for a future date."
            )
        return value

    def validate_year(self, value):
        # NOTE: this only fires when year is writable. With year in
        # read_only_fields this method is never called from client input,
        # but is kept here as a safeguard in case read_only_fields is
        # changed in future.
        current_year = timezone.localdate().year
        if value < 2000 or value > current_year + 1:
            raise serializers.ValidationError(
                f"'{value}' is not a plausible school year."
            )
        return value

    # ------------------------------------------------------------------
    # Cross-field validation
    # ------------------------------------------------------------------

    def validate(self, data):
        """
        Two checks:

        1. Enrollment guard — the submitted student must belong to the
           submitted school_class. PATCH-safe: falls back to the existing
           instance values for any field not included in the request.

        2. Model-level clean() — builds a temporary unsaved instance and
           calls full_clean() so Django's own constraints (unique_together,
           clean() hooks) fire BEFORE any DB write. Errors are re-raised as
           DRF ValidationError so the response shape stays consistent.

        FIX: tmp.pk is explicitly set to self.instance.pk so that Django's
        unique_together check knows to exclude this very row from the
        uniqueness scan (the previous code set pk via the attname loop which
        should have worked, but being explicit removes all ambiguity and
        makes the intent clear to future readers).
        """
        # PATCH safety: use current instance values for omitted fields
        student      = data.get("student")      or (self.instance and self.instance.student)
        school_class = data.get("school_class") or (self.instance and self.instance.school_class)

        # 1 — Enrollment check
        if student and school_class and not self._is_enrolled(student, school_class):
            raise serializers.ValidationError(
                {"student": "This student is not enrolled in the selected class."}
            )

        # 2 — Django model validation (clean, unique_together, etc.)
        if self.instance:
            # PATCH: overlay changed fields onto a copy of the live instance
            # so we don't mutate the cached instance before the save.
            tmp = Attendance(**{
                f.attname: getattr(self.instance, f.attname)
                for f in Attendance._meta.concrete_fields
            })
            for attr, val in data.items():
                setattr(tmp, attr, val)
        else:
            tmp = Attendance(**data)

        # FIX: set pk explicitly so Django excludes this row from
        # unique_together checks — prevents "already exists" false positives
        # on PATCH requests and on POST when term/year are stamped by
        # perform_create after validation.
        tmp.pk = self.instance.pk if self.instance else None

        try:
            tmp.full_clean(exclude=["id"] if tmp.pk is None else [])
        except Exception as exc:
            logger.error(
                "AttendanceSerializer.validate full_clean failed: %s",
                getattr(exc, "message_dict", str(exc)),
            )
            raise serializers.ValidationError(
                getattr(exc, "message_dict", str(exc))
            ) from exc

        return data

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _is_enrolled(student, school_class) -> bool:
        """
        Return True when the student belongs to school_class.

        Handles the two common relationships:

          Case A — ForeignKey:   Student.school_class  → SchoolClass
          Case B — ManyToMany:   Student.school_classes → SchoolClass
        """
        # Case A: direct FK
        if hasattr(student, "school_class_id"):
            return student.school_class_id == school_class.pk

        # Case B: M2M
        if hasattr(student, "school_classes"):
            return student.school_classes.filter(pk=school_class.pk).exists()

        logger.warning(
            "AttendanceSerializer._is_enrolled: could not determine enrollment "
            "relationship for student pk=%s. Falling back to DB constraints.",
            student.pk,
        )
        return True  # let DB constraints be the last line of defence
