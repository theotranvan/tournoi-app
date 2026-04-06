from rest_framework import serializers

from apps.teams.models import Group, Team


class TeamSerializer(serializers.ModelSerializer):
    """Team serializer for nested tournament routes — hides access_code."""

    class Meta:
        model = Team
        fields = (
            "id",
            "tournament",
            "category",
            "name",
            "short_name",
            "logo",
            "coach_name",
            "coach_phone",
            "coach_email",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "tournament", "created_at", "updated_at")


class TeamAdminSerializer(serializers.ModelSerializer):
    """Team serializer for admin routes — includes access_code + qr_code_url."""

    qr_code_url = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = (
            "id",
            "tournament",
            "category",
            "name",
            "short_name",
            "logo",
            "coach_name",
            "coach_phone",
            "coach_email",
            "access_code",
            "qr_code_url",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "tournament", "access_code", "created_at", "updated_at")

    def get_qr_code_url(self, obj):
        request = self.context.get("request")
        if request is None:
            return None
        tournament_id = obj.tournament_id
        return request.build_absolute_uri(
            f"/api/v1/tournaments/{tournament_id}/teams/{obj.pk}/qr-code/"
        )


class TeamBriefSerializer(serializers.ModelSerializer):
    """Compact representation for team-access endpoint and public views."""

    category = serializers.SerializerMethodField()
    tournament = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = ("id", "name", "short_name", "logo", "category", "tournament")

    def get_category(self, obj):
        return {"id": obj.category_id, "name": obj.category.name}

    def get_tournament(self, obj):
        return {
            "id": str(obj.tournament_id),
            "name": obj.tournament.name,
            "slug": obj.tournament.slug,
        }


class GroupSerializer(serializers.ModelSerializer):
    team_ids = serializers.PrimaryKeyRelatedField(
        source="teams",
        queryset=Team.objects.all(),
        many=True,
        required=False,
    )

    class Meta:
        model = Group
        fields = ("id", "category", "name", "display_order", "team_ids")
        read_only_fields = ("id", "category")


class GroupDetailSerializer(serializers.ModelSerializer):
    teams = TeamBriefSerializer(many=True, read_only=True)

    class Meta:
        model = Group
        fields = ("id", "category", "name", "display_order", "teams")
        read_only_fields = ("id", "category")


class GenerateGroupsSerializer(serializers.Serializer):
    num_groups = serializers.IntegerField(min_value=1, max_value=20)
    strategy = serializers.ChoiceField(
        choices=["balanced"], default="balanced"
    )
