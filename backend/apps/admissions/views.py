import re
import logging
from rest_framework.viewsets import ModelViewSet
from apps.admissions.models import Admission
from api.serializers.admission_serializer import AdmissionSerializer
from apps.students.models import Student
from apps.classes.models import SchoolClass
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()
logger = logging.getLogger(__name__)


class AdmissionViewSet(ModelViewSet):

    queryset = Admission.objects.all().order_by("-application_date")
    serializer_class = AdmissionSerializer

    def generate_student_id(self):
        year = timezone.now().year

        # Use highest existing username to avoid UNIQUE constraint errors
        existing = User.objects.filter(
            username__startswith=f"LSA-{year}-"
        ).values_list("username", flat=True)

        max_number = 0
        for username in existing:
            numbers = re.findall(r"\d+", username)
            if numbers:
                max_number = max(max_number, int(numbers[-1]))

        new_number = max_number + 1
        return f"LSA-{year}-{str(new_number).zfill(4)}"

    def perform_update(self, serializer):

        admission = serializer.save()
        logger.info(f"Admission updated: {admission.status}")

        if admission.status != "approved":
            return

        # Check if student already exists by email
        if Student.objects.filter(user__email=admission.email).exists():
            logger.info(f"Student already exists for {admission.email}")
            return

        try:
            student_id = self.generate_student_id()
            logger.info(f"Generating student ID: {student_id}")

            # Split name into first/last so user.get_full_name() works
            name_parts = admission.student_name.strip().split(" ", 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ""

            # Create user
            user = User.objects.create_user(
                username=student_id,
                email=admission.email,
                password="student123",
                first_name=first_name,
                last_name=last_name,
            )

            # Resolve school class by ID
            school_class = None
            if admission.applied_class:
                try:
                    school_class = SchoolClass.objects.get(id=int(admission.applied_class))
                except (SchoolClass.DoesNotExist, ValueError, TypeError):
                    school_class = SchoolClass.objects.filter(
                        name=admission.applied_class
                    ).first()
            logger.info(f"Class resolved: {school_class}")

            # Get photo safely
            photo = getattr(admission, "photo", None) or None

            # Create student
            student = Student.objects.create(
                user=user,
                admission_number=student_id,
                parent_name=admission.parent_name,
                date_of_birth=admission.date_of_birth,
                address=admission.address,
                school_class=school_class,
                photo=photo,
            )

            # Save admission number back
            admission.admission_number = student_id
            admission.save()

            logger.info(f"Student created: {student.full_name} -> {student_id}")

        except Exception as e:
            logger.error(f"Student creation error: {e}")
            raise