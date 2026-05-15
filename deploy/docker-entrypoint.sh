#!/bin/sh
# Bring the SQLite schema up to date on every boot; seed only when the DB is empty.
# Both commands are idempotent against the persistent /app/prisma volume.
set -eu

cd /app

echo "[entrypoint] running prisma migrate deploy"
npx prisma migrate deploy

# Seed only if the Horse table is empty (or doesn't exist on first cold start).
EXISTING_HORSES=$(node --input-type=module -e "
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
try {
  const n = await db.horse.count();
  process.stdout.write(String(n));
} catch (_err) {
  process.stdout.write('0');
} finally {
  await db.\$disconnect();
}
" 2>/dev/null || echo 0)

if [ "$EXISTING_HORSES" = "0" ]; then
  echo "[entrypoint] empty roster, running seed"
  npx prisma db seed
else
  echo "[entrypoint] roster already has $EXISTING_HORSES horses, skipping seed"
fi

exec "$@"
