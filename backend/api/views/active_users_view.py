# api/views/active_users_view.py
from datetime import timedelta

from django.utils.timezone import now
from django.contrib.auth import get_user_model
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework import serializers

User = get_user_model()

# How long before a user is considered "offline"
ONLINE_THRESHOLD_MINUTES = 5


class ActiveUserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "role", "last_login", "is_online"]

    def get_role(self, obj):
        # Adapt this to however your project stores roles
        if obj.is_superuser or obj.is_staff:
            return "admin"
        role = getattr(obj, "role", None)
        if role:
            return str(role)
        return "user"

    def get_is_online(self, obj):
        if not obj.last_login:
            return False
        threshold = now() - timedelta(minutes=ONLINE_THRESHOLD_MINUTES)
        return obj.last_login >= threshold


class ActiveUsersView(APIView):
    """
    GET /api/auth/active-users/

    Returns all users who have been active within the last 5 minutes.
    Admin-only endpoint.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        threshold = now() - timedelta(minutes=ONLINE_THRESHOLD_MINUTES)
        active_users = (
            User.objects.filter(last_login__gte=threshold)
            .exclude(pk=request.user.pk)   # optionally exclude self
            .order_by("-last_login")
        )

        # Also include the current admin user at the top
        current_user = User.objects.filter(pk=request.user.pk).first()
        queryset = list(active_users)
        if current_user:
            queryset = [current_user] + queryset

        serializer = ActiveUserSerializer(queryset, many=True)
        return Response({
            "count": len(queryset),
            "results": serializer.data,
        })
