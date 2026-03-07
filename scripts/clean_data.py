#!/usr/bin/env python3
"""Удалить всех пользователей и все обращения. Структуру таблиц не меняет."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from dotenv import load_dotenv
except ImportError:
    pass
else:
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

from database import clean_all_data

if __name__ == "__main__":
    clean_all_data()
    print("Данные очищены: пользователи и обращения удалены.")
