# api/serializers/attendance_serializer.py
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
            # IMPROVEMENT: notes was defined on the model but missing here,
            # making it impossible to set or read via the API.
            "notes",
        ]
        # BUG FIX: term is derived from date inside model.clean() / save().
        # Making it read-only prevents clients from sending a term that
        # disagrees with the date, which would be silently overwritten anyway.
        read_only_fields = ["term"]

    def get_student_name(self, obj):
        return str(obj.student)

    def validate(self, data):
        # Pull values from incoming data, falling back to the existing instance
        # so that PATCH requests (partial updates) work correctly.
        student = data.get("student") or (self.instance and self.instance.student)
        school_class = data.get("school_class") or (self.instance and self.instance.school_class)

        # BUG FIX: Without this check the API happily creates an attendance
        # record linking a student to a class they're not enrolled in.
        # Adjust the related-name / field lookup to match your Student model.
        if student and school_class:
            # Assumes Student has a ManyToMany or FK relationship to SchoolClass
            # via a related name of "school_classes". Adjust as needed:
            #   FK:  student.school_class_id == school_class.pk
            #   M2M: student.school_classes.filter(pk=school_class.pk).exists()
            enrolled = (
                hasattr(student, "school_classes")
                and student.school_classes.filter(pk=school_class.pk).exists()
            ) or (
                hasattr(student, "school_class_id")
                and student.school_class_id == school_class.pk
            )
            if not enrolled:
                raise serializers.ValidationError(
                    {"student": "This student is not enrolled in the selected class."}
                )

        return data
