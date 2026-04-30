# apps/attendance/views.py
from django.conf import settings
from rest_framework import viewsets, filters
from rest_framework.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, DateFilter, CharFilter

from apps.attendance.models import Attendance
from api.serializers.attendance_serializer import AttendanceSerializer


# ---------------------------------------------------------------------------
# Filter
# ---------------------------------------------------------------------------
class AttendanceFilter(FilterSet):
    """
    Enables filtering via query params:
      ?date=2025-04-01
      ?school_class=3
      ?student=7
      ?term=term3
    """
    date         = DateFilter(field_name="date")
    school_class = CharFilter(field_name="school_class__id")
    student      = CharFilter(field_name="student__id")
    term         = CharFilter(field_name="term")

    class Meta:
        model  = Attendance
        fields = ["date", "school_class", "student", "term"]


# ---------------------------------------------------------------------------
# ViewSet
# ---------------------------------------------------------------------------
class AttendanceViewSet(viewsets.ModelViewSet):
    """
    CRUD endpoint for Attendance records.

    Fixes applied
    -------------
    BUG 1 — Wrong term on save: perform_create now injects CURRENT_TERM from
            settings so attendance always lands on the active term regardless
            of what the client sends. Set CURRENT_TERM = "term3" in
            settings.py (or settings/base.py) to control this centrally.

    BUG 2 — Double-save + late full_clean: the original pattern called
            serializer.save() (DB write #1), then full_clean() (validation
            AFTER the write — too late to block bad data), then instance.save()
            again (DB write #2 for no reason). Fixed by validating inside the
            serializer and calling serializer.save() exactly once.

    BUG 3 — Hyperlink artifacts: [serializer.save](http://...) and
            [instance.save](http://...) are corrupted method calls from a
            rich-text copy-paste. Cleaned throughout.

    BUG 4 — No filtering: the original viewset returned every attendance
            record in the database. AttendanceFilter wires up the ?date=,
            ?school_class=, ?student=, and ?term= params the frontend sends.

    BUG 5 — Unbounded queryset: global pagination in settings
            (PAGE_SIZE=100, max=500) is now respected. Do not pass
            page_size=2000 from the frontend summary tab.

    Improvements
    ------------
    - select_related on student + school_class avoids N+1 queries.
    - ordering_fields lets the client sort by date or student name.
    - CURRENT_TERM / CURRENT_YEAR are read from settings so there is one
      place to flip the term at the start of each school term.
    """

    serializer_class = AttendanceSerializer
    filterset_class  = AttendanceFilter
    filter_backends  = [DjangoFilterBackend, filters.OrderingFilter]
    ordering_fields  = ["date", "student"]
    ordering         = ["-date"]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _current_term():
        """Return the active term string from settings, e.g. 'term3'."""
        return getattr(settings, "CURRENT_TERM", "term3")

    @staticmethod
    def _current_year():
        """Return the active academic year integer from settings."""
        return getattr(settings, "CURRENT_YEAR", 2025)

    # ------------------------------------------------------------------
    # Queryset
    # ------------------------------------------------------------------
    def get_queryset(self):
        # select_related prevents an extra DB hit per row for student/class name.
        return (
            Attendance.objects
            .select_related("student", "school_class")
            .all()
        )

    # ------------------------------------------------------------------
    # Writes — inject current term/year; validate BEFORE saving
    # ------------------------------------------------------------------
    def perform_create(self, serializer):
        """
        Save a new Attendance record, always stamping the current term/year
        from settings so records can never land on the wrong term.

        Validation runs inside the serializer (validate() / validate_<field>)
        BEFORE the DB write — not after.
        """
        serializer.save(
            term=self._current_term(),
            year=self._current_year(),
        )

    def perform_update(self, serializer):
        """
        Update an existing Attendance record.

        We deliberately do NOT override term/year on updates so that
        historical records edited later keep their original term.
        If you want to lock term/year on update too, add them here.
        """
        serializer.save()
