import re
import logging

from django.utils import timezone
from django.contrib.auth import get_user_model

from rest_framework.viewsets import ModelViewSet
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.admissions.models import Admission
from api.serializers.admission_serializer import AdmissionSerializer
from apps.students.models import Student
from apps.classes.models import SchoolClass

User = get_user_model()
logger = logging.getLogger(__name__)


class AdmissionViewSet(ModelViewSet):

    queryset         = Admission.objects.all().order_by("-application_date")
    serializer_class = AdmissionSerializer

    # Required so that multipart/form-data (file uploads) are parsed correctly
    # and the photo field is saved to MEDIA_ROOT.
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_context(self):
        """
        Pass request into serializer context so that ImageField returns
        a full absolute URL (e.g. http://127.0.0.1:8000/media/admissions/...)
        instead of a bare relative path.
        """
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    # ── Helpers ───────────────────────────────────────────────

    def _generate_student_id(self):
        """Return the next LSA-YYYY-NNNN admission number."""
        year = timezone.now().year
        existing = User.objects.filter(
            username__startswith=f"LSA-{year}-"
        ).values_list("username", flat=True)

        max_number = 0
        for username in existing:
            numbers = re.findall(r"\d+$", username)
            if numbers:
                max_number = max(max_number, int(numbers[-1]))

        return f"LSA-{year}-{str(max_number + 1).zfill(4)}"

    def _resolve_class(self, admission):
        """Return SchoolClass instance from the admission FK, or None."""
        if not admission.applied_class_id:
            return None
        try:
            return SchoolClass.objects.get(id=admission.applied_class_id)
        except SchoolClass.DoesNotExist:
            return None

    # ── Write hooks ───────────────────────────────────────────

    def perform_update(self, serializer):
        admission = serializer.save()
        logger.info(f"Admission updated: id={admission.id} status={admission.status}")

        if admission.status != "approved":
            return

        # Idempotency: skip if student already exists for this email
        if Student.objects.filter(user__email=admission.email).exists():
            logger.info(f"Student already exists for email={admission.email}, skipping.")
            return

        try:
            student_id   = self._generate_student_id()
            school_class = self._resolve_class(admission)

            # Prefer split first/last from the model; fall back to student_name
            first_name = admission.first_name or admission.student_name.split(" ", 1)[0]
            last_name  = (
                admission.last_name
                or (admission.student_name.split(" ", 1)[1]
                    if " " in admission.student_name else "")
            )

            # Create the user account
            user = User.objects.create_user(
                username=student_id,
                email=admission.email,
                password="student123",
                first_name=first_name,
                last_name=last_name,
                role="student",          # set role so login works immediately
            )

            # Copy photo from admission to student if one was uploaded
            photo = admission.photo if admission.photo else None

            # Create the Student profile
            student = Student.objects.create(
                user=user,
                admission_number=student_id,
                student_name=f"{first_name} {last_name}".strip(),
                parent_name=admission.parent_name,
                date_of_birth=admission.date_of_birth,
                address=admission.address,
                school_class=school_class,
                photo=photo,
            )

            # Write the generated ID back onto the admission record
            admission.admission_number = student_id
            admission.save(update_fields=["admission_number"])

            logger.info(
                f"Student created: {student.student_name} "
                f"id={student_id} class={school_class}"
            )

        except Exception as exc:
            logger.error(f"Student creation failed for admission id={admission.id}: {exc}")
            raise