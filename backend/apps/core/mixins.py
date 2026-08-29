"""Reusable DRF view mixins for tenant-scoped access control."""


class TournamentScopedMixin:
    """Restrict a nested ViewSet to the URL's tournament, after an ownership check.

    Nested routes carry ``tournament_id`` (and sometimes ``category_id``) in the
    URL. Filtering a queryset by that id alone is *not* access control: the
    tournament UUID is exposed by the public API, so any authenticated organizer
    could otherwise read or mutate another organizer's resources by enumerating
    ids. This mixin verifies ownership/membership once via
    ``_get_tournament_for_nested`` and scopes every queryset to that tournament,
    which also covers ``get_object`` (retrieve/update/destroy and detail actions).

    Set ``tournament_lookup`` when the model reaches Tournament through a relation
    (e.g. ``"category__tournament"`` for groups).
    """

    #: ORM lookup from the scoped model to its Tournament.
    tournament_lookup = "tournament"

    def get_tournament(self):
        """Return the URL tournament, raising 404 if missing or 403 if not owned."""
        if not hasattr(self, "_scoped_tournament"):
            # Imported lazily to avoid an apps.core <-> apps.tournaments import cycle.
            from apps.tournaments.views import _get_tournament_for_nested

            self._scoped_tournament = _get_tournament_for_nested(self.kwargs, self.request.user)
        return self._scoped_tournament

    def get_queryset(self):
        return super().get_queryset().filter(**{self.tournament_lookup: self.get_tournament()})

    def get_serializer_context(self):
        """Expose the scoped tournament so serializers can scope their FK fields.

        Prevents cross-tenant FK injection via the request body: a serializer FK
        that defaults to an unfiltered queryset (e.g. Category.objects.all())
        would otherwise accept a primary key from another organizer's tournament.
        """
        context = super().get_serializer_context()
        if self.kwargs.get("tournament_id"):
            context["tournament"] = self.get_tournament()
        return context
