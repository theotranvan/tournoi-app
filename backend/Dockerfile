FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=kickoff.settings.prod

WORKDIR /app

# System deps for psycopg2
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install Python deps (layer-cached)
COPY backend/pyproject.toml .
RUN pip install --no-cache-dir tomli 2>/dev/null; \
    python -c "import tomllib; deps=tomllib.load(open('pyproject.toml','rb'))['project']['dependencies']; print('\n'.join(d for d in deps if not d.strip().startswith('#')))" > /tmp/reqs.txt && \
    pip install --no-cache-dir -r /tmp/reqs.txt && rm /tmp/reqs.txt

COPY backend/ .

RUN python manage.py collectstatic --noinput 2>/dev/null || true

# Run as non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

CMD python manage.py migrate && \
    python manage.py collectstatic --noinput && \
    daphne -b 0.0.0.0 -p ${PORT:-8000} kickoff.asgi:application
