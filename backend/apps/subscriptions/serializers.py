from rest_framework import serializers

from .models import Subscription


class SubscriptionSerializer(serializers.ModelSerializer):
    is_premium = serializers.BooleanField(read_only=True)

    class Meta:
        model = Subscription
        fields = (
            "plan",
            "status",
            "is_premium",
            "current_period_start",
            "current_period_end",
            "cancel_at_period_end",
        )
        read_only_fields = fields
