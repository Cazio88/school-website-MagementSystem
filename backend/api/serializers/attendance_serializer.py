from rest_framework import serializers
from apps.attendance.models import Attendance


class AttendanceSerializer(serializers.ModelSerializer):

    student_name = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = [
            "id",
            "student",
            "student_name",
            "school_class",
            "term",
            "date",
            "status",
        ]

    def get_student_name(self, obj):
        return str(obj.student)