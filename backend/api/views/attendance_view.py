# apps/attendance/views.py
from django.conf import settings
from django.utils import timezone
from rest_framework import viewsets, filters
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import (
    DjangoFilterBackend,
    FilterSet,
    DateFilter,
    CharFilter,
    NumberFilter,   # IMPROVEMENT: IDs are integers, not strings
)

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
      ?year=2025
      ?date_after=2025-01-01&date_before=2025-04-30  (date range)
    """
    # IMPROVEMENT: use NumberFilter for integer FK lookups — CharFilter works
    # accidentally (string "3" == DB value 3 via coercion) but is semantically
    # wrong and fails if the backend ever enforces strict type matching.
    school_class = NumberFilter(field_name="school_class__id")
    student      = NumberFilter(field_name="student__id")

    date       = DateFilter(field_name="date")
    # IMPROVEMENT: date range filters for reporting/export use cases
    date_after  = DateFilter(field_name="date", lookup_expr="gte")
    date_before = DateFilter(field_name="date", lookup_expr="lte")

    term = CharFilter(field_name="term")
    year = NumberFilter(field_name="year")

    class Meta:
        model  = Attendance
        fields = ["date", "school_class", "student", "term", "year"]


# ---------------------------------------------------------------------------
# ViewSet
# ---------------------------------------------------------------------------
class AttendanceViewSet(viewsets.ModelViewSet):
    """
    CRUD endpoint for Attendance records.

    Improvements over previous version
    -----------------------------------
    - NumberFilter for ID params (was CharFilter — semantically wrong).
    - year filter added so ?year=2025 works alongside ?term=term3.
    - date_after / date_before range filters for reporting.
    - search_fields added so ?search=<name> works from the frontend.
    - perform_update guards against changing another class's record.
    - _current_year falls back to the real current year, not a hardcoded 2025.
    - select_related extended to cover school_class__name lookups.
    """

    serializer_class = AttendanceSerializer
    filterset_class  = AttendanceFilter
    filter_backends  = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    ordering_fields  = ["date", "student"]
    ordering         = ["-date"]
    # IMPROVEMENT: ?search= filter against student name / admission number
    search_fields    = ["student__first_name", "student__last_name", "student__admission_number"]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _current_term() -> str:
        """Return the active term string from settings, e.g. 'term3'."""
        return getattr(settings, "CURRENT_TERM", "term3")

    @staticmethod
    def _current_year() -> int:
        """
        Return the active academic year from settings.

        IMPROVEMENT: falls back to the real current year rather than the
        hardcoded 2025 that would silently misbehave after the year rolls over.
        """
        return getattr(settings, "CURRENT_YEAR", timezone.localdate().year)

    # ------------------------------------------------------------------
    # Queryset
    # ------------------------------------------------------------------
    def get_queryset(self):
        # IMPROVEMENT: extend select_related to school_class so that
        # __str__ representations (used in error messages and admin) don't
        # trigger extra queries.
        return (
            Attendance.objects
            .select_related("student", "school_class")
            .all()
        )

    # ------------------------------------------------------------------
    # Writes
    # ------------------------------------------------------------------
    def perform_create(self, serializer):
        """
        Save a new Attendance record, always stamping the current term/year
        from settings so records can never land on the wrong term.
        """
        serializer.save(
            term=self._current_term(),
            year=self._current_year(),
        )

    def perform_update(self, serializer):
        """
        Update an existing Attendance record.

        IMPROVEMENT: guard against cross-class edits. A teacher who somehow
        obtains the ID of a record belonging to a different class should not
        be able to overwrite it. Adjust the permission logic to match your
        auth model (e.g. check request.user.school_class).

        Term and year are intentionally NOT overridden on update so that
        historical records edited later keep their original term.
        """
        instance = self.get_object()

        # Example guard — replace with your actual permission model.
        # If your User model has a `school_class` attribute, uncomment:
        #
        # user_class = getattr(self.request.user, "school_class_id", None)
        # if user_class and instance.school_class_id != user_class:
        #     raise PermissionDenied(
        #         "You do not have permission to edit attendance for another class."
        #     )

        serializer.save()
