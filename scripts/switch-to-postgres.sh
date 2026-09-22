#!/bin/bash
# Bascule le provider Prisma entre SQLite (dev) et PostgreSQL (prod)
# Usage : bash scripts/switch-to-postgres.sh postgres
#         bash scripts/switch-to-postgres.sh sqlite

TARGET=${1:-postgres}
SCHEMA_FILE="prisma/schema.prisma"

if [ "$TARGET" = "postgres" ]; then
  sed -i 's|provider = "sqlite"|provider = "postgresql"|g' "$SCHEMA_FILE"
  echo "✅ Schéma Prisma basculé vers PostgreSQL"
elif [ "$TARGET" = "sqlite" ]; then
  sed -i 's|provider = "postgresql"|provider = "sqlite"|g' "$SCHEMA_FILE"
  echo "✅ Schéma Prisma basculé vers SQLite"
else
  echo "Usage: $0 [postgres|sqlite]"
  exit 1
fi

npx prisma generate 2>/dev/null
echo "✅ Client Prisma régénéré"
