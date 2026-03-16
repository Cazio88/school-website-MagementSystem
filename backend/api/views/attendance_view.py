from rest_framework import viewsets
from apps.attendance.models import Attendance
from api.serializers.attendance_serializer import AttendanceSerializer


class AttendanceViewSet(viewsets.ModelViewSet):

    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer