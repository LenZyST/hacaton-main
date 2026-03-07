import json
import logging
import os
import ssl
import urllib.error
import urllib.parse
import urllib.request

logger = logging.getLogger(__name__)

GEOCODER_URL = "https://geocode-maps.yandex.ru/v1/"


def _ssl_context():
    """Контекст SSL: отключить проверку сертификата, если в окружении указано (для обхода ошибок в части сетей)."""
    v = os.environ.get("YANDEX_GEOCODER_VERIFY_SSL", "true").strip().lower()
    if v in ("0", "false", "no", "off"):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    return ssl.create_default_context()


def geocode(address: str) -> tuple[float, float, str] | None:
    """
    По строке адреса возвращает (lat, lon, normalized_address) или None при ошибке/отсутствии ключа.
    API v1: https://yandex.com/dev/geocode/doc/en/request
    """
    key = os.environ.get("YANDEX_GEOCODER_API_KEY", "").strip()
    if not key:
        logger.debug("YANDEX_GEOCODER_API_KEY не задан")
        return None
    addr = (address or "").strip()
    if not addr:
        return None
    try:
        url = GEOCODER_URL + "?" + urllib.parse.urlencode({
            "apikey": key,
            "geocode": addr,
            "lang": "ru_RU",
            "format": "json",
        })
        req = urllib.request.Request(url, headers={"User-Agent": "AppealsBackend/1.0"})
        with urllib.request.urlopen(req, timeout=10, context=_ssl_context()) as resp:
            data = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            err = json.loads(body)
            msg = err.get("message", body)
        except Exception:
            msg = body
        logger.warning("Геокодер HTTP %s: %s", e.code, msg)
        return None
    except urllib.error.URLError as e:
        reason = e.reason
        if isinstance(reason, OSError) and getattr(reason, "errno", None) == 101:
            logger.warning("Геокодер: сеть недоступна (нет доступа к geocode-maps.yandex.ru). Обращение сохранено без координат.")
        else:
            logger.warning("Геокодер запрос: %s. Проверьте доступ в интернет и доступность geocode-maps.yandex.ru.", reason)
        return None
    except OSError as e:
        if getattr(e, "errno", None) == 101:
            logger.warning("Геокодер: сеть недоступна (нет доступа к geocode-maps.yandex.ru). Обращение сохранено без координат.")
        else:
            logger.warning("Геокодер запрос (OSError): %s", e)
        return None
    except Exception as e:
        logger.warning("Геокодер запрос: %s", e)
        return None

    try:
        obj = json.loads(data)
        if "statusCode" in obj or "error" in obj:
            logger.warning("Геокодер ответ: %s", obj.get("message", obj))
            return None
        collection = obj.get("response", {}).get("GeoObjectCollection", {})
        members = collection.get("featureMember", [])
        if not members:
            logger.debug("Геокодер: по адресу ничего не найдено: %s", addr)
            return None
        geo = members[0].get("GeoObject", {})
        point = geo.get("Point", {})
        pos = point.get("pos", "")
        parts = pos.split()
        if len(parts) != 2:
            return None
        lon, lat = float(parts[0]), float(parts[1])
        meta = geo.get("metaDataProperty", {}).get("GeocoderMetaData", {})
        text = (meta.get("text") or addr).strip()
        return (lat, lon, text)
    except (KeyError, IndexError, TypeError, ValueError) as e:
        logger.warning("Геокодер разбор ответа: %s", e)
        return None
