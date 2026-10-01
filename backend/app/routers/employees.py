from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from ..db import db, now_iso, new_id, clean, log_audit
from ..security import require, get_current_user, has_perm

router = APIRouter(prefix="/api/employees", tags=["employees"])


class EmployeeIn(BaseModel):
    nip: str
    name: str
    gelar: Optional[str] = ""
    nik: Optional[str] = ""
    tempat_lahir: Optional[str] = ""
    tanggal_lahir: Optional[str] = ""
    jenis_kelamin: Optional[str] = ""
    alamat: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    pendidikan: Optional[str] = ""
    grade_id: Optional[str] = None
    position_id: Optional[str] = None
    unit_id: Optional[str] = None
    section_id: Optional[str] = None
    team_id: Optional[str] = None
    status_kepegawaian: Optional[str] = "Aktif"
    tmt_kerja: Optional[str] = ""
    tanggal_pensiun: Optional[str] = ""
    foto_url: Optional[str] = None


async def _enrich(emp: dict) -> dict:
    async def nm(coll, _id):
        if not _id:
            return None
        d = await db[coll].find_one({"id": _id}, {"_id": 0, "name": 1})
        return d["name"] if d else None
    emp["unit_name"] = await nm("organizational_units", emp.get("unit_id"))
    emp["section_name"] = await nm("sections", emp.get("section_id"))
    emp["position_name"] = await nm("positions", emp.get("position_id"))
    emp["team_name"] = await nm("teams", emp.get("team_id"))
    g = await db.grades.find_one({"id": emp.get("grade_id")}, {"_id": 0}) if emp.get("grade_id") else None
    emp["grade_name"] = g["name"] if g else None
    emp["pangkat"] = g.get("pangkat") if g else None
    return emp


def _can_view_all(user):
    return has_perm(user, "employee.view_all") or user.get("is_super")


@router.get("")
async def list_employees(
    q: Optional[str] = None, unit_id: Optional[str] = None, section_id: Optional[str] = None,
    status: Optional[str] = None, page: int = 1, limit: int = 20,
    user: dict = Depends(require("employee.view")),
):
    query: Dict[str, Any] = {"deleted": {"$ne": True}}
    if not _can_view_all(user):
        # self scope only
        if not user.get("employee_id"):
            return {"items": [], "total": 0, "page": page, "limit": limit}
        query["id"] = user["employee_id"]
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"nip": {"$regex": q, "$options": "i"}}]
    if unit_id:
        query["unit_id"] = unit_id
    if section_id:
        query["section_id"] = section_id
    if status:
        query["status_kepegawaian"] = status
    total = await db.employees.count_documents(query)
    cursor = db.employees.find(query, {"_id": 0}).sort("name", 1).skip((page - 1) * limit).limit(limit)
    items = [await _enrich(e) async for e in cursor]
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/{emp_id}")
async def get_employee(emp_id: str, user: dict = Depends(require("employee.view"))):
    if not _can_view_all(user) and user.get("employee_id") != emp_id:
        raise HTTPException(403, "Akses ditolak")
    emp = await db.employees.find_one({"id": emp_id, "deleted": {"$ne": True}}, {"_id": 0})
    if not emp:
        raise HTTPException(404, "Pegawai tidak ditemukan")
    return await _enrich(emp)


@router.post("")
async def create_employee(body: EmployeeIn, request: Request, user: dict = Depends(require("employee.create"))):
    if await db.employees.find_one({"nip": body.nip, "deleted": {"$ne": True}}):
        raise HTTPException(400, "NIP sudah terdaftar")
    doc = {**body.model_dump(), "id": new_id(), "deleted": False, "created_at": now_iso()}
    await db.employees.insert_one(dict(doc))
    await log_audit(user, "CREATE", "Employee", obj=body.name, after={"nip": body.nip}, request=request)
    return await _enrich(clean(doc))


@router.put("/{emp_id}")
async def update_employee(emp_id: str, body: EmployeeIn, request: Request, user: dict = Depends(require("employee.edit"))):
    existing = await db.employees.find_one({"id": emp_id})
    if not existing:
        raise HTTPException(404, "Pegawai tidak ditemukan")
    data = {**body.model_dump(), "updated_at": now_iso()}
    await db.employees.update_one({"id": emp_id}, {"$set": data})
    await log_audit(user, "EDIT", "Employee", obj=body.name, request=request)
    return await _enrich(await db.employees.find_one({"id": emp_id}, {"_id": 0}))


@router.delete("/{emp_id}")
async def delete_employee(emp_id: str, request: Request, user: dict = Depends(require("employee.delete"))):
    existing = await db.employees.find_one({"id": emp_id})
    if not existing:
        raise HTTPException(404, "Pegawai tidak ditemukan")
    await db.employees.update_one({"id": emp_id}, {"$set": {"deleted": True}})
    await log_audit(user, "DELETE", "Employee", obj=existing.get("name"), request=request)
    return {"ok": True}
