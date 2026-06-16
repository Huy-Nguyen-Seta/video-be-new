#!/bin/sh
set -e

if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy
  node dist/prisma/seed.js || true
fi

echo "Starting the application..."
exec "$@"