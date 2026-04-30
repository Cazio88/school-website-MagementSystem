# api/serializers/attendance_serializer.py
from rest_framework import serializers
from apps.attendance.models import Attendance


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
        # FIX: term must NOT be read_only.
        #
        # The previous serializer marked term as read_only because the old
        # model derived term from the calendar month inside save() — so client
        # input was silently ignored regardless. That derivation has been
        # removed (it was the root cause of the wrong-term bug).
        #
        # Term and year are now stamped by perform_create in the viewset using
        # settings.CURRENT_TERM / CURRENT_YEAR. They must be writable so that
        # stamp actually reaches the database. They are also kept writable for
        # admin commands that need to set them explicitly (e.g. historical
        # data imports).
        read_only_fields = ["id", "student_name"]

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
        from django.utils import timezone
        if value > timezone.localdate():
            raise serializers.ValidationError(
                "Attendance cannot be recorded for a future date."
            )
        return value

    def validate_term(self, value):
        """Ensure the submitted term is one of the known choices."""
        valid = {choice[0] for choice in Attendance.Term.choices}
        if value not in valid:
            raise serializers.ValidationError(
                f"'{value}' is not a valid term. "
                f"Expected one of: {', '.join(sorted(valid))}."
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
            # PATCH: overlay changed fields onto the live instance
            tmp = self.instance
            for attr, val in data.items():
                setattr(tmp, attr, val)
        else:
            tmp = Attendance(**data)

        try:
            tmp.full_clean(exclude=["id"])
        except Exception as exc:
            raise serializers.ValidationError(exc.message_dict) from exc

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

        Adjust the attribute names if your Student model differs.
        If the relationship cannot be determined, returns True so the
        DB constraint is the last line of defence rather than silently
        blocking valid records.
        """
        # Case A: direct FK
        if hasattr(student, "school_class_id"):
            return student.school_class_id == school_class.pk

        # Case B: M2M
        if hasattr(student, "school_classes"):
            return student.school_classes.filter(pk=school_class.pk).exists()

        return True  # unknown relationship — let DB constraints decide
