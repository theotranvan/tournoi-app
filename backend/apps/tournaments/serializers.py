from rest_framework import serializers

from apps.tournaments.models import Category, Field, SchedulingConstraint, Tournament


class TournamentListSerializer(serializers.ModelSerializer):
    nb_categories = serializers.IntegerField(read_only=True)
    nb_teams = serializers.IntegerField(read_only=True)
    nb_matches = serializers.IntegerField(read_only=True)
    nb_fields = serializers.IntegerField(read_only=True)

    class Meta:
        model = Tournament
        fields = (
            "id",
            "club",
            "name",
            "slug",
            "location",
            "start_date",
            "end_date",
            "status",
            "is_public",
            "cover_image",
            "nb_categories",
            "nb_teams",
            "nb_matches",
            "nb_fields",
            "created_at",
        )
        read_only_fields = ("id", "slug", "status", "created_at")


class TournamentDetailSerializer(serializers.ModelSerializer):
    nb_categories = serializers.IntegerField(read_only=True)
    nb_teams = serializers.IntegerField(read_only=True)
    nb_matches = serializers.IntegerField(read_only=True)
    nb_fields = serializers.IntegerField(read_only=True)

    class Meta:
        model = Tournament
        fields = (
            "id",
            "club",
            "name",
            "slug",
            "location",
            "start_date",
            "end_date",
            "description",
            "rules",
            "cover_image",
            "status",
            "is_public",
            "default_match_duration",
            "default_transition_time",
            "default_rest_time",
            "nb_categories",
            "nb_teams",
            "nb_matches",
            "nb_fields",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "slug", "status", "created_at", "updated_at")


class TournamentCreateSerializer(serializers.ModelSerializer):
    club = serializers.PrimaryKeyRelatedField(required=False, queryset=Tournament.club.field.related_model.objects.all())

    class Meta:
        model = Tournament
        fields = (
            "id",
            "club",
            "name",
            "slug",
            "location",
            "start_date",
            "end_date",
            "description",
            "rules",
            "cover_image",
            "status",
            "is_public",
            "default_match_duration",
            "default_transition_time",
            "default_rest_time",
        )
        read_only_fields = ("id", "slug", "status")

    def validate(self, data):
        if data.get("end_date") and data.get("start_date"):
            if data["end_date"] < data["start_date"]:
                raise serializers.ValidationError(
                    {"end_date": "La date de fin doit être postérieure à la date de début."}
                )
        return data


class CategorySerializer(serializers.ModelSerializer):
    effective_match_duration = serializers.IntegerField(read_only=True)
    effective_transition_time = serializers.IntegerField(read_only=True)
    effective_rest_time = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = (
            "id",
            "tournament",
            "name",
            "display_order",
            "color",
            "match_duration",
            "transition_time",
            "rest_time",
            "players_per_team",
            "points_win",
            "points_draw",
            "points_loss",
            "allowed_days",
            "earliest_start",
            "latest_end",
            "effective_match_duration",
            "effective_transition_time",
            "effective_rest_time",
        )
        read_only_fields = ("id", "tournament")


class BulkCategorySerializer(serializers.Serializer):
    categories = serializers.ListField(
        child=serializers.DictField(), min_length=1, max_length=20
    )


class FieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = Field
        fields = (
            "id",
            "tournament",
            "name",
            "display_order",
            "is_active",
            "availability",
        )
        read_only_fields = ("id", "tournament")


class SchedulingConstraintSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchedulingConstraint
        fields = (
            "id",
            "tournament",
            "name",
            "constraint_type",
            "payload",
            "is_hard",
            "created_at",
        )
        read_only_fields = ("id", "tournament", "created_at")
