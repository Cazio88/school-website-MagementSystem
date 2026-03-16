# api/views/auth_view.py

import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status, viewsets, filters
from rest_framework.decorators import action

from django.contrib.auth import get_user_model, authenticate
from rest_framework_simplejwt.tokens import RefreshToken

from apps.students.models import Student
from apps.teachers.models import Teacher

User = get_user_model()
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Permission helper
# ─────────────────────────────────────────────

class IsAdminRole(IsAuthenticated):
    """Only allow users with role='admin'."""
    def has_permission(self, request, view):
        return (
            super().has_permission(request, view)
            and request.user.role == "admin"
        )


# ─────────────────────────────────────────────
# Auth views
# ─────────────────────────────────────────────

class LoginView(APIView):

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        if not username or not password:
            return Response(
                {"error": "Username and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Resolve admission number → username (students)
        # Resolve teacher_id       → username (teachers)
        if not User.objects.filter(username=username).exists():
            try:
                student  = Student.objects.get(admission_number__iexact=username)
                username = student.user.username
            except Student.DoesNotExist:
                pass

            try:
                teacher  = Teacher.objects.get(teacher_id__iexact=username)
                username = teacher.user.username
            except Teacher.DoesNotExist:
                pass

        user = authenticate(username=username, password=password)

        if user is None:
            return Response(
                {"error": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Admin-specific approval gate — check BEFORE is_active
        # (account is inactive while pending, so we need the friendly message first)
        if user.role == "admin" and not user.is_approved:
            return Response(
                {"error": "pending_approval",
                 "message": "Your admin account is awaiting approval by an existing administrator."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not user.is_active:
            return Response(
                {"error": "Account is disabled"},
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)

        # Build role-specific profile data
        profile = {}
        if user.role == "student":
            try:
                student = Student.objects.select_related("school_class").get(user=user)
                profile = {
                    "student_id":       student.id,
                    "admission_number": student.admission_number,
                    "full_name":        student.full_name,
                    "class":            student.school_class.name if student.school_class else None,
                    "class_id":         student.school_class.id   if student.school_class else None,
                    "photo":            student.photo.url         if student.photo         else None,
                }
            except Student.DoesNotExist:
                pass

        elif user.role == "teacher":
            try:
                teacher = Teacher.objects.select_related("school_class", "subject").get(user=user)
                profile = {
                    "teacher_id": teacher.teacher_id,
                    "class":      teacher.school_class.name if teacher.school_class else None,
                    "class_id":   teacher.school_class.id   if teacher.school_class else None,
                    "subject":    teacher.subject.name      if teacher.subject       else None,
                    "subject_id": teacher.subject.id        if teacher.subject       else None,
                }
            except Teacher.DoesNotExist:
                pass

        return Response({
            "access":  str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id":       user.id,
                "username": user.username,
                "email":    user.email,
                "role":     user.role,
                **profile,
            },
        }, status=status.HTTP_200_OK)


class RegisterView(APIView):
    """
    Admin self-registration.
    New accounts are created inactive and unapproved.
    An existing admin must approve them before they can log in.
    """

    def post(self, request):
        username = request.data.get("username")
        email    = request.data.get("email")
        password = request.data.get("password")

        if not username or not password:
            return Response(
                {"error": "Username and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(password) < 6:
            return Response(
                {"error": "Password must be at least 6 characters"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {"error": "Username already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if email and User.objects.filter(email=email).exists():
            return Response(
                {"error": "Email already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            role="admin",
            # Inactive + unapproved until an existing admin approves
            is_active=False,
            is_approved=False,
        )

        logger.info(f"New admin registration pending approval: {username}")

        return Response({
            "message": "Account created. An existing administrator must approve your account before you can log in.",
            "status":  "pending_approval",
            "user": {
                "id":       user.id,
                "username": user.username,
                "email":    user.email,
                "role":     user.role,
            },
        }, status=status.HTTP_201_CREATED)


class MeView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user    = request.user
        profile = {}

        if user.role == "student":
            try:
                student = Student.objects.select_related("school_class").get(user=user)
                profile = {
                    "student_id":       student.id,
                    "admission_number": student.admission_number,
                    "full_name":        student.full_name,
                    "class":            student.school_class.name if student.school_class else None,
                    "class_id":         student.school_class.id   if student.school_class else None,
                    "photo":            student.photo.url         if student.photo         else None,
                }
            except Student.DoesNotExist:
                pass

        elif user.role == "teacher":
            try:
                teacher = Teacher.objects.select_related("school_class", "subject").get(user=user)
                profile = {
                    "teacher_id": teacher.teacher_id,
                    "class":      teacher.school_class.name if teacher.school_class else None,
                    "class_id":   teacher.school_class.id   if teacher.school_class else None,
                    "subject":    teacher.subject.name      if teacher.subject       else None,
                    "subject_id": teacher.subject.id        if teacher.subject       else None,
                }
            except Teacher.DoesNotExist:
                pass

        return Response({
            "id":          user.id,
            "username":    user.username,
            "email":       user.email,
            "role":        user.role,
            "is_approved": user.is_approved,
            **profile,
        })


# ─────────────────────────────────────────────
# Admin approval management
# ─────────────────────────────────────────────

class AdminApprovalViewSet(viewsets.ViewSet):
    """
    Endpoints for managing pending admin account approvals.
    Only accessible by approved admins.

    GET  /api/admin-approvals/          → list pending admins
    GET  /api/admin-approvals/all/      → list all admins with status
    POST /api/admin-approvals/{id}/approve/ → approve
    POST /api/admin-approvals/{id}/reject/  → reject (delete account)
    """

    permission_classes = [IsAdminRole]

    def _serialize_user(self, user):
        return {
            "id":          user.id,
            "username":    user.username,
            "email":       user.email,
            "is_approved": user.is_approved,
            "is_active":   user.is_active,
            "date_joined": user.date_joined.isoformat(),
        }

    def list(self, request):
        """Return all pending (unapproved) admin accounts."""
        pending = User.objects.filter(role="admin", is_approved=False).order_by("date_joined")
        return Response([self._serialize_user(u) for u in pending])

    @action(detail=False, methods=["get"], url_path="all")
    def all_admins(self, request):
        """Return all admin accounts with their approval status."""
        admins = User.objects.filter(role="admin").exclude(id=request.user.id).order_by("-date_joined")
        return Response([self._serialize_user(u) for u in admins])

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        try:
            user = User.objects.get(pk=pk, role="admin")
        except User.DoesNotExist:
            return Response({"error": "Admin not found."}, status=status.HTTP_404_NOT_FOUND)

        if user == request.user:
            return Response({"error": "You cannot approve yourself."}, status=status.HTTP_400_BAD_REQUEST)

        user.is_approved = True
        user.is_active   = True
        user.save(update_fields=["is_approved", "is_active"])

        logger.info(f"Admin {user.username} approved by {request.user.username}")

        return Response({
            "message": f"{user.username} has been approved and can now log in.",
            "user":    self._serialize_user(user),
        })

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        try:
            user = User.objects.get(pk=pk, role="admin")
        except User.DoesNotExist:
            return Response({"error": "Admin not found."}, status=status.HTTP_404_NOT_FOUND)

        if user == request.user:
            return Response({"error": "You cannot reject yourself."}, status=status.HTTP_400_BAD_REQUEST)

        username = user.username
        user.delete()

        logger.info(f"Admin account {username} rejected and deleted by {request.user.username}")

        return Response({"message": f"{username}'s account has been rejected and removed."})