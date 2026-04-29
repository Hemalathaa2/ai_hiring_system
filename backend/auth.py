# auth.py:
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import jwt
import os

from database import create_user, get_user_password

router = APIRouter()

SECRET = os.getenv("JWT_SECRET")
pwd = CryptContext(schemes=["bcrypt"])

class User(BaseModel):
    email: EmailStr
    password: str

def create_token(email):
    return jwt.encode({"sub": email}, SECRET, algorithm="HS256")

@router.post("/signup")
def signup(u: User):
    try:
        create_user(u.email, pwd.hash(u.password))
        return {"msg": "created"}
    except:
        raise HTTPException(400, "exists")

@router.post("/login")
def login(u: User):
    db_pass = get_user_password(u.email)
    if not db_pass or not pwd.verify(u.password, db_pass):
        raise HTTPException(401, "invalid")
    return {
    "token": create_token(u.email),
    "email": u.email
}


# """
# auth.py — Production-ready authentication
# Uses database.py for all DB operations so auth and results share the same DB.
# """

# import os
# import sys
# from datetime import datetime, timedelta, timezone

# from fastapi import APIRouter, HTTPException
# from pydantic import BaseModel, EmailStr
# from passlib.context import CryptContext
# from jose import jwt, JWTError
# import logging

# from database import create_user, get_user_password

# logger = logging.getLogger("auth")

# router = APIRouter()

# SECRET = os.getenv("JWT_SECRET")
# if not SECRET:
#     print("FATAL: JWT_SECRET env var not set", file=sys.stderr)
#     sys.exit(1)

# ALGORITHM = "HS256"
# TOKEN_EXPIRE_HOURS = int(os.getenv("TOKEN_EXPIRE_HOURS", "24"))

# pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


# class UserIn(BaseModel):
#     email: EmailStr
#     password: str


# def create_token(email: str) -> str:
#     exp = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
#     token = jwt.encode({"sub": email, "exp": exp}, SECRET, algorithm=ALGORITHM)
#     logger.info("[TOKEN] Created token for %s — expires in %dh", email, TOKEN_EXPIRE_HOURS)
#     return token


# @router.post("/signup")
# def signup(user: UserIn):
#     logger.info("=== [SIGNUP] Attempt — email=%s ===", user.email)

#     password = str(user.password).strip()[:72]
#     if len(password) < 6:
#         logger.warning("[SIGNUP] Rejected — password too short for %s", user.email)
#         raise HTTPException(400, "Password must be at least 6 characters")

#     logger.info("[SIGNUP] Hashing password for %s", user.email)
#     hashed = pwd_ctx.hash(password)

#     try:
#         logger.info("[SIGNUP] Writing user to database: %s", user.email)
#         create_user(user.email, hashed)
#         logger.info("[SIGNUP] ✓ Account created successfully for %s", user.email)
#     except ValueError:
#         logger.warning("[SIGNUP] ✗ Email already exists: %s", user.email)
#         raise HTTPException(400, "An account with this email already exists")
#     except Exception as e:
#         logger.error("[SIGNUP] ✗ Unexpected error for %s — %s", user.email, e)
#         raise HTTPException(500, f"Signup failed: {e}")

#     return {"message": "Account created successfully"}


# @router.post("/login")
# def login(user: UserIn):
#     logger.info("=== [LOGIN] Attempt — email=%s ===", user.email)

#     password = str(user.password).strip()[:72]

#     logger.info("[LOGIN] Looking up user in database: %s", user.email)
#     hashed = get_user_password(user.email)

#     if not hashed:
#         logger.warning("[LOGIN] ✗ User not found: %s", user.email)
#         raise HTTPException(401, "Invalid email or password")

#     logger.info("[LOGIN] Verifying password for %s", user.email)
#     if not pwd_ctx.verify(password, hashed):
#         logger.warning("[LOGIN] ✗ Wrong password for %s", user.email)
#         raise HTTPException(401, "Invalid email or password")

#     logger.info("[LOGIN] ✓ Password verified — generating token for %s", user.email)
#     token = create_token(user.email)
#     logger.info("=== [LOGIN] ✓ Login successful for %s ===", user.email)
#     return {"token": token, "email": user.email}


# @router.get("/me")
# def me(authorization: str = None):
#     logger.info("[ME] Token verification request received")
#     if not authorization or not authorization.startswith("Bearer "):
#         logger.warning("[ME] ✗ Missing or malformed Authorization header")
#         raise HTTPException(401, "Authorization header required")
#     token = authorization.split(" ", 1)[1]
#     try:
#         payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
#         email = payload.get("sub")
#         logger.info("[ME] ✓ Token valid — user=%s", email)
#         return {"email": email}
#     except JWTError as e:
#         logger.warning("[ME] ✗ Token invalid — %s", str(e))
#         raise HTTPException(401, "Invalid or expired token")
