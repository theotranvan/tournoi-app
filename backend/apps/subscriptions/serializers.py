from rest_framework import serializers

from .models import Subscription, TournamentLicense


class SubscriptionSerializer(serializers.ModelSerializer):
    is_premium = serializers.BooleanField(read_only=True)
    is_club = serializers.BooleanField(read_only=True)

    class Meta:
        model = Subscription
        fields = (
            "plan",
            "status",
            "is_premium",
            "is_club",
            "current_period_start",
            "current_period_end",
            "cancel_at_period_end",
        )
        read_only_fields = fields


class TournamentLicenseSerializer(serializers.ModelSerializer):
    is_valid = serializers.BooleanField(read_only=True)
    tournament_id = serializers.UUIDField(source="tournament.id", read_only=True)
    tournament_name = serializers.CharField(source="tournament.name", read_only=True)

    class Meta:
        model = TournamentLicense
        fields = (
            "id",
            "tournament_id",
            "tournament_name",
            "is_active",
            "is_valid",
            "valid_from",
            "valid_until",
            "created_at",
        )
        read_only_fields = fields
