from rest_framework import serializers
from apps.students.models import Student


class StudentSerializer(serializers.ModelSerializer):

    username = serializers.CharField(
        source="user.username",
        read_only=True
    )

    student_name = serializers.SerializerMethodField()

    email = serializers.EmailField(
        source="user.email",
        read_only=True
    )

    class_name = serializers.CharField(
        source="school_class.name",
        read_only=True
    )

    class Meta:
        model = Student
        fields = [
            "id",
            "username",
            "student_name",
            "email",
            "admission_number",
            "parent_name",
            "date_of_birth",
            "address",
            "photo",
            "school_class",
            "class_name",
            "admission_date",
        ]

    def get_student_name(self, obj):
        return obj.full_name