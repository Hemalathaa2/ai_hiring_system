"""
api.py — Production-ready FastAPI backend
"""

import uuid
import io
import os
import logging
import sys
import contextvars
import sqlite3
from database import init_db, insert_result, get_all_results, _is_postgres, _get_pg_pool
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from utils import (
    preprocess, extract_text_from_pdf, extract_text_from_docx,
    compute_detailed_score, generate_explanation
)
from database import init_db, insert_result, get_all_results
from auth import router as auth_router

# ---------------------------------------------------------------------------
# Request ID — must be set up BEFORE logging so every record has request_id
# ---------------------------------------------------------------------------
_request_id: contextvars.ContextVar = contextvars.ContextVar("request_id", default="-")

_old_factory = logging.getLogRecordFactory()
def _record_factory(*args, **kwargs):
    record = _old_factory(*args, **kwargs)
    record.request_id = _request_id.get("-")
    return record
logging.setLogRecordFactory(_record_factory)

# ---------------------------------------------------------------------------
# Logging — configured AFTER record_factory is in place
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger("api")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    logger.error("FATAL: JWT_SECRET env var not set — refusing to start")
    sys.exit(1)

ALGORITHM = "HS256"
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
MAX_FILE_MB = int(os.getenv("MAX_FILE_MB", "10"))
MAX_RESUMES = int(os.getenv("MAX_RESUMES", "50"))

logger.info("=== API Configuration ===")
logger.info("ALLOWED_ORIGINS: %s", ALLOWED_ORIGINS)
logger.info("MAX_FILE_MB: %s", MAX_FILE_MB)
logger.info("MAX_RESUMES: %s", MAX_RESUMES)
logger.info("=========================")

# ---------------------------------------------------------------------------
# In-memory job store
# ---------------------------------------------------------------------------
_MEMORY_STORE: dict = {}

def _job_set(job_id: str, data: dict, ttl: int = 3600):
    _MEMORY_STORE[job_id] = data
    logger.info("[JOB STORE] Set job_id=%s status=%s", job_id, data.get("status"))

def _job_get(job_id: str) -> Optional[dict]:
    data = _MEMORY_STORE.get(job_id)
    if data:
        logger.info("[JOB STORE] Get job_id=%s status=%s", job_id, data.get("status"))
    else:
        logger.warning("[JOB STORE] Get job_id=%s — NOT FOUND", job_id)
    return data

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="AI Hiring System API", version="3.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, lambda req, exc: HTTPException(429, "Rate limit exceeded"))
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

Instrumentator().instrument(app).expose(app)
app.include_router(auth_router, prefix="/auth")

# ---------------------------------------------------------------------------
# Request ID middleware
# ---------------------------------------------------------------------------
@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    rid = str(uuid.uuid4())[:8]
    _request_id.set(rid)
    logger.info(">>> INCOMING REQUEST [%s] %s %s | client=%s",
                rid, request.method, request.url.path,
                request.client.host if request.client else "unknown")
    response = await call_next(request)
    logger.info("<<< RESPONSE [%s] %s %s | status=%s",
                rid, request.method, request.url.path, response.status_code)
    response.headers["X-Request-ID"] = rid
    return response

# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------
_http_bearer = HTTPBearer(auto_error=False)

def require_auth(creds: HTTPAuthorizationCredentials = Depends(_http_bearer)):
    if not creds:
        logger.warning("[AUTH] No credentials provided — rejecting request")
        raise HTTPException(401, "Authorization header required")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[ALGORITHM])
        logger.info("[AUTH] Token valid — user=%s", payload.get("sub", "unknown"))
    except JWTError as e:
        logger.warning("[AUTH] Token validation failed — %s", str(e))
        raise HTTPException(401, "Invalid or expired token")

# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
@app.on_event("startup")
def startup():
    logger.info("=== SERVER STARTING UP ===")
    init_db()
    logger.info("[STARTUP] Database initialized successfully")
    logger.info("=== SERVER READY — Waiting for requests ===")

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/")
def home():
    logger.info("[HOME] Ping received")
    return {"status": "API Running", "version": "3.0"}

@app.get("/health")
def health():
    logger.info("[HEALTH] Health check called")
    return {"status": "ok"}

@app.get("/debug/results")
def debug_results():
    return get_all_results(10)

# ---------------------------------------------------------------------------
# Job status
# ---------------------------------------------------------------------------
@app.get("/job/{job_id}")
def get_job(job_id: str):
    logger.info("[POLL] Polling job_id=%s", job_id)
    job = _job_get(job_id)
    if not job:
        logger.warning("[POLL] job_id=%s not found", job_id)
        raise HTTPException(404, "Job not found")
    logger.info("[POLL] job_id=%s status=%s", job_id, job.get("status"))
    return job

# ---------------------------------------------------------------------------
# Analyze endpoint
# ---------------------------------------------------------------------------
@app.post("/analyze/")
@limiter.limit("5/minute")
async def analyze(
    request: Request,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    jd_text: Optional[str] = Form(None),
    jd_file: Optional[UploadFile] = File(None),
    openings: int = Form(5),
    _=Depends(require_auth),
):
    logger.info("=== [ANALYZE] New analysis request received ===")
    logger.info("[ANALYZE] Files uploaded: %d | Openings: %d", len(files), openings)

    if not jd_text and not jd_file:
        logger.warning("[ANALYZE] Rejected — no JD provided")
        raise HTTPException(400, "Provide either jd_text or jd_file")

    if len(files) == 0:
        logger.warning("[ANALYZE] Rejected — no resume files")
        raise HTTPException(400, "At least one resume is required")

    if len(files) > MAX_RESUMES:
        logger.warning("[ANALYZE] Rejected — too many files: %d", len(files))
        raise HTTPException(400, f"Maximum {MAX_RESUMES} resumes per batch")

    # Read the raw JD text — DO NOT preprocess here, keep original for LLM
    effective_jd_raw = ""
    if jd_file and not jd_text:
        logger.info("[ANALYZE] Reading JD from file: %s", jd_file.filename)
        jd_bytes = await jd_file.read()
        fname = jd_file.filename.lower()
        if fname.endswith(".pdf"):
            logger.info("[ANALYZE] Extracting JD from PDF")
            effective_jd_raw = extract_text_from_pdf(io.BytesIO(jd_bytes))
        elif fname.endswith(".docx"):
            logger.info("[ANALYZE] Extracting JD from DOCX")
            effective_jd_raw = extract_text_from_docx(io.BytesIO(jd_bytes))
        else:
            effective_jd_raw = jd_bytes.decode("utf-8", errors="ignore")
        logger.info("[ANALYZE] JD extracted from file — %d chars", len(effective_jd_raw))
    else:
        effective_jd_raw = jd_text.strip()
        logger.info("[ANALYZE] JD from text input — %d chars", len(effective_jd_raw))

    if not effective_jd_raw:
        raise HTTPException(400, "Job description is required")
    if len(effective_jd_raw) < 50:
        raise HTTPException(400, "Job description is too short (min 50 characters)")

    # Read file bytes now — UploadFile streams close after response
    file_data = []
    for f in files:
        logger.info("[ANALYZE] Reading resume: %s", f.filename)
        content = await f.read()
        if len(content) > MAX_FILE_MB * 1024 * 1024:
            logger.warning("[ANALYZE] File too large: %s", f.filename)
            raise HTTPException(400, f"{f.filename} exceeds {MAX_FILE_MB}MB limit")
        fname_lower = f.filename.lower()
        if not (fname_lower.endswith(".pdf") or fname_lower.endswith(".docx")):
            raise HTTPException(400, f"{f.filename} is not a PDF or DOCX file")
        file_data.append({"content": content, "filename": f.filename})
        logger.info("[ANALYZE] ✓ Accepted: %s (%d KB)", f.filename, len(content) // 1024)

    job_id = str(uuid.uuid4())
    _job_set(job_id, {"status": "processing", "results": None, "message": ""})

    # Pass raw JD text to background task — preprocessing happens inside
    background_tasks.add_task(_process_job, job_id, file_data, effective_jd_raw, openings)
    logger.info("[ANALYZE] Job %s queued — %d resumes", job_id, len(file_data))

    return {"job_id": job_id, "status": "processing"}

# ---------------------------------------------------------------------------
# Background job processor
# ---------------------------------------------------------------------------
def _process_job(job_id: str, file_data: list, jd_text_raw: str, openings: int = 5):
    """
    jd_text_raw — original unprocessed JD text
                  used as-is for LLM explanation
                  preprocessed separately for scoring
    """
    _request_id.set(job_id[:8])
    logger.info("=== [JOB %s] Background processing started ===", job_id)
    logger.info("[JOB %s] Total resumes: %d | Openings: %d", job_id, len(file_data), openings)

    try:
        texts_clean = []   # preprocessed text — used for scoring
        texts_raw   = []   # original text — used for LLM explanation
        names       = []

        # Step 1: Extract and store BOTH raw and clean text per resume
        logger.info("[JOB %s] STEP 1 — Extracting text from resumes", job_id)
        for item in file_data:
            logger.info("[JOB %s] Extracting: %s", job_id, item["filename"])
            try:
                buf = io.BytesIO(item["content"])
                fname = item["filename"].lower()

                if fname.endswith(".pdf"):
                    logger.info("[JOB %s] Parsing PDF: %s", job_id, item["filename"])
                    raw = extract_text_from_pdf(buf)
                elif fname.endswith(".docx"):
                    logger.info("[JOB %s] Parsing DOCX: %s", job_id, item["filename"])
                    raw = extract_text_from_docx(buf)
                else:
                    logger.info("[JOB %s] Parsing plain text: %s", job_id, item["filename"])
                    raw = item["content"].decode("utf-8", errors="ignore")

                clean = preprocess(raw)
                logger.info("[JOB %s] Extracted %d chars (clean: %d) from %s",
                            job_id, len(raw), len(clean), item["filename"])

                if len(clean) > 50:
                    texts_raw.append(raw)       # original — for LLM
                    texts_clean.append(clean)   # preprocessed — for scoring
                    names.append(item["filename"])
                    logger.info("[JOB %s] ✓ Accepted: %s", job_id, item["filename"])
                else:
                    logger.warning("[JOB %s] ✗ Skipped (too little text): %s",
                                   job_id, item["filename"])
            except Exception as e:
                logger.warning("[JOB %s] ✗ Failed to parse %s — %s", job_id, item["filename"], e)

        if not texts_clean:
            logger.error("[JOB %s] No readable resumes — aborting", job_id)
            _job_set(job_id, {
                "status": "error",
                "message": "No readable text found in any resume. Ensure files are not scanned images.",
            })
            return

        logger.info("[JOB %s] Extraction complete — %d/%d readable",
                    job_id, len(texts_clean), len(file_data))

        # Step 2: Preprocess JD for scoring only
        logger.info("[JOB %s] STEP 2 — Preprocessing JD for scoring", job_id)
        jd_clean = preprocess(jd_text_raw)
        logger.info("[JOB %s] JD preprocessed — %d chars", job_id, len(jd_clean))

        # Step 3: Score using clean text, store raw text on result for LLM
        logger.info("[JOB %s] STEP 3 — Scoring %d candidates", job_id, len(texts_clean))
        results = []
        for i, (clean, raw, name) in enumerate(zip(texts_clean, texts_raw, names)):
            logger.info("[JOB %s] Scoring %d/%d: %s", job_id, i + 1, len(texts_clean), name)

            # ✅ Pass raw texts so skill extraction runs on original readable content
            score = compute_detailed_score(
                jd_clean, clean,
                raw_jd=jd_text_raw,
                raw_resume=raw
            )

            score["name"] = name
            score["_raw_text"] = raw
            results.append(score)
            logger.info(
                "[JOB %s] %s — final=%.2f | semantic=%.2f | skill=%.2f | exp=%.2f",
                job_id, name,
                score["final_score"], score["semantic_score"],
                score["skill_score"], score["experience_score"]
            )
            logger.info("[JOB %s] Matched: %s", job_id, score.get("matched_skills", []))
            logger.info("[JOB %s] Missing: %s", job_id, score.get("missing_skills", []))

        # Step 4: Sort
        logger.info("[JOB %s] STEP 4 — Sorting by final score", job_id)
        results.sort(key=lambda x: x["final_score"], reverse=True)
        for i, r in enumerate(results):
            logger.info("[JOB %s]   #%d %s — %.1f%%",
                        job_id, i + 1, r["name"], r["final_score"] * 100)

        # Step 5: AI explanations for top 3 using RAW text + RAW JD
        logger.info("[JOB %s] STEP 5 — Generating AI explanations for top 3", job_id)
        for i in range(min(3, len(results))):
            candidate_name = results[i]["name"]
            candidate_raw  = results[i].get("_raw_text", "")
            logger.info("[JOB %s] Calling LLM for #%d: %s (resume=%d chars, jd=%d chars)",
                        job_id, i + 1, candidate_name, len(candidate_raw), len(jd_text_raw))
            try:
                explanation = generate_explanation(jd_text_raw, candidate_raw, results[i])
                results[i]["llm_explanation"] = explanation
                logger.info("[JOB %s] ✓ LLM explanation for %s: %s...",
                            job_id, candidate_name, explanation[:80])
            except Exception as e:
                logger.warning("[JOB %s] ✗ LLM failed for %s — %s", job_id, candidate_name, e)
                results[i]["llm_explanation"] = "AI explanation unavailable."

        # Candidates beyond top 3 get no explanation
        for i in range(3, len(results)):
            results[i]["llm_explanation"] = None

        # Step 6: Strip internal field and save to DB
        logger.info("[JOB %s] STEP 6 — Saving to database", job_id)
        for r in results:
            r.pop("_raw_text", None)   # remove internal field before DB insert + response
            try:
                insert_result(r)
                logger.info("[JOB %s] ✓ DB saved: %s", job_id, r.get("name"))
            except Exception as e:
                logger.error("[JOB %s] ✗ DB failed for %s — %s", job_id, r.get("name"), e)

        _job_set(job_id, {"status": "done", "results": results, "message": ""})
        logger.info("=== [JOB %s] COMPLETE — %d candidates ranked ===", job_id, len(results))

    except Exception as e:
        logger.exception("=== [JOB %s] FAILED — %s ===", job_id, e)
        _job_set(job_id, {"status": "error", "results": None, "message": str(e)})

# ---------------------------------------------------------------------------
# Debug routes — view DB contents directly in browser
# ---------------------------------------------------------------------------
@app.get("/debug/users")
def debug_users():
    """View all registered users (passwords hidden)"""
    if _is_postgres():
        pool = _get_pg_pool()
        conn = pool.getconn()
        try:
            c = conn.cursor()
            c.execute("SELECT id, email, created_at FROM users ORDER BY created_at DESC")
            cols = [d[0] for d in c.description]
            rows = c.fetchall()
            return {"count": len(rows), "users": [dict(zip(cols, r)) for r in rows]}
        finally:
            pool.putconn(conn)
    else:
        conn = sqlite3.connect("candidates.db")
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT id, email, created_at FROM users ORDER BY created_at DESC")
        rows = c.fetchall()
        conn.close()
        return {"count": len(rows), "users": [dict(r) for r in rows]}


@app.get("/debug/results")
def debug_results():
    """View last 20 analysis results"""
    results = get_all_results(20)
    return {"count": len(results), "results": results}


@app.get("/debug/stats")
def debug_stats():
    """Summary stats — how many users, how many results"""
    if _is_postgres():
        pool = _get_pg_pool()
        conn = pool.getconn()
        try:
            c = conn.cursor()
            c.execute("SELECT COUNT(*) FROM users")
            user_count = c.fetchone()[0]
            c.execute("SELECT COUNT(*) FROM results")
            result_count = c.fetchone()[0]
            c.execute("SELECT AVG(final_score) FROM results")
            avg_score = c.fetchone()[0]
        finally:
            pool.putconn(conn)
    else:
        conn = sqlite3.connect("candidates.db")
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM users")
        user_count = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM results")
        result_count = c.fetchone()[0]
        c.execute("SELECT AVG(final_score) FROM results")
        avg_score = c.fetchone()[0]
        conn.close()

    return {
        "total_users": user_count,
        "total_results": result_count,
        "average_score": round(avg_score * 100, 1) if avg_score else 0,
        "database": "PostgreSQL" if _is_postgres() else "SQLite (candidates.db)",
    }