# Must match the python-version used by .github/workflows/deploy.yml —
# prod should never run an interpreter version CI never tested.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=kickoff.settings.prod \
    PYTHONPATH=/app

WORKDIR /app

# System deps for psycopg2-binary
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Single source of truth for dependencies: pyproject.toml.
# requirements.txt used to be installed here and had drifted (it was missing
# django-storages), so CI tested one dependency set and prod ran another.
# The `prod` extra pulls django-storages[boto3] required by USE_S3_MEDIA.
COPY backend/pyproject.toml ./pyproject.toml
COPY backend/apps ./apps
COPY backend/kickoff ./kickoff
COPY backend/manage.py ./manage.py
COPY backend/start.sh ./start.sh

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir ".[prod]"

# Set up non-root user (chmod before USER switch)
RUN chmod +x /app/start.sh && \
    addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

CMD ["/app/start.sh"]
