from rest_framework import serializers
from apps.admissions.models import Admission


class AdmissionSerializer(serializers.ModelSerializer):

    # Human-readable class name for the table display
    applied_class_name = serializers.CharField(
        source="applied_class.name", read_only=True
    )

    class Meta:
        model  = Admission
        fields = [
            "id",
            "admission_number",
            "application_date",
            "status",

            # Student
            "first_name",
            "last_name",
            "student_name",       # auto-populated, read-only in practice
            "gender",
            "date_of_birth",
            "nationality",
            "religion",
            "photo",

            # Academic
            "applied_class",      # writable FK id
            "applied_class_name", # read-only label
            "previous_school",
            "health_notes",

            # Parent / Guardian
            "parent_name",
            "parent_gender",
            "relationship",
            "email",
            "phone",
            "alt_phone",
            "address",
        ]
        read_only_fields = ["id", "admission_number", "application_date", "student_name"]