"""
Shared API infrastructure: custom exception handler, error codes, permissions.
"""

from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler

# ─── Custom Error Codes ─────────────────────────────────────────────────────


class ScheduleConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Conflit de planning non résolu."
    default_code = "schedule_conflict"


class InvalidStateTransition(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Transition d'état invalide."
    default_code = "invalid_state_transition"


class BusinessRuleViolation(APIException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_detail = "Règle métier violée."
    default_code = "business_rule_violation"


# ─── Custom Exception Handler ───────────────────────────────────────────────


def api_exception_handler(exc, context):
    """Format uniforme pour toutes les erreurs API."""
    response = exception_handler(exc, context)

    if response is None:
        return response

    error_code = getattr(exc, "default_code", "error")
    if hasattr(exc, "get_codes"):
        codes = exc.get_codes()
        if isinstance(codes, str):
            error_code = codes

    body = {
        "error": error_code,
        "message": "",
        "details": {},
    }

    if isinstance(response.data, dict):
        # DRF validation errors come as {"field": ["err"]}
        detail = response.data.pop("detail", None)
        if detail:
            body["message"] = str(detail)
        if response.data:
            body["details"] = response.data
        if not body["message"] and body["details"]:
            body["message"] = "Erreur de validation."
            body["error"] = "validation_failed"
    elif isinstance(response.data, list):
        body["message"] = " ".join(str(e) for e in response.data)
    else:
        body["message"] = str(response.data)

    response.data = body
    return response
