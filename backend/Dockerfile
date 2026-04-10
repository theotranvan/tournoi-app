FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=kickoff.settings.prod \
    PYTHONPATH=/app

WORKDIR /app

# System deps for psycopg2-binary
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies (layer-cached)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/apps ./apps
COPY backend/kickoff ./kickoff
COPY backend/manage.py ./manage.py
COPY backend/start.sh ./start.sh

# Set up non-root user (chmod before USER switch)
RUN chmod +x /app/start.sh && \
    addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

CMD ["/app/start.sh"]
