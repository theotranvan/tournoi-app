#!/bin/sh
exec daphne -b 0.0.0.0 -p "${PORT:-8000}" kickoff.asgi:application
