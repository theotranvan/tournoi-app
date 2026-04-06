from rest_framework import serializers

from apps.accounts.serializers import UserSerializer
from apps.clubs.models import Club


class ClubSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    members = UserSerializer(many=True, read_only=True)

    class Meta:
        model = Club
        fields = (
            "id",
            "name",
            "slug",
            "logo",
            "website",
            "contact_email",
            "owner",
            "members",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "slug", "owner", "members", "created_at", "updated_at")
