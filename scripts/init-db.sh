#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS="${1:?Укажите пароль для пользователя portal_user: scripts/init-db.sh 'ваш_пароль'}"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE USER portal_user WITH PASSWORD '$PASS';" 2>/dev/null || true
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE users OWNER portal_user;" 2>/dev/null || true
sudo -u postgres psql -d users -v ON_ERROR_STOP=1 -f "$ROOT/scripts/schema.sql"
echo "БД users и таблицы созданы. Пароль для .env: PGPASSWORD=$PASS"
