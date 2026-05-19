from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from apps.results.models import CharacterAssessment
from api.serializers.character_assessment_serializer import CharacterAssessmentSerializer


class CharacterAssessmentViewSet(ModelViewSet):
    queryset = CharacterAssessment.objects.all().order_by("-created_at")
    serializer_class = CharacterAssessmentSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "student"

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        student = params.get("student")
        school_class = params.get("school_class")
        term = params.get("term")
        year = params.get("year")

        if student:
            # Accept either numeric PK or admission number string
            if str(student).isdigit():
                qs = qs.filter(student_id=student)
            else:
                qs = qs.filter(student__admission_number__iexact=student)
        if school_class:
            qs = qs.filter(school_class_id=school_class)
        if term:
            qs = qs.filter(term=term)
        if year:
            qs = qs.filter(year=year)

        return qs

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        lookup_value = self.kwargs.get(self.lookup_field)
        if lookup_value is None:
            raise NotFound("Missing student identifier")

        term = self.request.data.get("term") or self.request.query_params.get("term")
        year = self.request.data.get("year") or self.request.query_params.get("year")

        if not term or not year:
            raise ValidationError({"detail": "term and year are required to identify a character assessment"})

        # Allow lookup by numeric PK or admission number
        if str(lookup_value).isdigit():
            obj = get_object_or_404(queryset, student_id=lookup_value, term=term, year=year)
        else:
            obj = get_object_or_404(queryset, student__admission_number__iexact=lookup_value, term=term, year=year)
        self.check_object_permissions(self.request, obj)
        return obj
