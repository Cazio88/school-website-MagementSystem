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

    def list(self, request, *args, **kwargs):
        """Return queryset; if year-filtered query is empty, fall back to latest matching record for the term.

        This helps the student portal find a saved assessment when the teacher used a different `year` value.
        """
        params = request.query_params
        student = params.get("student")
        term = params.get("term")
        year = params.get("year")

        queryset = self.filter_queryset(self.get_queryset())
        results = list(queryset)
        if results:
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)

        # No results for provided year — attempt fallback to any year for the same student+term
        if student and term and year:
            qs_fallback = CharacterAssessment.objects.order_by("-year", "-created_at")
            if str(student).isdigit():
                qs_fallback = qs_fallback.filter(student_id=student, term=term)
            else:
                qs_fallback = qs_fallback.filter(student__admission_number__iexact=student, term=term)
            first = qs_fallback.first()
            if first:
                serializer = self.get_serializer(first)
                # Return single object inside a results array to match previous list format
                return Response({"results": [serializer.data]})

        # Default empty list
        return Response({"results": []})
