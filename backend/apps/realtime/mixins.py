"""Mixin that tracks field changes between ``__init__`` and ``save()``."""


class TrackChangesMixin:
    """Track changes on specified fields between model init and save.

    Subclasses should define ``_tracked_fields`` as a tuple of field names.
    After init the original values are stored; ``save()`` updates a dict of
    changed fields that can be inspected by signal handlers.
    """

    _tracked_fields: tuple[str, ...] = ()

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        original_init = cls.__init__

        def _patched_init(self, *args, **kw):
            original_init(self, *args, **kw)
            self._field_tracker_saved = False
            self._snapshot_original()

        cls.__init__ = _patched_init

    def _snapshot_original(self):
        self._original_values = {f: getattr(self, f, None) for f in self._tracked_fields}

    def save(self, *args, **kwargs):
        self._changed_fields = {}
        for field in self._tracked_fields:
            old = self._original_values.get(field)
            new = getattr(self, field, None)
            if old != new:
                self._changed_fields[field] = {"old": old, "new": new}
        self._field_tracker_saved = True
        super().save(*args, **kwargs)
        # Re-snapshot so subsequent saves start from the saved state.
        self._snapshot_original()

    def has_changed(self, field_name: str) -> bool:
        return field_name in getattr(self, "_changed_fields", {})

    def previous_value(self, field_name: str):
        changes = getattr(self, "_changed_fields", {})
        if field_name in changes:
            return changes[field_name]["old"]
        return getattr(self, field_name, None)
