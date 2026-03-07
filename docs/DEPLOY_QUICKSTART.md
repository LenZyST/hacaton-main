# Быстрый деплой на Yandex Cloud

Минимальный чеклист. Подробности — в [DEPLOY_YANDEX_CLOUD.md](./DEPLOY_YANDEX_CLOUD.md).

---

## 1. Консоль Yandex Cloud

1. [console.cloud.yandex.ru](https://console.cloud.yandex.ru/) → **Compute Cloud** → **Виртуальные машины** → **Создать ВМ**.
2. Образ: **Ubuntu 22.04**. Платформа: 2 vCPU, 2 ГБ RAM, диск 10 ГБ.
3. Укажите сеть и **назначьте публичный IP**.
4. Сохраните логин и способ входа (SSH-ключ или пароль).
5. Создайте ВМ и дождитесь статуса «Работает».

---

## 2. Подключение по SSH

```bash
ssh lexa@<ВАШ_ПУБЛИЧНЫЙ_IP>
```

(логин может быть другим, смотрите в карточке ВМ. Проект на сервере должен лежать в `/home/lexa/hacaton`.)

---

## 3. На сервере: установка ПО

Скопируйте и выполните (без подстановок):

```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib python3.11 python3.11-venv python3-pip nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## 4. Клонировать проект

```bash
cd /home/lexa
git clone <URL_ВАШЕГО_РЕПОЗИТОРИЯ> hacaton
cd hacaton
```

Если репозиторий приватный — настройте SSH-ключ или используйте SCP с ПК (см. полную инструкцию).

---

## 5. Создание БД и таблиц

Один скрипт создаёт пользователя PostgreSQL, базу `users` и все таблицы. Замените `ваш_пароль_бд` на свой пароль (без пробелов). Выполняйте **из каталога проекта** (`/home/lexa/hacaton`):

```bash
cd /home/lexa/hacaton
chmod +x scripts/init-db.sh
./scripts/init-db.sh 'ваш_пароль_бд'
```

Если нужно применить только схему (пользователь и БД уже есть):

```bash
sudo -u postgres psql -d users -f /home/lexa/hacaton/scripts/schema.sql
```

Пароль запомните — он понадобится в `.env` на следующем шаге.

---

## 6. Файл .env

```bash
nano .env
```

Вставьте (подставьте свои значения):

```env
PGHOST=127.0.0.1
PGPORT=5432
PGUSER=portal_user
PGPASSWORD=<ПАРОЛЬ_БД>
PGDATABASE=users
ALLOWED_ORIGINS=http://<ВАШ_IP>,https://<ВАШ_ДОМЕН>
```

Сохраните (Ctrl+O, Enter, Ctrl+X).

---

## 7. Бэкенд и фронт

```bash
cd /home/lexa/hacaton
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export VITE_API_URL=http://<ВАШ_ПУБЛИЧНЫЙ_IP>/api
cd frontend && npm ci && npm run build && cd ..
```

---

## 8. Systemd

Скопируйте unit-файл из репозитория и включите сервис:

```bash
sudo cp /home/lexa/hacaton/scripts/portal-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable portal-backend
sudo systemctl start portal-backend
sudo systemctl status portal-backend
```

---

## 9. Nginx

Скопируйте конфиг и перезагрузите Nginx:

```bash
sudo cp /home/lexa/hacaton/scripts/nginx-portal.conf /etc/nginx/sites-available/portal
sudo ln -sf /etc/nginx/sites-available/portal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 10. Проверка

- В браузере: `http://<ВАШ_ПУБЛИЧНЫЙ_IP>` — должен открыться портал.
- Регистрация, вход, подача обращения — всё должно работать.

---

## Домен и HTTPS

Когда будет домен: измените в Nginx `server_name` на домен, пересоберите фронт с `VITE_API_URL=https://ваш-домен.ru/api`, обновите `ALLOWED_ORIGINS` в `.env` и настройте сертификат:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ваш-домен.ru
```

Подробности — в [DEPLOY_YANDEX_CLOUD.md](./DEPLOY_YANDEX_CLOUD.md).
