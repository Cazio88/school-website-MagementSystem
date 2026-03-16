from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from .models import Student
from .serializers import StudentSerializer


class StudentViewSet(ModelViewSet):

    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated]

    queryset = Student.objects.select_related(
        "user",
        "school_class"
    ).all()

    def get_queryset(self):

        queryset = super().get_queryset()

        school_class = self.request.query_params.get("school_class")

        # Filter students by class if provided
        if school_class:
            try:
                queryset = queryset.filter(school_class_id=int(school_class))
            except ValueError:
                pass

        return queryset