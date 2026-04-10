#!/bin/sh
set -e

# Render PostgreSQL hostname resolution can fail briefly during deploy.
# Retry migrations before failing hard.
RETRIES=${DB_WAIT_RETRIES:-20}
DELAY=${DB_WAIT_DELAY:-3}
ATTEMPT=1

while ! python manage.py migrate --noinput; do
	if [ "$ATTEMPT" -ge "$RETRIES" ]; then
		echo "Database migration failed after $RETRIES attempts."
		exit 1
	fi
	echo "Database not ready (attempt $ATTEMPT/$RETRIES). Retrying in ${DELAY}s..."
	ATTEMPT=$((ATTEMPT + 1))
	sleep "$DELAY"
done

python manage.py collectstatic --noinput
exec daphne -b 0.0.0.0 -p ${PORT:-8000} kickoff.asgi:application
