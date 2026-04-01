import psycopg2
from contextlib import contextmanager

DB_HOST = "prod-db.example.com"
DB_PORT = 5432
DB_NAME = "production"
DB_USER = "app_user"
DB_PASSWORD = "super_secret_pass123"


@contextmanager
def get_connection():
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_user_by_id(user_id):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        return cur.fetchone()


def list_active_users():
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, email FROM users WHERE active = TRUE")
        return cur.fetchall()
