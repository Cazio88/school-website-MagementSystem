from rest_framework import viewsets
from apps.teachers.models import Teacher
from api.serializers.teacher_serializer import TeacherSerializer


class TeacherViewSet(viewsets.ModelViewSet):

    queryset = Teacher.objects.all()
    serializer_class = TeacherSerializer