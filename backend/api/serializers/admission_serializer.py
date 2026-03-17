from rest_framework import serializers
from cloudinary.models import CloudinaryField as CloudinaryModelField
from apps.admissions.models import Admission


class AdmissionSerializer(serializers.ModelSerializer):

    applied_class_name = serializers.CharField(
        source="applied_class.name", read_only=True, default=""
    )

    # Separate read and write for photo:
    # - 'photo' is the writable field (accepts file upload on POST)
    # - 'photo_url' is the readable field (returns the Cloudinary URL)
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model  = Admission
        fields = [
            "id", "admission_number", "application_date", "status",
            "first_name", "last_name", "student_name", "gender",
            "date_of_birth", "nationality", "religion",
            "photo",        # writable — accepts uploaded file
            "photo_url",    # readable — returns Cloudinary URL
            "applied_class", "applied_class_name",
            "previous_school", "health_notes",
            "parent_name", "parent_gender", "relationship",
            "email", "phone", "alt_phone", "address",
        ]
        read_only_fields = ["id", "admission_number", "application_date", "student_name"]
        extra_kwargs = {
            "photo": {"required": False},
        }

    def get_photo_url(self, obj):
        if not obj.photo:
            return None
        try:
            return obj.photo.url
        except Exception:
            return None