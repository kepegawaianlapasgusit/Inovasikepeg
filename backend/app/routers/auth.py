import os
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request, Depends, Response
from pydantic import BaseModel, EmailStr
from ..db import db, now_iso, log_audit
from ..security import (
    verify_password, hash_password, create_access_token, get_current_user,
    PERMISSION_CATALOG, MENU,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

MAX_ATTEMPTS = 5
LOCKOUT_MIN = 15


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str


async def _public_user(user: dict) -> dict:
    user.pop("password_hash", None)
    return user


@router.post("/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    now = datetime.now(timezone.utc)
    if attempt and attempt.get("count", 0) >= MAX_ATTEMPTS:
        locked_until = attempt.get("locked_until")
        if locked_until and datetime.fromisoformat(locked_until) > now:
            raise HTTPException(status_code=429, detail="Terlalu banyak percobaan. Coba lagi dalam beberapa menit.")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"locked_until": (now + timedelta(minutes=LOCKOUT_MIN)).isoformat()}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Email atau password salah")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan. Hubungi Super Admin.")

    await db.login_attempts.delete_one({"identifier": identifier})
    token = create_access_token(user["id"], user["email"])
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_login": now_iso()}})
    await log_audit(user, "LOGIN", "Authentication", obj=user["email"], request=request)
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none",
                        max_age=int(os.environ.get("TOKEN_TTL_HOURS", "8")) * 3600, path="/")
    return {"access_token": token, "token_type": "bearer", "user": await _public_user(user)}


@router.post("/logout")
async def logout(request: Request, response: Response, user: dict = Depends(get_current_user)):
    await log_audit(user, "LOGOUT", "Authentication", obj=user["email"], request=request)
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    employee = None
    if user.get("employee_id"):
        employee = await db.employees.find_one({"id": user["employee_id"]}, {"_id": 0})
    return {
        "user": user,
        "employee": employee,
        "permissions": user.get("permissions", []),
        "is_super": user.get("is_super", False),
        "menu": MENU,
        "permission_catalog": PERMISSION_CATALOG,
    }


@router.post("/change-password")
async def change_password(body: ChangePasswordIn, request: Request, user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if not verify_password(body.old_password, full.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Password lama salah")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password baru minimal 6 karakter")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    await log_audit(user, "CHANGE_PASSWORD", "Authentication", obj=user["email"], request=request)
    return {"ok": True}
