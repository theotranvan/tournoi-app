from django.db import models
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.clubs.models import Club
from apps.clubs.serializers import ClubSerializer
from apps.core.permissions import IsClubOwnerOrMember, IsOrganizer


class ClubViewSet(viewsets.ModelViewSet):
    serializer_class = ClubSerializer
    permission_classes = [IsAuthenticated, IsOrganizer]

    def get_queryset(self):
        user = self.request.user
        return Club.objects.filter(
            models.Q(owner=user) | models.Q(members=user)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def get_permissions(self):
        if self.action in ("update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsClubOwnerOrMember()]
        return super().get_permissions()
