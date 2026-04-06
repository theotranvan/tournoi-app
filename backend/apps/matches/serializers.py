from rest_framework import serializers

from apps.matches.models import Goal, Match
from apps.teams.serializers import TeamBriefSerializer


class GoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Goal
        fields = ("id", "match", "team", "player_name", "minute", "created_at")
        read_only_fields = ("id", "match", "created_at")


class GoalInputSerializer(serializers.Serializer):
    team = serializers.ChoiceField(choices=["home", "away"])
    player_name = serializers.CharField(max_length=200, required=False, default="")
    minute = serializers.IntegerField(required=False, allow_null=True)


class MatchListSerializer(serializers.ModelSerializer):
    display_home = serializers.CharField(read_only=True)
    display_away = serializers.CharField(read_only=True)
    field_name = serializers.CharField(source="field.name", read_only=True, default=None)
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Match
        fields = (
            "id",
            "tournament",
            "category",
            "category_name",
            "group",
            "phase",
            "team_home",
            "team_away",
            "display_home",
            "display_away",
            "placeholder_home",
            "placeholder_away",
            "field",
            "field_name",
            "start_time",
            "duration_minutes",
            "status",
            "score_home",
            "score_away",
            "is_locked",
        )


class MatchDetailSerializer(serializers.ModelSerializer):
    team_home_detail = TeamBriefSerializer(source="team_home", read_only=True)
    team_away_detail = TeamBriefSerializer(source="team_away", read_only=True)
    goals = GoalSerializer(many=True, read_only=True)
    display_home = serializers.CharField(read_only=True)
    display_away = serializers.CharField(read_only=True)
    field_name = serializers.CharField(source="field.name", read_only=True, default=None)
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Match
        fields = (
            "id",
            "tournament",
            "category",
            "category_name",
            "group",
            "phase",
            "team_home",
            "team_away",
            "team_home_detail",
            "team_away_detail",
            "display_home",
            "display_away",
            "placeholder_home",
            "placeholder_away",
            "field",
            "field_name",
            "start_time",
            "duration_minutes",
            "status",
            "score_home",
            "score_away",
            "score_validated",
            "score_entered_by",
            "is_locked",
            "notes",
            "goals",
            "created_at",
            "updated_at",
        )


class MatchUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Match
        fields = ("field", "start_time", "duration_minutes", "notes")


class ScoreInputSerializer(serializers.Serializer):
    score_home = serializers.IntegerField(min_value=0)
    score_away = serializers.IntegerField(min_value=0)
    goals = GoalInputSerializer(many=True, required=False, default=[])
