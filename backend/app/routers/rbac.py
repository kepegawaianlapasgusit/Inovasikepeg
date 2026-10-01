from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from ..db import db, now_iso, new_id, clean, log_audit
from ..security import require, get_current_user, hash_password, ALL_PERMISSION_KEYS

router = APIRouter(prefix="/api", tags=["rbac"])


# ---------------- Roles ----------------
class RoleIn(BaseModel):
    name: str
    description: Optional[str] = ""
    permissions: List[str] = []


@router.get("/roles")
async def list_roles(user: dict = Depends(require("role.manage", "user.manage", "permission.manage"))):
    return [clean(r) async for r in db.roles.find({"deleted": {"$ne": True}}).sort("created_at", 1)]


@router.post("/roles")
async def create_role(body: RoleIn, request: Request, user: dict = Depends(require("role.manage"))):
    doc = {"id": new_id(), "name": body.name, "description": body.description,
           "permissions": [p for p in body.permissions if p in ALL_PERMISSION_KEYS or p == "*"],
           "system": False, "is_active": True, "deleted": False, "created_at": now_iso()}
    await db.roles.insert_one(dict(doc))
    await log_audit(user, "CREATE", "Role", obj=body.name, after=body.permissions, request=request)
    return clean(doc)


@router.put("/roles/{role_id}")
async def update_role(role_id: str, body: RoleIn, request: Request, user: dict = Depends(require("role.manage"))):
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(404, "Role tidak ditemukan")
    update = {"name": body.name, "description": body.description, "updated_at": now_iso()}
    if role.get("permissions") != ["*"]:
        update["permissions"] = [p for p in body.permissions if p in ALL_PERMISSION_KEYS]
    await db.roles.update_one({"id": role_id}, {"$set": update})
    await log_audit(user, "EDIT", "Role", obj=body.name, before=role.get("permissions"), after=update.get("permissions"), request=request)
    return clean(await db.roles.find_one({"id": role_id}))


@router.delete("/roles/{role_id}")
async def delete_role(role_id: str, request: Request, user: dict = Depends(require("role.manage"))):
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(404, "Role tidak ditemukan")
    if role.get("system"):
        raise HTTPException(400, "Role sistem tidak dapat dihapus")
    await db.roles.update_one({"id": role_id}, {"$set": {"deleted": True, "is_active": False}})
    await log_audit(user, "DELETE", "Role", obj=role.get("name"), request=request)
    return {"ok": True}


# ---------------- Users ----------------
class UserIn(BaseModel):
    name: str
    email: EmailStr
    username: Optional[str] = None
    password: Optional[str] = None
    role_ids: List[str] = []
    extra_permissions: List[str] = []
    employee_id: Optional[str] = None
    is_active: bool = True


class UserUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    role_ids: Optional[List[str]] = None
    extra_permissions: Optional[List[str]] = None
    employee_id: Optional[str] = None
    is_active: Optional[bool] = None


class ResetPasswordIn(BaseModel):
    new_password: str


def _safe_user(u):
    u = clean(u)
    if u:
        u.pop("password_hash", None)
    return u


@router.get("/users")
async def list_users(user: dict = Depends(require("user.manage"))):
    out = []
    roles = {r["id"]: r["name"] async for r in db.roles.find({})}
    async for u in db.users.find({"deleted": {"$ne": True}}).sort("created_at", 1):
        u = _safe_user(u)
        u["role_names"] = [roles.get(rid, rid) for rid in u.get("role_ids", [])]
        out.append(u)
    return out


@router.post("/users")
async def create_user(body: UserIn, request: Request, user: dict = Depends(require("user.manage"))):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email sudah terdaftar")
    if not body.password or len(body.password) < 6:
        raise HTTPException(400, "Password minimal 6 karakter")
    doc = {
        "id": new_id(), "name": body.name, "email": email, "username": body.username,
        "password_hash": hash_password(body.password), "role_ids": body.role_ids,
        "extra_permissions": [p for p in body.extra_permissions if p in ALL_PERMISSION_KEYS],
        "employee_id": body.employee_id, "is_active": body.is_active,
        "deleted": False, "created_at": now_iso(),
    }
    await db.users.insert_one(dict(doc))
    await log_audit(user, "CREATE", "User", obj=email, after={"roles": body.role_ids}, request=request)
    return _safe_user(doc)


@router.put("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate, request: Request, user: dict = Depends(require("user.manage"))):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User tidak ditemukan")
    update = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "extra_permissions" in update:
        update["extra_permissions"] = [p for p in update["extra_permissions"] if p in ALL_PERMISSION_KEYS]
    update["updated_at"] = now_iso()
    await db.users.update_one({"id": user_id}, {"$set": update})
    await log_audit(user, "EDIT", "User", obj=target.get("email"), before={"roles": target.get("role_ids")}, after=update, request=request)
    return _safe_user(await db.users.find_one({"id": user_id}))


@router.post("/users/{user_id}/reset-password")
async def reset_password(user_id: str, body: ResetPasswordIn, request: Request, user: dict = Depends(require("user.manage"))):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User tidak ditemukan")
    if len(body.new_password) < 6:
        raise HTTPException(400, "Password minimal 6 karakter")
    await db.users.update_one({"id": user_id}, {"$set": {"password_hash": hash_password(body.new_password)}})
    await log_audit(user, "RESET_PASSWORD", "User", obj=target.get("email"), request=request)
    return {"ok": True}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request, user: dict = Depends(require("user.manage"))):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User tidak ditemukan")
    if user_id == user["id"]:
        raise HTTPException(400, "Tidak dapat menghapus akun sendiri")
    await db.users.update_one({"id": user_id}, {"$set": {"deleted": True, "is_active": False}})
    await log_audit(user, "DELETE", "User", obj=target.get("email"), request=request)
    return {"ok": True}


# ---------------- Operator & Evaluator assignments ----------------
class OperatorAssignIn(BaseModel):
    user_id: str
    attendance_type_ids: List[str] = []


@router.get("/attendance-operators")
async def list_operators(user: dict = Depends(require("user.manage", "attendance.create"))):
    return [clean(o) async for o in db.attendance_operators.find({})]


@router.post("/attendance-operators")
async def set_operator(body: OperatorAssignIn, request: Request, user: dict = Depends(require("user.manage"))):
    await db.attendance_operators.update_one(
        {"user_id": body.user_id},
        {"$set": {"user_id": body.user_id, "attendance_type_ids": body.attendance_type_ids, "updated_at": now_iso()}},
        upsert=True,
    )
    await log_audit(user, "ASSIGN_OPERATOR", "User", obj=body.user_id, after=body.attendance_type_ids, request=request)
    return {"ok": True}


class EvaluatorAssignIn(BaseModel):
    evaluator_user_id: str
    employee_ids: List[str] = []


@router.get("/evaluator-assignments")
async def list_evaluators(user: dict = Depends(require("user.manage", "evaluation.view"))):
    return [clean(o) async for o in db.evaluator_assignments.find({})]


@router.post("/evaluator-assignments")
async def set_evaluator(body: EvaluatorAssignIn, request: Request, user: dict = Depends(require("user.manage"))):
    await db.evaluator_assignments.update_one(
        {"evaluator_user_id": body.evaluator_user_id},
        {"$set": {"evaluator_user_id": body.evaluator_user_id, "employee_ids": body.employee_ids, "updated_at": now_iso()}},
        upsert=True,
    )
    await log_audit(user, "ASSIGN_EVALUATOR", "User", obj=body.evaluator_user_id, after=body.employee_ids, request=request)
    return {"ok": True}
