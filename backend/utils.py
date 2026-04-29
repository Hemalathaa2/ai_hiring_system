"""
utils.py — Production-ready resume processing utilities

Production fixes:
1. GROQ_API_KEY validated at import — graceful degradation, no silent crash
2. NLTK stopwords downloaded at runtime if missing
3. Input text truncated to MAX_TEXT_LEN before processing
4. Dynamic avg_dl in BM25 (no more hardcoded 200)
5. generate_explanation wrapped in proper error handling
6. extract_skills uses pre-compiled regex patterns (faster)
7. Logging instead of print statements
"""

import re
import os
import math
import logging
from functools import lru_cache

logger = logging.getLogger("utils")

# NLTK — download stopwords at runtime if not already present
try:
    from nltk.corpus import stopwords
    STOP_WORDS = set(stopwords.words("english"))
    logger.info("[UTILS] NLTK stopwords loaded — %d words", len(STOP_WORDS))
except LookupError:
    import nltk
    logger.warning("[UTILS] NLTK stopwords not found — downloading now")
    nltk.download("stopwords", quiet=True)
    try:
        from nltk.corpus import stopwords
        STOP_WORDS = set(stopwords.words("english"))
        logger.info("[UTILS] NLTK stopwords downloaded and loaded — %d words", len(STOP_WORDS))
    except Exception:
        logger.warning("[UTILS] NLTK stopwords could not be loaded — proceeding without stopword filtering")
        STOP_WORDS = set()

# Groq client — validate key at startup
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    logger.warning("[UTILS] GROQ_API_KEY not set — AI explanations will be disabled")
    client = None
else:
    from groq import Groq
    client = Groq(api_key=GROQ_API_KEY)
    logger.info("[UTILS] ✓ Groq client initialized")

MAX_TEXT_LEN = int(os.getenv("MAX_TEXT_LEN", "8000"))
logger.info("[UTILS] MAX_TEXT_LEN = %d", MAX_TEXT_LEN)

# ---------------------------------------------------------------------------
# Skill dictionary
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Skill dictionary
# ---------------------------------------------------------------------------
SKILL_SET = [
    # Programming languages
    "python", "java", "javascript", "typescript", "kotlin", "swift",
    "ruby", "php", "scala", "matlab", "rust", "perl", "golang",

    # AI/ML
    "machine learning", "deep learning", "natural language processing", "nlp",
    "computer vision", "data science", "data analysis", "data engineering",
    "statistics", "pandas", "numpy", "scikit-learn", "sklearn",
    "tensorflow", "keras", "pytorch", "hugging face", "transformers",
    "spark", "hadoop", "airflow", "mlflow", "mlops", "feature engineering",

    # Databases
    "sql", "mysql", "postgresql", "mongodb", "redis", "elasticsearch",
    "sqlite", "oracle", "cassandra", "dynamodb", "neo4j",

    # Cloud & DevOps
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ansible",
    "jenkins", "github actions", "gitlab", "ci/cd", "linux", "bash",

    # Web
    "html", "css", "react", "angular", "vue", "node.js", "fastapi",
    "django", "flask", "spring boot", "rest api", "graphql", "next.js",

    # Tools
    "excel", "power bi", "tableau", "looker", "matplotlib", "seaborn", "plotly",
    "git", "jira", "confluence", "postman", "jupyter",

    # Soft skills
    "communication", "leadership", "teamwork", "problem solving",
    "project management", "agile", "scrum", "collaboration",

    # -------------------------------------------------------------------------
    # Hardware & VLSI / Design Verification
    # -------------------------------------------------------------------------
    "systemverilog", "system verilog", "verilog", "vhdl",
    "uvm", "universal verification methodology",
    "sv", "rtl", "rtl design", "rtl verification",
    "digital design", "digital logic", "logic design",
    "fpga", "asic", "soc", "ip verification",
    "functional verification", "formal verification",
    "coverage driven verification", "constrained random verification",
    "simulation", "emulation", "synthesis",
    "design verification", "chip verification", "silicon verification",
    "testbench", "test plan", "test case",
    "axi", "ahb", "apb", "pcie", "usb", "i2c", "spi", "uart",
    "amba", "wishbone",
    "questa", "modelsim", "vcs", "xcelium", "incisive",
    "verdi", "dve", "gtkwave",
    "spyglass", "lint", "cdc", "rdc",
    "low power", "power intent", "upf", "cpf",
    "timing analysis", "sta", "primetime",
    "dft", "scan", "bist", "jtag", "boundary scan",
    "embedded systems", "rtos", "firmware",
    "arm", "risc-v", "mips", "x86",
    "c", "c++", "tcl", "perl", "shell scripting",
    "semiconductor", "microcontroller", "microprocessor",
    "cadence", "synopsys", "mentor", "siemens eda",
    "linting", "assertion", "sva", "psl",
    "debug", "waveform", "protocol",

    # -------------------------------------------------------------------------
    # Networking & Security
    # -------------------------------------------------------------------------
    "tcp/ip", "networking", "cybersecurity", "penetration testing",
    "ethical hacking", "firewalls", "vpn", "dns", "dhcp",

    # -------------------------------------------------------------------------
    # Data Engineering / Analytics
    # -------------------------------------------------------------------------
    "etl", "data pipeline", "data warehouse", "bigquery", "snowflake",
    "dbt", "kafka", "flink", "redshift",

    # -------------------------------------------------------------------------
    # Mobile
    # -------------------------------------------------------------------------
    "android", "ios", "flutter", "react native", "xamarin",

    # -------------------------------------------------------------------------
    # Testing & QA
    # -------------------------------------------------------------------------
    "selenium", "pytest", "junit", "testng", "cypress",
    "unit testing", "integration testing", "regression testing",
    "manual testing", "automation testing", "qa",
]

WHOLE_WORD_SKILLS = ["go", "r", "c", "c++", "c#", "rust", "git", "sql", "sv", "rtl"]

_SKILL_PATTERNS = {
    skill: re.compile(r"\b" + re.escape(skill) + r"\b", re.IGNORECASE)
    for skill in SKILL_SET + WHOLE_WORD_SKILLS
}
logger.info("[UTILS] Skill patterns compiled — %d skills tracked", len(_SKILL_PATTERNS))


def extract_skills(text: str) -> set:
    found = set()
    for skill, pattern in _SKILL_PATTERNS.items():
        if pattern.search(text):
            found.add(skill)
    return found


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------
def extract_text_from_pdf(file) -> str:
    import pdfplumber
    logger.info("[EXTRACT] Starting PDF text extraction")
    text = ""
    try:
        with pdfplumber.open(file) as pdf:
            page_count = len(pdf.pages)
            logger.info("[EXTRACT] PDF has %d pages", page_count)
            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text() or ""
                text += page_text + "\n"
                logger.info("[EXTRACT] Page %d/%d — extracted %d chars", i + 1, page_count, len(page_text))
    except Exception as e:
        logger.error("[EXTRACT] PDF extraction failed — %s", e)
        raise ValueError(f"PDF extraction failed: {e}")
    result = text.strip()[:MAX_TEXT_LEN * 2]
    logger.info("[EXTRACT] ✓ PDF extraction complete — total %d chars", len(result))
    return result


def extract_text_from_docx(file) -> str:
    import docx
    logger.info("[EXTRACT] Starting DOCX text extraction")
    try:
        doc = docx.Document(file)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        result = "\n".join(paragraphs)[:MAX_TEXT_LEN * 2]
        logger.info("[EXTRACT] ✓ DOCX extraction complete — %d paragraphs, %d chars",
                    len(paragraphs), len(result))
        return result
    except Exception as e:
        logger.error("[EXTRACT] DOCX extraction failed — %s", e)
        raise ValueError(f"DOCX extraction failed: {e}")


# ---------------------------------------------------------------------------
# Preprocessing
# ---------------------------------------------------------------------------
def preprocess(text: str) -> str:
    original_len = len(text)
    text = text[:MAX_TEXT_LEN]
    text = text.lower()
    text = re.sub(r"[^a-z0-9+.#\-/ ]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    logger.info("[PREPROCESS] Input %d chars → output %d chars", original_len, len(text))
    return text


# ---------------------------------------------------------------------------
# Experience extraction
# ---------------------------------------------------------------------------
def extract_experience(text: str) -> float:
    text = text.lower()
    matches = re.findall(r"(\d+)\+?\s*(?:years?|yrs?)(?:\s+of\s+experience)?", text)
    if matches:
        result = max(int(m) for m in matches)
        logger.info("[EXPERIENCE] Detected %d years of experience", result)
        return result
    logger.info("[EXPERIENCE] No experience years detected — defaulting to 0")
    return 0


# ---------------------------------------------------------------------------
# Tokenizer
# ---------------------------------------------------------------------------
def _tokenize(text: str) -> list:
    text = text.lower()
    text = re.sub(r"[^a-z0-9 ]", " ", text)
    return [w for w in text.split() if w not in STOP_WORDS and len(w) > 2]


# ---------------------------------------------------------------------------
# BM25-style semantic scoring
# ---------------------------------------------------------------------------
def _compute_semantic_score(jd_text: str, resume_text: str) -> float:
    jd_tokens = _tokenize(jd_text)
    res_tokens = _tokenize(resume_text)

    logger.info("[SEMANTIC] JD tokens: %d | Resume tokens: %d", len(jd_tokens), len(res_tokens))

    if not jd_tokens or not res_tokens:
        logger.warning("[SEMANTIC] Empty tokens — returning default score 0.3")
        return 0.3

    jd_set = set(jd_tokens)
    res_set = set(res_tokens)

    res_freq: dict = {}
    for t in res_tokens:
        res_freq[t] = res_freq.get(t, 0) + 1

    k1, b = 1.5, 0.75
    avg_dl = max(len(res_tokens), 100)
    dl = len(res_tokens)

    score = 0.0
    max_score = 0.0

    for term in jd_set:
        idf = math.log(1 + 1.0 / (1.0 / len(jd_set) + 0.01))
        tf = res_freq.get(term, 0)
        tf_norm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / avg_dl)) if tf > 0 else 0
        score += idf * tf_norm
        tf_max = 3
        tf_norm_max = (tf_max * (k1 + 1)) / (tf_max + k1 * (1 - b + b * dl / avg_dl))
        max_score += idf * tf_norm_max

    if max_score == 0:
        logger.warning("[SEMANTIC] max_score is 0 — returning default 0.3")
        return 0.3

    normalized = min(score / max_score, 1.0)
    intersection = len(jd_set & res_set)
    union = len(jd_set | res_set)
    jaccard = intersection / union if union > 0 else 0
    final = 0.7 * normalized + 0.3 * jaccard
    final = 0.1 + 0.85 * final

    logger.info("[SEMANTIC] BM25=%.4f | Jaccard=%.4f | Final=%.4f", normalized, jaccard, final)
    return round(float(final), 4)


# ---------------------------------------------------------------------------
# Main scoring function
# ---------------------------------------------------------------------------

def compute_detailed_score(jd_text: str, resume_text: str, **kwargs) -> dict:
    logger.info("[SCORE] Starting detailed scoring")

    logger.info("[SCORE] Computing semantic score")
    semantic = _compute_semantic_score(jd_text, resume_text)

    # Use raw text for skill extraction if provided,
    # otherwise fall back to whatever text was passed in
    raw_jd     = kwargs.get("raw_jd", jd_text)
    raw_resume = kwargs.get("raw_resume", resume_text)

    logger.info("[SCORE] Extracting skills from raw text (raw_jd=%d chars, raw_resume=%d chars)",
                len(raw_jd), len(raw_resume))
    jd_skills  = extract_skills(raw_jd)
    res_skills = extract_skills(raw_resume)
    matched = jd_skills & res_skills
    missing = jd_skills - res_skills
    skill_score = len(matched) / len(jd_skills) if jd_skills else 0.5
    logger.info("[SCORE] JD skills: %d | Resume skills: %d | Matched: %d | Missing: %d",
                len(jd_skills), len(res_skills), len(matched), len(missing))
    logger.info("[SCORE] Matched skills list: %s", sorted(matched))
    logger.info("[SCORE] Missing skills list: %s", sorted(missing))

    logger.info("[SCORE] Extracting experience")
    jd_exp  = extract_experience(jd_text)
    res_exp = extract_experience(resume_text)
    logger.info("[SCORE] JD requires %d yrs | Resume has %d yrs", jd_exp, res_exp)

    if jd_exp > 0:
        exp_score = min(res_exp / jd_exp, 1.0)
    else:
        exp_score = min(0.5 + res_exp * 0.05, 1.0)

    final = 0.50 * semantic + 0.35 * skill_score + 0.15 * exp_score
    logger.info("[SCORE] Final=%.4f | Semantic=%.4f (50%%) | Skill=%.4f (35%%) | Exp=%.4f (15%%)",
                final, semantic, skill_score, exp_score)

    return {
        "final_score":      round(final, 4),
        "semantic_score":   round(semantic, 4),
        "skill_score":      round(skill_score, 4),
        "experience_score": round(exp_score, 4),
        "matched_skills":   sorted(matched),
        "missing_skills":   sorted(missing),
        "llm_explanation":  None,
    }


# ---------------------------------------------------------------------------
# LLM explanation
# ---------------------------------------------------------------------------
GROQ_MODELS = [
    "llama-3.1-8b-instant",
    "llama3-70b-8192",
    "gemma2-9b-it",
]


def generate_explanation(jd: str, resume: str, score: dict) -> str:
    if not client:
        logger.warning("[LLM] Groq client not available — skipping explanation")
        return "AI explanation unavailable (GROQ_API_KEY not configured)."

    logger.info("[LLM] Generating explanation — final_score=%.2f", score.get("final_score", 0))

    prompt = f"""You are a professional recruiter. Analyze this candidate against the job description.

Job Description:
{jd[:600]}

Candidate Resume:
{resume[:600]}

Match Scores:
- Overall: {score['final_score'] * 100:.0f}%
- Semantic relevance: {score['semantic_score'] * 100:.0f}%
- Skill match: {score['skill_score'] * 100:.0f}%
- Experience: {score['experience_score'] * 100:.0f}%
- Matched skills: {', '.join(score.get('matched_skills', [])) or 'none detected'}
- Missing skills: {', '.join(score.get('missing_skills', [])) or 'none'}

Write a concise 3-bullet assessment:
- Strengths: [key strengths relevant to this JD]
- Gaps: [missing skills or experience gaps]
- Decision: [Shortlist / Consider / Reject] — [one sentence reason]"""

    last_error = ""
    for model in GROQ_MODELS:
        logger.info("[LLM] Trying model: %s", model)
        try:
            r = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=280,
                temperature=0.4,
            )
            result = r.choices[0].message.content.strip()
            logger.info("[LLM] ✓ Explanation generated using model: %s (%d chars)", model, len(result))
            return result
        except Exception as e:
            last_error = str(e)
            logger.warning("[LLM] ✗ Model %s failed — %s", model, e)
            continue

    logger.error("[LLM] All Groq models failed — last error: %s", last_error)
    return f"AI explanation unavailable. ({last_error[:100]})"


def get_embeddings_batch(text_list: list):
    return [None] * len(text_list)
