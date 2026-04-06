from rest_framework import serializers
from .models import Notification, PushSubscription


class PushSubscriptionSerializer(serializers.Serializer):
    endpoint = serializers.URLField(max_length=1000)
    keys = serializers.DictField(child=serializers.CharField())

    def validate_keys(self, value):
        if "p256dh" not in value or "auth" not in value:
            raise serializers.ValidationError("keys must contain 'p256dh' and 'auth'.")
        return value

    def create(self, validated_data):
        from apps.accounts.authentication import TeamAnonymousUser

        request = self.context["request"]
        user = request.user
        keys = validated_data["keys"]
        user_agent = request.META.get("HTTP_USER_AGENT", "")

        defaults = {
            "p256dh_key": keys["p256dh"],
            "auth_key": keys["auth"],
            "user_agent": user_agent,
        }

        if isinstance(user, TeamAnonymousUser):
            defaults["team_id"] = user.team_id
            defaults["user"] = None
        else:
            defaults["user"] = user
            defaults["team"] = None

        sub, _ = PushSubscription.objects.update_or_create(
            endpoint=validated_data["endpoint"],
            defaults=defaults,
        )
        return sub


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "type",
            "target",
            "title",
            "body",
            "link",
            "tournament_id",
            "match_id",
            "team_id",
            "is_read",
            "created_at",
        ]
        read_only_fields = fields
