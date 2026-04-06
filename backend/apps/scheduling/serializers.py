"""Serializers for scheduling API endpoints."""

from __future__ import annotations

from rest_framework import serializers

from apps.scheduling.types import Strategy


class GenerateScheduleSerializer(serializers.Serializer):
    strategy = serializers.ChoiceField(
        choices=[(s.value, s.value) for s in Strategy],
        default=Strategy.BALANCED.value,
    )
    async_mode = serializers.BooleanField(default=False)


class RecalculateSerializer(serializers.Serializer):
    match_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
    )
