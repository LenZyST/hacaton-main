import os

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import errors

from passlib.hash import bcrypt


DSN = dict(
    host=os.environ.get("PGHOST", "127.0.0.1"),
    user=os.environ.get("PGUSER", "postgres"),
    password=os.environ.get("PGPASSWORD", "1234"),
    port=os.environ.get("PGPORT", "5432"),
    dbname=os.environ.get("PGDATABASE", "users"),
)


def _fetchone(sql, params=()):
    with psycopg2.connect(**DSN) as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchone()


def _fetchall(sql, params=()):
    with psycopg2.connect(**DSN) as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchall()


def _execute(sql, params=()):
    with psycopg2.connect(**DSN) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()


# --- USERS ---

def get_users():
    # не светим password_hash
    return _fetchall(
        "SELECT user_id, login, email, phone, role, created_at FROM users ORDER BY user_id"
    )


def get_user_by_login(login: str):
    return _fetchone(
        "SELECT user_id, login, password_hash, email, phone, role FROM users WHERE lower(login) = lower(%s)",
        (login,),
    )


def user_exists_by_login(login: str) -> bool:
    return get_user_by_login(login) is not None


def user_exists_by_email(email: str) -> bool:
    return _fetchone("SELECT 1 FROM users WHERE lower(email) = lower(%s)", (email,)) is not None


def user_exists_by_phone(phone: str) -> bool:
    return _fetchone("SELECT 1 FROM users WHERE phone = %s", (phone,)) is not None


def registration(login: str, password: str, email: str, phone: str):
    password_hash = bcrypt.hash(password)
    try:
        _execute(
            "INSERT INTO users(login, password_hash, email, phone) VALUES (%s,%s,%s,%s)",
            (login, password_hash, email, phone),
        )
    except errors.UniqueViolation:
        raise


def create_user_with_role(login: str, password: str, email: str, phone: str, role: str):
    """Создание пользователя с указанной ролью (вызов только от имени админа)."""
    password_hash = bcrypt.hash(password)
    try:
        _execute(
            "INSERT INTO users(login, password_hash, email, phone, role) VALUES (%s,%s,%s,%s,%s)",
            (login, password_hash, email, phone, role),
        )
    except errors.UniqueViolation:
        raise


def user_login(login: str, password: str) -> bool:
    user = get_user_by_login(login)
    if not user:
        return False
    return bcrypt.verify(password, user["password_hash"])


# --- APPEALS ---

def get_appeals_data(user_id=None):
    if user_id is not None:
        return _fetchall(
            "SELECT * FROM appeals WHERE user_id = %s ORDER BY appeal_id DESC",
            (user_id,),
        )
    return _fetchall("SELECT * FROM appeals ORDER BY appeal_id DESC")


def get_appeals_by_login(login: str):
    """Обращения только текущего пользователя."""
    user = get_user_by_login(login)
    if not user:
        return []
    return get_appeals_data(user["user_id"])


def get_appeal(appeal_id: int):
    return _fetchone("SELECT * FROM appeals WHERE appeal_id = %s", (appeal_id,))


def post_appeal(topic, main_text, appeal_date, status, category, subcategory, confidence, routing_debug, user_id=None, address=None, address_normalized=None, lat=None, lon=None, tag=None) -> int:
    try:
        row = _fetchone(
            """
            INSERT INTO appeals(topic, main_text, appeal_date, status, category, subcategory, confidence, routing_debug, user_id, address, address_normalized, lat, lon, tag)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING appeal_id
            """,
            (topic, main_text, appeal_date, status, category, subcategory, confidence, routing_debug, user_id, address, address_normalized, lat, lon, tag),
        )
    except errors.ProgrammingError as e:
        err = str(e).lower()
        if "tag" in err or "address" in err or "lat" in err or "lon" in err or "column" in err:
            try:
                row = _fetchone(
                    """
                    INSERT INTO appeals(topic, main_text, appeal_date, status, category, subcategory, confidence, routing_debug, user_id, address, address_normalized, lat, lon)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    RETURNING appeal_id
                    """,
                    (topic, main_text, appeal_date, status, category, subcategory, confidence, routing_debug, user_id, address, address_normalized, lat, lon),
                )
            except errors.ProgrammingError as e2:
                err2 = str(e2).lower()
                if "address" in err2 or "lat" in err2 or "lon" in err2 or "column" in err2:
                    try:
                        row = _fetchone(
                            """
                            INSERT INTO appeals(topic, main_text, appeal_date, status, category, subcategory, confidence, routing_debug, user_id, address)
                            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                            RETURNING appeal_id
                            """,
                            (topic, main_text, appeal_date, status, category, subcategory, confidence, routing_debug, user_id, address),
                        )
                    except errors.ProgrammingError as e3:
                        if "address" in str(e3).lower() or "column" in str(e3).lower():
                            row = _fetchone(
                                """
                                INSERT INTO appeals(topic, main_text, appeal_date, status, category, subcategory, confidence, routing_debug, user_id)
                                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                                RETURNING appeal_id
                                """,
                                (topic, main_text, appeal_date, status, category, subcategory, confidence, routing_debug, user_id),
                            )
                        else:
                            raise
                else:
                    raise
        else:
            raise
    return int(row["appeal_id"])


def update_status(appeal_id: int, status: str):
    _execute("UPDATE appeals SET status = %s WHERE appeal_id = %s", (status, appeal_id))
    return {"ok": True, "message": f"Статус №{appeal_id} обновлен на {status}"}


# --- ADMIN CATEGORIES (назначение категорий админам) ---

def get_admin_categories(user_id: int):
    """Категории, закреплённые за админом."""
    rows = _fetchall("SELECT category FROM admin_categories WHERE user_id = %s ORDER BY category", (user_id,))
    return [r["category"] for r in rows]


def set_admin_categories(user_id: int, categories: list):
    """Задать список категорий для админа (перезаписывает предыдущий)."""
    _execute("DELETE FROM admin_categories WHERE user_id = %s", (user_id,))
    for cat in categories:
        if cat and str(cat).strip():
            _execute("INSERT INTO admin_categories(user_id, category) VALUES (%s,%s)", (user_id, cat.strip()))


def get_appeals_by_categories(category_list: list):
    """Обращения, у которых категория или подкатегория входит в список."""
    if not category_list:
        return []
    placeholders = ",".join(["%s"] * len(category_list))
    params = tuple(category_list) + tuple(category_list)
    return _fetchall(
        f"SELECT * FROM appeals WHERE category IN ({placeholders}) OR subcategory IN ({placeholders}) ORDER BY appeal_id DESC",
        params,
    )


# --- APPEAL PHOTOS ---

def ensure_appeal_photos_table():
    """Создать таблицу appeal_photos при первом запуске."""
    _execute("""
        CREATE TABLE IF NOT EXISTS appeal_photos (
            id SERIAL PRIMARY KEY,
            appeal_id INTEGER NOT NULL REFERENCES appeals(appeal_id) ON DELETE CASCADE,
            filename VARCHAR(255) NOT NULL UNIQUE
        )
    """)


def insert_appeal_photo(appeal_id: int, filename: str):
    _execute("INSERT INTO appeal_photos(appeal_id, filename) VALUES (%s,%s)", (appeal_id, filename))


def get_photos_for_appeal(appeal_id: int):
    """Список имён файлов фото по appeal_id."""
    rows = _fetchall("SELECT filename FROM appeal_photos WHERE appeal_id = %s ORDER BY id", (appeal_id,))
    return [r["filename"] for r in rows]


def get_photos_for_appeal_ids(appeal_ids: list):
    """Возвращает словарь appeal_id -> [filename, ...]."""
    if not appeal_ids:
        return {}
    placeholders = ",".join(["%s"] * len(appeal_ids))
    rows = _fetchall(
        f"SELECT appeal_id, filename FROM appeal_photos WHERE appeal_id IN ({placeholders}) ORDER BY appeal_id, id",
        tuple(appeal_ids),
    )
    out = {}
    for r in rows:
        aid = r["appeal_id"]
        if aid not in out:
            out[aid] = []
        out[aid].append(r["filename"])
    return out


def clean_all_data():
    """Удалить все пользователи и обращения. Структуру таблиц не менять."""
    order = [
        "DELETE FROM appeal_photos",
        "DELETE FROM admin_categories",
        "DELETE FROM appeals",
        "DELETE FROM users",
    ]
    with psycopg2.connect(**DSN) as conn:
        with conn.cursor() as cur:
            for sql in order:
                try:
                    cur.execute(sql)
                except errors.UndefinedTable:
                    pass
        conn.commit()