from rest_framework import status
from rest_framework.decorators import action
from rest_framework.mixins import ListModelMixin
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(ListModelMixin, GenericViewSet):
    """List and manage notifications for the authenticated user."""

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Notification.objects.all()
        # Filter by target: admin sees admin+all, coach sees coach+all
        if hasattr(user, "role") and user.role == "coach":
            qs = qs.filter(target__in=["coach", "all"])
        else:
            qs = qs.filter(target__in=["admin", "all"])
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
        qs = self.get_queryset().filter(is_read=False)
        count = qs.update(is_read=True)
        return Response({"marked_read": count})

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        """Get count of unread notifications."""
        count = self.get_queryset().filter(is_read=False).count()
        return Response({"count": count})
