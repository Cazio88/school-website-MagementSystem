from rest_framework.viewsets import ModelViewSet
from apps.students.models import Student
from api.serializers.student_serializer import StudentSerializer


class StudentViewSet(ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        school_class = self.request.query_params.get("school_class")
        admission_number = self.request.query_params.get("admission_number")
        if school_class:
            queryset = queryset.filter(school_class_id=school_class)
        if admission_number:
            queryset = queryset.filter(admission_number__iexact=admission_number)
        return queryset