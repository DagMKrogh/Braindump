#!/bin/sh
set -e

echo "Running database migrations..."
cd /app/apps/sync-service
node dist/db/migrate.js

echo "Starting Braindump sync service..."
exec node dist/index.js
