#!/bin/bash
set -e
cd "$(dirname "$0")/.."
echo "=== Установка зависимостей бэкенда ==="
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
echo "=== Сборка фронта ==="
if [ -z "$VITE_API_URL" ]; then
  echo "Задайте VITE_API_URL (например https://your-domain.ru или http://IP-ВМ)"
  read -r -p "VITE_API_URL: " VITE_API_URL
  export VITE_API_URL
fi
cd frontend
npm ci
npm run build
cd ..
echo "=== Готово. Дальше: применить schema.sql к БД, настроить .env и systemd (см. docs/DEPLOY_YANDEX_CLOUD.md) ==="
