#!/bin/sh
set -eu

mkdir -p /app/sessions
chown -R node:node /app/sessions
exec gosu node "$@"