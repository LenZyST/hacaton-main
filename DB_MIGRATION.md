# Миграция БД: роль пользователя и привязка обращений к пользователю

Выполни в PostgreSQL **по порядку** (от имени пользователя с правами на БД `users`).

## 1. Поле `role` в таблице `users`

Если колонки `role` ещё нет:

```sql
ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';
UPDATE users SET role = 'user' WHERE role IS NULL;
```

Если колонка уже есть, но у части записей `role` пустой — обнови только их:

```sql
UPDATE users SET role = 'user' WHERE role IS NULL;
```

Назначить первого админа (подставь нужный логин):

```sql
UPDATE users SET role = 'admin' WHERE login = 'admin';
```

Назначить суперадмина (только он может назначать категории другим админам):

```sql
UPDATE users SET role = 'superadmin' WHERE login = 'твой_логин';
```

## 2. Поле `user_id` в таблице `appeals`

Обращения будут привязываться к пользователю. Старые записи останутся с `user_id = NULL`.

```sql
ALTER TABLE appeals ADD COLUMN user_id INTEGER REFERENCES users(user_id);
```

Проверка:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'   AND column_name = 'role'
   OR table_name = 'appeals' AND column_name = 'user_id';
```

## 3. Таблица назначения категорий админам

Чтобы у каждого админа были «свои» обращения по категориям, создаём таблицу:

```sql
CREATE TABLE IF NOT EXISTS admin_categories (
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  PRIMARY KEY (user_id, category)
);
```

## 4. Адрес обращения (для тепловой карты)

Необязательное поле — если нужны адреса и карта:

```sql
ALTER TABLE appeals ADD COLUMN IF NOT EXISTS address TEXT;
```

## 5. Координаты и нормализованный адрес (геокодер)

Для тепловой карты: при указании адреса бэкенд вызывает Яндекс Геокодер и сохраняет координаты и нормализованный адрес. Выполни после шага 4:

```sql
ALTER TABLE appeals ADD COLUMN IF NOT EXISTS address_normalized TEXT;
ALTER TABLE appeals ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE appeals ADD COLUMN IF NOT EXISTS lon DOUBLE PRECISION;
```

В `.env` задай `YANDEX_GEOCODER_API_KEY` (ключ в [кабинете разработчика Яндекса](https://developer.tech.yandex.ru/)).

## 6. Тег приоритета (ИИ-распределение)

Теги: Критический, Массовая проблема, Высокий приоритет, Отложено, Единичный случай, Требует проверки. При создании обращения ИИ (GigaChat) выбирает один тег.

```sql
ALTER TABLE appeals ADD COLUMN IF NOT EXISTS tag TEXT;
```

После миграции перезапусти бэкенд.
