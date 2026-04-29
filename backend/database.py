"""
database.py — Production-ready database layer
"""

import os
import json
import sqlite3
import logging

logger = logging.getLogger("database")

DATABASE_URL = os.getenv("DATABASE_URL")

_pg_pool = None


def _get_pg_pool():
    global _pg_pool
    if _pg_pool is None:
        logger.info("[DB] Initializing PostgreSQL connection pool (2–20 connections)")
        import psycopg2.pool
        _pg_pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=20,
            dsn=DATABASE_URL,
        )
        logger.info("[DB] ✓ PostgreSQL connection pool ready")
    return _pg_pool


def _get_sqlite_conn():
    conn = sqlite3.connect("candidates.db", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _is_postgres():
    return bool(DATABASE_URL and DATABASE_URL.startswith("postgres"))


# ---------------------------------------------------------------------------
# Init
# ---------------------------------------------------------------------------
def init_db():
    if _is_postgres():
        logger.info("[DB] DATABASE_URL detected — using PostgreSQL")
        _init_postgres()
    else:
        logger.warning("[DB] No PostgreSQL URL found — using SQLite (dev only)")
        _init_sqlite()


def _init_sqlite():
    logger.info("[DB] Initializing SQLite database")
    conn = _get_sqlite_conn()
    c = conn.cursor()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            final_score REAL,
            semantic_score REAL,
            skill_score REAL,
            experience_score REAL,
            matched_skills TEXT,
            missing_skills TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    conn.close()
    logger.info("[DB] ✓ SQLite tables ready (results, users)")


def _init_postgres():
    logger.info("[DB] Initializing PostgreSQL tables")
    import psycopg2
    conn = psycopg2.connect(DATABASE_URL)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS results (
            id SERIAL PRIMARY KEY,
            name TEXT,
            final_score REAL,
            semantic_score REAL,
            skill_score REAL,
            experience_score REAL,
            matched_skills TEXT,
            missing_skills TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        );
    """)
    c.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
    conn.commit()
    conn.close()
    logger.info("[DB] ✓ PostgreSQL tables ready (results, users)")


# ---------------------------------------------------------------------------
# User operations — used by auth.py
# ---------------------------------------------------------------------------
def create_user(email: str, hashed_password: str):
    """Insert a new user. Raises ValueError if email already exists."""
    logger.info("[DB] Creating user: %s", email)
    if _is_postgres():
        _create_user_postgres(email, hashed_password)
    else:
        _create_user_sqlite(email, hashed_password)


def _create_user_sqlite(email: str, hashed_password: str):
    conn = _get_sqlite_conn()
    try:
        c = conn.cursor()
        c.execute(
            "INSERT INTO users (email, password) VALUES (?, ?)",
            (email, hashed_password),
        )
        conn.commit()
        logger.info("[DB] ✓ SQLite user created: %s", email)
    except sqlite3.IntegrityError:
        logger.warning("[DB] ✗ SQLite duplicate email: %s", email)
        raise ValueError("duplicate")
    except Exception as e:
        conn.rollback()
        logger.error("[DB] ✗ SQLite user creation failed for %s — %s", email, e)
        raise
    finally:
        conn.close()


def _create_user_postgres(email: str, hashed_password: str):
    import psycopg2
    pool = _get_pg_pool()
    conn = pool.getconn()
    try:
        c = conn.cursor()
        c.execute(
            "INSERT INTO users (email, password) VALUES (%s, %s)",
            (email, hashed_password),
        )
        conn.commit()
        logger.info("[DB] ✓ PostgreSQL user created: %s", email)
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        logger.warning("[DB] ✗ PostgreSQL duplicate email: %s", email)
        raise ValueError("duplicate")
    except Exception as e:
        conn.rollback()
        logger.error("[DB] ✗ PostgreSQL user creation failed for %s — %s", email, e)
        raise
    finally:
        pool.putconn(conn)


def get_user_password(email: str):
    """Return hashed password for email, or None if not found."""
    logger.info("[DB] Looking up user: %s", email)
    if _is_postgres():
        return _get_user_password_postgres(email)
    return _get_user_password_sqlite(email)


def _get_user_password_sqlite(email: str):
    conn = _get_sqlite_conn()
    try:
        c = conn.cursor()
        c.execute("SELECT password FROM users WHERE email = ?", (email,))
        row = c.fetchone()
        if row:
            logger.info("[DB] ✓ SQLite user found: %s", email)
            return row["password"]
        logger.warning("[DB] ✗ SQLite user not found: %s", email)
        return None
    finally:
        conn.close()


def _get_user_password_postgres(email: str):
    pool = _get_pg_pool()
    conn = pool.getconn()
    try:
        c = conn.cursor()
        c.execute("SELECT password FROM users WHERE email = %s", (email,))
        row = c.fetchone()
        if row:
            logger.info("[DB] ✓ PostgreSQL user found: %s", email)
            return row[0]
        logger.warning("[DB] ✗ PostgreSQL user not found: %s", email)
        return None
    finally:
        pool.putconn(conn)


# ---------------------------------------------------------------------------
# Insert result
# ---------------------------------------------------------------------------
def insert_result(r: dict):
    if _is_postgres():
        _insert_postgres(r)
    else:
        _insert_sqlite(r)


def _insert_sqlite(r: dict):
    logger.info("[DB] Inserting result into SQLite for: %s", r.get("name"))
    conn = _get_sqlite_conn()
    try:
        c = conn.cursor()
        c.execute("""
            INSERT INTO results
              (name, final_score, semantic_score, skill_score, experience_score,
               matched_skills, missing_skills)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            r.get("name", ""),
            r.get("final_score", 0),
            r.get("semantic_score", 0),
            r.get("skill_score", 0),
            r.get("experience_score", 0),
            json.dumps(r.get("matched_skills", [])),
            json.dumps(r.get("missing_skills", [])),
        ))
        conn.commit()
        logger.info("[DB] ✓ SQLite insert successful for: %s", r.get("name"))
    except Exception as e:
        conn.rollback()
        logger.error("[DB] ✗ SQLite insert failed for %s — %s", r.get("name"), e)
        raise
    finally:
        conn.close()


def _insert_postgres(r: dict):
    logger.info("[DB] Inserting result into PostgreSQL for: %s", r.get("name"))
    import psycopg2
    pool = _get_pg_pool()
    conn = pool.getconn()
    try:
        c = conn.cursor()
        c.execute("""
            INSERT INTO results
              (name, final_score, semantic_score, skill_score, experience_score,
               matched_skills, missing_skills)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            r.get("name", ""),
            r.get("final_score", 0),
            r.get("semantic_score", 0),
            r.get("skill_score", 0),
            r.get("experience_score", 0),
            json.dumps(r.get("matched_skills", [])),
            json.dumps(r.get("missing_skills", [])),
        ))
        conn.commit()
        logger.info("[DB] ✓ PostgreSQL insert successful for: %s", r.get("name"))
    except Exception as e:
        conn.rollback()
        logger.error("[DB] ✗ PostgreSQL insert failed for %s — %s", r.get("name"), e)
        raise
    finally:
        pool.putconn(conn)


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------
def get_all_results(limit: int = 100) -> list:
    logger.info("[DB] Fetching all results (limit=%d)", limit)
    if _is_postgres():
        return _get_all_postgres(limit)
    return _get_all_sqlite(limit)


def _get_all_sqlite(limit: int) -> list:
    logger.info("[DB] Reading from SQLite (limit=%d)", limit)
    conn = _get_sqlite_conn()
    try:
        c = conn.cursor()
        c.execute("SELECT * FROM results ORDER BY created_at DESC LIMIT ?", (limit,))
        rows = c.fetchall()
        logger.info("[DB] ✓ Fetched %d rows from SQLite", len(rows))
        return [_row_to_dict(dict(row)) for row in rows]
    finally:
        conn.close()


def _get_all_postgres(limit: int) -> list:
    logger.info("[DB] Reading from PostgreSQL (limit=%d)", limit)
    pool = _get_pg_pool()
    conn = pool.getconn()
    try:
        c = conn.cursor()
        c.execute("SELECT * FROM results ORDER BY created_at DESC LIMIT %s", (limit,))
        cols = [d[0] for d in c.description]
        rows = c.fetchall()
        logger.info("[DB] ✓ Fetched %d rows from PostgreSQL", len(rows))
        return [_row_to_dict(dict(zip(cols, row))) for row in rows]
    finally:
        pool.putconn(conn)


def _row_to_dict(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "final_score": row["final_score"],
        "semantic_score": row["semantic_score"],
        "skill_score": row["skill_score"],
        "experience_score": row["experience_score"],
        "matched_skills": json.loads(row.get("matched_skills") or "[]"),
        "missing_skills": json.loads(row.get("missing_skills") or "[]"),
        "created_at": str(row.get("created_at", "")),
    }
