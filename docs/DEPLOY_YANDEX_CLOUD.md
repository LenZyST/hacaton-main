# Деплой на Yandex Cloud

Пошаговая инструкция по развёртыванию «Городского портала» (FastAPI + React + PostgreSQL) в Yandex Cloud.

---

## Что нужно заранее

- Аккаунт в [Yandex Cloud](https://console.cloud.yandex.ru/)
- Домен (опционально, но желательно для HTTPS) или можно использовать IP и самоподписанный сертификат
- Локально: Git, сборка фронта и бэкенда уже работают

---

## Вариант 1: Одна ВМ (проще всего)

Один сервер: на нём PostgreSQL, бэкенд (FastAPI) и раздача статики фронта через Nginx.

### Шаг 1. Создать ВМ в Yandex Cloud

1. [Консоль Yandex Cloud](https://console.cloud.yandex.ru/) → **Compute Cloud** → **Виртуальные машины** → **Создать ВМ**.
2. Платформа: **Intel Broadwell**, 2 vCPU, 2 ГБ RAM (для начала достаточно).
3. Диск: минимум 10 ГБ (для ОС, БД, приложения и загрузок).
4. Образ: **Ubuntu 22.04 LTS**.
5. Сеть: выберите сеть и подсеть, при желании назначьте **белый (публичный) IP**.
6. Доступ: логин по SSH-ключу или паролю — сохраните ключ/пароль.
7. Создайте ВМ и дождитесь запуска.

### Шаг 2. Подключиться по SSH

```bash
ssh lexa@<публичный-IP-вашей-ВМ>
```

(или `ssh <ваш-логин>@<IP>` — смотря как создавали ВМ.)

### Шаг 3. Установить PostgreSQL

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

Создать пользователя и БД:

```bash
sudo -u postgres psql -c "CREATE USER portal_user WITH PASSWORD 'ваш_надёжный_пароль';"
sudo -u postgres psql -c "CREATE DATABASE users OWNER portal_user;"
```

При необходимости донастройте `pg_hba.conf` для доступа с localhost (по умолчанию для локального входа уже разрешено).

### Шаг 4. Установить Python 3.11, Node (для сборки), Nginx

```bash
sudo apt install -y python3.11 python3.11-venv python3-pip nginx
# Node 20 LTS (для сборки фронта)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Шаг 5. Загрузить проект на сервер

**Вариант А — через Git (рекомендуется):**

На сервере:

```bash
cd /home/lexa
git clone <url-вашего-репозитория> hacaton
cd hacaton
```

**Вариант Б — через SCP с вашего ПК:**

На вашем ПК (из каталога с проектом):

```bash
scp -r /path/к/проекту lexa@<IP-ВМ>:~/hacaton
```

На ВМ затем: `cd ~/hacaton`.

### Шаг 6. Переменные окружения и БД

На сервере в каталоге проекта создайте файл `.env` (или экспортируйте переменные в systemd/скрипте):

```bash
cd ~/hacaton
nano .env
```

Содержимое (подставьте свои значения):

```env
# PostgreSQL (на этой же ВМ — localhost)
PGHOST=127.0.0.1
PGPORT=5432
PGUSER=portal_user
PGPASSWORD=ваш_надёжный_пароль
PGDATABASE=users

# CORS: адрес вашего фронта (тот, по которому пользователи заходят)
ALLOWED_ORIGINS=https://your-domain.ru,https://www.your-domain.ru

# Опционально: GigaChat (ИИ-распределение)
# GIGACHAT_CREDENTIALS=...

# Опционально: Яндекс Геокодер (тепловая карта)
# YANDEX_GEOCODER_API_KEY=...
```

Сохраните файл. Для продакшена **не коммитьте `.env` в Git**.

### Шаг 7. Инициализация БД (таблицы)

Примените начальную схему из репозитория (таблицы `users`, `appeals`, `admin_categories`). Таблицу `appeal_photos` создаст бэкенд при первом запуске.

```bash
cd ~/hacaton
sudo -u postgres psql -d users -f "$(pwd)/scripts/schema.sql"
```

Или из любой директории (подставьте свой путь к проекту):

```bash
sudo -u postgres psql -d users -f /home/lexa/hacaton/scripts/schema.sql
```

### Шаг 8. Сборка фронта

На сервере:

```bash
cd ~/hacaton/frontend
npm ci
```

Задайте URL, по которому пользователи заходят на сайт (с префиксом `/api`, т.к. Nginx проксирует `/api/` на бэкенд):

```bash
export VITE_API_URL=https://your-domain.ru/api
npm run build
```

Если пока без домена — подставьте `http://<публичный-IP-ВМ>/api`.

Будет каталог `frontend/dist` с готовой статикой.

### Шаг 9. Запуск бэкенда (FastAPI)

Создайте виртуальное окружение и установите зависимости:

```bash
cd ~/hacaton
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Проверьте запуск (порт 8000):

```bash
set -a && source .env && set +a
uvicorn main:app --host 0.0.0.0 --port 8000
```

В браузере с вашего ПК: `http://<IP-ВМ>:8000/docs` — должна открыться Swagger. Остановите тест (Ctrl+C).

### Шаг 10. Systemd-сервис для бэкенда

Чтобы бэкенд работал постоянно и перезапускался после перезагрузки:

```bash
sudo nano /etc/systemd/system/portal-backend.service
```

Содержимое (пути и пользователь при необходимости замените):

```ini
[Unit]
Description=Portal FastAPI Backend
After=network.target postgresql.service

[Service]
Type=simple
User=lexa
WorkingDirectory=/home/lexa/hacaton
EnvironmentFile=/home/lexa/hacaton/.env
ExecStart=/home/lexa/hacaton/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Включите и запустите:

```bash
sudo systemctl daemon-reload
sudo systemctl enable portal-backend
sudo systemctl start portal-backend
sudo systemctl status portal-backend
```

Бэкенд слушает только localhost (127.0.0.1:8000); снаружи доступ будет через Nginx.

### Шаг 11. Nginx: статика фронта и прокси к API

Создайте конфиг сайта:

```bash
sudo nano /etc/nginx/sites-available/portal
```

Пример (замените `your-domain.ru` и пути при необходимости):

```nginx
server {
    listen 80;
    server_name your-domain.ru www.your-domain.ru;
    # Если пока без домена — используйте default_server и заходите по IP:
    # listen 80 default_server;

    root /home/lexa/hacaton/frontend/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:8000/uploads/;
        proxy_set_header Host $host;
    }
}
```

Включите сайт и перезапустите Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/portal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Важно: фронт при сборке был собран с `VITE_API_URL=https://your-domain.ru/api`. Тогда запросы с фронта идут на `https://your-domain.ru/api/...`, Nginx проксирует `/api/` на `http://127.0.0.1:8000/`.

### Шаг 12. HTTPS (рекомендуется)

**Вариант A — Let's Encrypt (Certbot):**

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.ru -d www.your-domain.ru
```

Certbot сам настроит редирект с HTTP на HTTPS в Nginx.

**Вариант Б — сертификат в Yandex Certificate Manager:**  
Создайте сертификат в консоли, привяжите к Application Load Balancer и настройте балансировщик на вашу ВМ (порт 80/443). Либо используйте сертификат на ВМ вручную (подстановка в конфиг Nginx).

### Шаг 13. Фронт должен знать URL бэкенда

При сборке вы уже задали:

```bash
export VITE_API_URL=https://your-domain.ru/api
npm run build
```

Если позже смените домен — пересоберите фронт с новым `VITE_API_URL` и заново скопируйте содержимое `frontend/dist` на сервер (или пересоберите на сервере).

### Шаг 14. Загрузки (фото обращений)

Папка `uploads/` создаётся приложением при старте в рабочем каталоге бэкенда. Она находится на диске ВМ. Для бэкапов достаточно периодически копировать каталог `~/hacaton/uploads` (например, в Object Storage через `yc` CLI или скрипт).

---

## Вариант 2: Managed PostgreSQL + ВМ только для приложения

Если хотите вынести БД в управляемый сервис:

1. В Yandex Cloud: **Managed Service for PostgreSQL** → создать кластер и БД, пользователя, пароль, включить доступ из нужной подсети.
2. На ВМ (как в варианте 1) **не** ставить PostgreSQL. В `.env` указать хост кластера:

   ```env
   PGHOST=<FQDN-хоста-вашего-кластера>.postgresql-proxy.yandex.cloud
   PGPORT=6432
   PGUSER=...
   PGPASSWORD=...
   PGDATABASE=users
   ```

3. В настройках кластера разрешить доступ с IP вашей ВМ (или с подсети ВМ).
4. Остальные шаги (сборка фронта, systemd, Nginx, HTTPS) — как в варианте 1.

---

## Краткий чеклист

- [ ] ВМ создана, есть доступ по SSH.
- [ ] PostgreSQL установлен, созданы пользователь и БД (или используется Managed PostgreSQL).
- [ ] В `.env` заданы PGHOST, PGUSER, PGPASSWORD, PGDATABASE, ALLOWED_ORIGINS.
- [ ] Фронт собран с нужным `VITE_API_URL` (адрес сайта + `/api`).
- [ ] Бэкенд запущен через systemd, слушает 127.0.0.1:8000.
- [ ] Nginx раздаёт статику из `frontend/dist` и проксирует `/api/` и `/uploads/` на бэкенд.
- [ ] Настроен HTTPS (Certbot или сертификат Yandex).
- [ ] В консоли Yandex при необходимости открыты порты 80/443 для ВМ (Security Groups / файрвол).

После этого заходите по домену (или по IP, если без домена) — должен открываться фронт и работать API.
