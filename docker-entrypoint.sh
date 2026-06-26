#!/bin/sh
set -e

# Railway (and most platforms) mount the persistent volume owned by root.
# The application runs as the non-root 'node' user, so it cannot write the
# SQLite database to a root-owned volume. This entrypoint runs briefly as root
# to create the data directory and hand ownership to 'node', then drops
# privileges and execs the application as 'node' — the app never runs as root.

DB_DIR="$(dirname "${DB_PATH:-${DATA_PATH:-/usr/src/app/data}/predictions.db}")"

mkdir -p "$DB_DIR"
chown -R node:node "$DB_DIR" 2>/dev/null || true

# Drop root → run the application as the unprivileged 'node' user.
exec su-exec node:node "$@"
