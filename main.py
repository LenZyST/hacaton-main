from datetime import date
import os
import re
import uuid

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, Field
import uvicorn
from psycopg2 import errors

from database import (
    get_users,
    get_user_by_login,
    registration,
    create_user_with_role,
    user_login,
    user_exists_by_login,
    user_exists_by_email,
    user_exists_by_phone,
    get_appeals_data,
    get_appeals_by_login,
    get_appeal,
    post_appeal,
    update_status,
    get_admin_categories,
    set_admin_categories,
    get_appeals_by_categories,
    ensure_appeal_photos_table,
    insert_appeal_photo,
    get_photos_for_appeal,
    get_photos_for_appeal_ids,
)

from routing import route_appeal, route_tag, get_all_category_names
from geocoder import geocode

UPLOAD_DIR = "uploads"
PHOTOS_SUBDIR = "appeal_photos"
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

app = FastAPI(title="Appeals Service")


@app.on_event("startup")
def startup():
    os.makedirs(os.path.join(UPLOAD_DIR, PHOTOS_SUBDIR), exist_ok=True)
    ensure_appeal_photos_table()


try:
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
except RuntimeError:
    pass

_cors_origins = os.environ.get("ALLOWED_ORIGINS", "").strip().split(",") if os.environ.get("ALLOWED_ORIGINS") else ["http://localhost:5173", "http://127.0.0.1:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins if o.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "OPTIONS", "DELETE", "PATCH"],
    allow_headers=["*"],
)


LOGIN_RE = re.compile(r"^[a-zA-Z0-9_]{4,32}$")
PHONE_RE = re.compile(r"^\+?\d{10,15}$")

ALLOWED_STATUSES = {"Не прочитано", "В работе", "Закрыто", "Отклонено"}


class RegisterUser(BaseModel):
    login: str = Field(min_length=4, max_length=32)
    password: str = Field(min_length=8, max_length=64)
    email: EmailStr
    phone: str


class LoginBody(BaseModel):
    login: str
    password: str


class AppealIn(BaseModel):
    topic: str = Field(min_length=1, max_length=255)
    main_text: str = Field(min_length=1, max_length=50_000)
    date: date
    login: str | None = None
    address: str | None = None  # для тепловой карты, опционально


class CreateUserByAdmin(BaseModel):
    admin_login: str
    admin_password: str
    login: str = Field(min_length=4, max_length=32)
    password: str = Field(min_length=8, max_length=64)
    email: EmailStr
    phone: str
    role: str = Field(pattern="^(admin|user|superadmin)$")


class SetAssignmentsBody(BaseModel):
    admin_login: str
    admin_password: str
    user_id: int
    categories: list[str]


def validate_password(password: str) -> None:
    if not password:
        raise HTTPException(status_code=400, detail="Пароль не должен быть пустым")
    if len(password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="Пароль слишком длинный (bcrypt: максимум 72 байта)")
    if not any(c.islower() for c in password):
        raise HTTPException(status_code=400, detail="Пароль должен содержать строчные буквы")
    if not any(c.isupper() for c in password):
        raise HTTPException(status_code=400, detail="Пароль должен содержать заглавные буквы")
    if not any(c.isdigit() for c in password):
        raise HTTPException(status_code=400, detail="Пароль должен содержать цифры")


@app.get("/users")
def api_get_users():
    return get_users()


@app.post("/registration")
def api_registration(body: RegisterUser):
    if not LOGIN_RE.match(body.login):
        raise HTTPException(status_code=400, detail="Логин: 4-32 символа, только латиница/цифры/_")

    if not PHONE_RE.match(body.phone):
        raise HTTPException(status_code=400, detail="Телефон: +79991234567 (10-15 цифр)")

    validate_password(body.password)

    if user_exists_by_login(body.login):
        raise HTTPException(status_code=409, detail="Логин уже занят")
    if user_exists_by_email(body.email):
        raise HTTPException(status_code=409, detail="Email уже используется")
    if user_exists_by_phone(body.phone):
        raise HTTPException(status_code=409, detail="Телефон уже зарегистрирован")

    try:
        registration(body.login, body.password, body.email, body.phone)
    except errors.UniqueViolation:
        raise HTTPException(status_code=409, detail="Логин, email или телефон уже используются")

    return {"ok": True, "message": "Регистрация прошла успешно"}


@app.post("/login")
def api_login(body: LoginBody):
    ok = user_login(body.login, body.password)
    if not ok:
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    return {"ok": True}


@app.get("/get_appeals")
def api_get_appeals():
    appeals = get_appeals_data()
    return _attach_photos(appeals)


@app.get("/my_appeals")
def api_my_appeals(login: str):
    """Обращения только указанного пользователя (для ЛК)."""
    appeals = get_appeals_by_login(login)
    return _attach_photos(appeals)


@app.post("/admin/create_user")
def api_admin_create_user(body: CreateUserByAdmin):
    """Создание пользователя (логин/пароль) админом. Проверяется пароль текущего админа."""
    if not user_login(body.admin_login, body.admin_password):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль администратора")
    admin = get_user_by_login(body.admin_login)
    if (admin.get("role") or "").lower() not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Доступ только для администратора")

    if not LOGIN_RE.match(body.login):
        raise HTTPException(status_code=400, detail="Логин: 4-32 символа, только латиница/цифры/_")
    if not PHONE_RE.match(body.phone):
        raise HTTPException(status_code=400, detail="Телефон: +79991234567 (10-15 цифр)")
    validate_password(body.password)

    try:
        create_user_with_role(body.login, body.password, body.email, body.phone, body.role)
    except errors.UniqueViolation:
        raise HTTPException(status_code=409, detail="Логин/почта/телефон уже используются")
    return {"ok": True, "message": "Пользователь создан"}


def _photo_url(filename: str) -> str:
    return f"/uploads/{PHOTOS_SUBDIR}/{filename}"


def _attach_photos(appeals: list) -> list:
    if not appeals:
        return appeals
    ids = [a["appeal_id"] for a in appeals]
    photos_map = get_photos_for_appeal_ids(ids)
    out = []
    for a in appeals:
        row = dict(a)
        row["photos"] = [_photo_url(f) for f in photos_map.get(a["appeal_id"], [])]
        out.append(row)
    return out


@app.get("/get_appeals/{appeal_id}")
def api_get_appeal(appeal_id: int):
    appeal = get_appeal(appeal_id)
    if not appeal:
        raise HTTPException(status_code=404, detail="Обращение не найдено")
    appeal = dict(appeal)
    appeal["photos"] = [_photo_url(f) for f in get_photos_for_appeal(appeal_id)]
    return appeal


@app.put("/get_appeals/{appeal_id}")
def api_update_appeal_status(appeal_id: int, status: str):
    if status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail=f"Недопустимый статус. Разрешено: {sorted(ALLOWED_STATUSES)}")
    return update_status(appeal_id, status)


def _save_uploaded_photo(appeal_id: int, file: UploadFile) -> str | None:
    """Сохранить загруженный файл, вернуть filename или None."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return None
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, PHOTOS_SUBDIR, filename)
    try:
        contents = file.file.read()
        with open(path, "wb") as f:
            f.write(contents)
        insert_appeal_photo(appeal_id, filename)
        return filename
    except Exception:
        if os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass
        return None


@app.post("/new_appeal")
async def api_new_appeal(
    topic: str = Form(..., min_length=1, max_length=255),
    main_text: str = Form(..., min_length=1, max_length=50_000),
    date_str: str = Form(..., alias="date"),
    login: str | None = Form(None),
    address: str | None = Form(None),
    files: list[UploadFile] = File(default=[]),
):
    """Создание обращения (multipart: topic, main_text, date, login?, address?, files?)."""
    try:
        appeal_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверный формат даты (ожидается YYYY-MM-DD)")
    r = route_appeal(topic, main_text)
    tag = route_tag(topic, main_text)
    user_id = None
    if login and login.strip():
        u = get_user_by_login(login.strip())
        if u:
            user_id = u["user_id"]

    address_normalized, lat, lon = None, None, None
    if address and address.strip():
        geo = geocode(address.strip())
        if geo:
            lat, lon, address_normalized = geo

    new_id = post_appeal(
        topic=topic,
        main_text=main_text,
        appeal_date=appeal_date,
        status="Не прочитано",
        category=r.category,
        subcategory=r.subcategory,
        confidence=r.confidence,
        routing_debug=r.debug,
        user_id=user_id,
        address=address,
        address_normalized=address_normalized,
        lat=lat,
        lon=lon,
        tag=tag,
    )

    photo_urls = []
    for f in files or []:
        if f.filename:
            saved = _save_uploaded_photo(new_id, f)
            if saved:
                photo_urls.append(_photo_url(saved))

    return {
        "ok": True,
        "message": "Обращение успешно добавлено",
        "appeal_id": new_id,
        "category": r.category,
        "subcategory": r.subcategory,
        "confidence": r.confidence,
        "tag": tag,
        "photos": photo_urls,
    }


@app.get("/appeals")
def api_get_appeals_alias():
    return _attach_photos(get_appeals_data())


@app.post("/appeals")
async def api_new_appeal_alias(
    topic: str = Form(..., min_length=1, max_length=255),
    main_text: str = Form(..., min_length=1, max_length=50_000),
    date_str: str = Form(..., alias="date"),
    login: str | None = Form(None),
    address: str | None = Form(None),
    files: list[UploadFile] = File(default=[]),
):
    return await api_new_appeal(topic, main_text, date_str, login, address, files)


@app.get("/admin/categories")
def api_admin_categories():
    """Список всех категорий (для назначения админам)."""
    return get_all_category_names()


@app.get("/admin/my_tasks")
def api_admin_my_tasks(login: str):
    """Обращения по категориям, закреплённым за этим админом."""
    user = get_user_by_login(login)
    role = (user.get("role") or "").lower() if user else ""
    if not user or role not in ("admin", "superadmin"):
        return []
    cats = get_admin_categories(user["user_id"])
    appeals = get_appeals_by_categories(cats)
    return _attach_photos(appeals)


@app.get("/admin/assignments")
def api_admin_assignments(login: str):
    """Кому какие категории назначены. Только суперадмин."""
    admin = get_user_by_login(login)
    if not admin or (admin.get("role") or "").lower() != "superadmin":
        raise HTTPException(status_code=403, detail="Доступ только для суперадминистратора")
    all_users = get_users()
    admins = [u for u in all_users if (u.get("role") or "").lower() in ("admin", "superadmin")]
    return [
        {"user_id": u["user_id"], "login": u["login"], "categories": get_admin_categories(u["user_id"])}
        for u in admins
    ]


@app.post("/admin/assignments")
def api_admin_set_assignments(body: SetAssignmentsBody):
    """Назначить категории админу. Только суперадмин."""
    if not user_login(body.admin_login, body.admin_password):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    admin = get_user_by_login(body.admin_login)
    if (admin.get("role") or "").lower() != "superadmin":
        raise HTTPException(status_code=403, detail="Доступ только для суперадминистратора")
    target = next((u for u in get_users() if u["user_id"] == body.user_id), None)
    if not target or (target.get("role") or "").lower() not in ("admin", "superadmin"):
        raise HTTPException(status_code=400, detail="Указан не админ или пользователь не найден")
    set_admin_categories(body.user_id, body.categories or [])
    return {"ok": True, "message": "Назначение обновлено"}


if __name__ == "__main__":
    uvicorn.run("main:app", reload=True)