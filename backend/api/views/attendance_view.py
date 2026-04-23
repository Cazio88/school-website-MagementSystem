# apps/attendance/views.py
from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, DateFilter, CharFilter
from apps.attendance.models import Attendance
from api.serializers.attendance_serializer import AttendanceSerializer


class AttendanceFilter(FilterSet):
    """
    Enables filtering via query params:
      ?date=2025-04-01
      ?school_class=3
      ?student=7
      ?term=term2
    """
    date         = DateFilter(field_name="date")
    school_class = CharFilter(field_name="school_class__id")
    student      = CharFilter(field_name="student__id")
    term         = CharFilter(field_name="term")

    class Meta:
        model  = Attendance
        fields = ["date", "school_class", "student", "term"]


class AttendanceViewSet(viewsets.ModelViewSet):
    """
    CRUD endpoint for Attendance records.

    Fixes applied
    -------------
    BUG 1 — No filtering: the original viewset returned every attendance record
            in the database regardless of query params. AttendanceFilter wires
            up the ?date=, ?school_class=, ?student=, and ?term= params the
            frontend already sends.

    BUG 2 — Unbounded queryset / page_size=2000: global pagination in settings
            (PAGE_SIZE=100, max=500) is now enforced. The summary tab in the
            frontend is updated to paginate instead of requesting 2000 rows.

    BUG 3 — No authentication or permission check: the global
            DEFAULT_PERMISSION_CLASSES = [IsAuthenticated] in settings covers
            this viewset automatically. Any per-endpoint override goes here.

    Improvements
    ------------
    - select_related on student + school_class avoids N+1 queries when the
      serializer calls str(obj.student) for every row.
    - perform_create / perform_update call full_clean() explicitly at the API
      boundary (the model's save() no longer does this).
    - ordering_fields lets the client sort by date or student name.
    """

    serializer_class = AttendanceSerializer
    filterset_class  = AttendanceFilter
    filter_backends  = [DjangoFilterBackend, filters.OrderingFilter]
    ordering_fields  = ["date", "student"]
    ordering         = ["-date"]

    def get_queryset(self):
        # select_related prevents an extra DB hit per row for student/class name.
        return (
            Attendance.objects
            .select_related("student", "school_class")
            .all()
        )

    def perform_create(self, serializer):
        instance = serializer.save()
        # BUG FIX: full_clean() was removed from model.save() because it runs
        # twice in normal DRF flows and breaks bulk operations. We call it here
        # explicitly so cross-field validation (future-date check, term derivation
        # via clean()) still fires on every API write.
        instance.full_clean()
        instance.save()

    def perform_update(self, serializer):
        instance = serializer.save()
        instance.full_clean()
        instance.save()
