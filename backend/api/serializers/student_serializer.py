from rest_framework import serializers
from apps.students.models import Student


class StudentSerializer(serializers.ModelSerializer):

    username     = serializers.CharField(source="user.username", read_only=True)
    student_name = serializers.SerializerMethodField()
    email        = serializers.EmailField(source="user.email", read_only=True)
    class_name   = serializers.CharField(source="school_class.name", read_only=True)

    # Returns full Cloudinary URL; also accepts file upload on PUT
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model  = Student
        fields = [
            "id", "username", "student_name", "email",
            "admission_number", "parent_name", "date_of_birth",
            "address", "photo", "photo_url", "school_class", "class_name", "admission_date",
        ]
        extra_kwargs = {
            "photo": {"required": False},
        }

    def get_student_name(self, obj):
        return obj.full_name

    def get_photo_url(self, obj):
        if not obj.photo:
            return None
        try:
            return obj.photo.url
        except Exception:
            return None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Replace raw photo field with the full URL for frontend consumption
        data["photo"] = self.get_photo_url(instance)
        return data