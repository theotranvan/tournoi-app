from rest_framework import status
from rest_framework.decorators import action
from rest_framework.mixins import ListModelMixin
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from django.conf import settings
from django.db.models import Q

from .models import Notification, PushSubscription
from .serializers import NotificationSerializer, PushSubscriptionSerializer


class NotificationViewSet(ListModelMixin, GenericViewSet):
    """List and manage notifications for the authenticated user."""

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None  # notifications are displayed in a dropdown

    def get_queryset(self):
        qs = self._base_queryset()
        # Only slice for list action; detail actions need filterable queryset
        if self.action == "list":
            return qs[:50]
        return qs

    def _base_queryset(self):
        """Unsliced queryset for actions that need .update() or .count()."""
        user = self.request.user
        qs = Notification.objects.all()
        # Filter by target: admin sees admin+all, coach sees coach+all
        if hasattr(user, "role") and user.role == "coach":
            qs = qs.filter(target__in=["coach", "all"])
        else:
            qs = qs.filter(target__in=["admin", "all"])
        # Scope to tournaments the user has access to (via club ownership or membership)
        qs = qs.filter(
            Q(tournament__club__owner=user)
            | Q(tournament__club__members=user)
            | Q(tournament__isnull=True)
        ).distinct()
        # Optional tournament filter
        tournament_id = self.request.query_params.get("tournament")
        if tournament_id:
            qs = qs.filter(tournament_id=tournament_id)
        return qs

    @action(detail=True, methods=["patch"])
    def read(self, request, pk=None):
        """Mark a notification as read."""
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=["is_read"])
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=["post"])
    def read_all(self, request):
        """Mark all notifications as read."""
        qs = self._base_queryset().filter(is_read=False)
        count = qs.update(is_read=True)
        return Response({"marked_read": count})

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        """Get count of unread notifications."""
        count = self._base_queryset().filter(is_read=False).count()
        return Response({"count": count})


class VapidPublicKeyView(APIView):
    """Return the VAPID public key for push subscription."""

    permission_classes = [AllowAny]

    def get(self, request):
        key = getattr(settings, "VAPID_PUBLIC_KEY", "")
        return Response({"key": key})


class PushSubscribeView(APIView):
    """Register a push subscription for the authenticated user."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PushSubscriptionSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"status": "subscribed"}, status=status.HTTP_201_CREATED)


class PushUnsubscribeView(APIView):
    """Remove push subscriptions for the authenticated user/team."""

    permission_classes = [IsAuthenticated]

    def delete(self, request):
        from apps.accounts.authentication import TeamAnonymousUser

        endpoint = request.data.get("endpoint")
        user = request.user

        if isinstance(user, TeamAnonymousUser):
            qs = PushSubscription.objects.filter(team_id=user.team_id)
        else:
            qs = PushSubscription.objects.filter(user=user)

        if endpoint:
            qs = qs.filter(endpoint=endpoint)
        count, _ = qs.delete()
        return Response({"deleted": count})
