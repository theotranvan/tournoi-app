"""Production / Docker settings."""

from .base import *  # noqa: F401, F403

import dj_database_url

DEBUG = False

# ─── CSRF ────────────────────────────────────────────────────────────────────
CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default=",".join(CORS_ALLOWED_ORIGINS),  # noqa: F405
    cast=Csv(),
)

# ─── Admin error emails ─────────────────────────────────────────────────────
_admin_email = config("ADMIN_EMAIL", default="")
if _admin_email:
    ADMINS = [("Admin", _admin_email)]

# ─── Database ────────────────────────────────────────────────────────────────
DATABASE_URL = config("DATABASE_URL")

DATABASES = {
    "default": dj_database_url.parse(
        DATABASE_URL, conn_max_age=600, conn_health_checks=True
    )
}

# ─── Cache ───────────────────────────────────────────────────────────────────
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
    }
}

# ─── Channels ────────────────────────────────────────────────────────────────
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}

# ─── Security ────────────────────────────────────────────────────────────────
SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=False, cast=bool)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Lax"
SECURE_HSTS_SECONDS = 63072000  # 2 years
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"

# ─── Sentry ──────────────────────────────────────────────────────────────────
# Sentry is already initialized in base.py with integrations,
# before_send scrubbing, and env-based sample rates.
# prod.py only needs to set SENTRY_ENVIRONMENT / SENTRY_TRACES_SAMPLE_RATE
# via environment variables (see .env.production.example).

# ─── Email ───────────────────────────────────────────────────────────────────
EMAIL_BACKEND = config("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = config("EMAIL_HOST", default="")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="Footix <noreply@footix.app>")
SERVER_EMAIL = DEFAULT_FROM_EMAIL

# ─── S3 médias (optionnel) ───────────────────────────────────────────────────
USE_S3_MEDIA = config("USE_S3_MEDIA", default=False, cast=bool)
if USE_S3_MEDIA:
    INSTALLED_APPS += ["storages"]  # noqa: F405
    DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
    AWS_ACCESS_KEY_ID = config("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = config("AWS_SECRET_ACCESS_KEY")
    AWS_STORAGE_BUCKET_NAME = config("AWS_STORAGE_BUCKET_NAME")
    AWS_S3_REGION_NAME = config("AWS_S3_REGION_NAME", default="fr-par")
    AWS_S3_ENDPOINT_URL = config("AWS_S3_ENDPOINT_URL", default="")
    AWS_S3_CUSTOM_DOMAIN = config("AWS_S3_CUSTOM_DOMAIN", default="")
    AWS_DEFAULT_ACL = None  # Use bucket policy, don't set public-read on each object
    AWS_S3_OBJECT_PARAMETERS = {"CacheControl": "max-age=86400"}
    MEDIA_URL = f"https://{AWS_S3_CUSTOM_DOMAIN}/" if AWS_S3_CUSTOM_DOMAIN else f"https://{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com/"

# ─── Logging ─────────────────────────────────────────────────────────────────
_LOG_LEVEL = config("LOG_LEVEL", default="INFO")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "WARNING",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "apps": {
            "handlers": ["console"],
            "level": _LOG_LEVEL,
            "propagate": False,
        },
    },
}
