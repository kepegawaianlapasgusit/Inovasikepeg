from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from ..db import db, now_iso, new_id, clean, log_audit
from ..security import require, get_current_user

router = APIRouter(prefix="/api/master", tags=["master"])

# Collection whitelist -> mongo collection name
COLLECTIONS = {
    "organizational_units": "organizational_units",
    "sections": "sections",
    "positions": "positions",
    "grades": "grades",
    "teams": "teams",
    "attendance_types": "attendance_types",
    "attendance_statuses": "attendance_statuses",
    "categories": "categories",
}


class ItemIn(BaseModel):
    data: Dict[str, Any]


def _coll(name: str):
    if name not in COLLECTIONS:
        raise HTTPException(404, "Master data tidak ditemukan")
    return db[COLLECTIONS[name]]


# ---------------- System settings (literal routes declared before parameterized) ----------------
class SettingsIn(BaseModel):
    data: Dict[str, Any]


@router.get("/settings/global")
async def get_settings(user: dict = Depends(get_current_user)):
    s = await db.system_settings.find_one({"id": "global"}, {"_id": 0})
    return s or {}


@router.put("/settings/global")
async def update_settings(body: SettingsIn, request: Request, user: dict = Depends(require("settings.manage"))):
    data = {k: v for k, v in body.data.items() if k not in ("id", "_id")}
    data["updated_at"] = now_iso()
    await db.system_settings.update_one({"id": "global"}, {"$set": data}, upsert=True)
    await log_audit(user, "EDIT", "SystemSettings", obj="global", after=data, request=request)
    return await db.system_settings.find_one({"id": "global"}, {"_id": 0})


# Public-ish read: any authenticated user can read master data (needed for dropdowns/dashboards)
@router.get("/{name}")
async def list_items(name: str, user: dict = Depends(get_current_user)):
    coll = _coll(name)
    return [clean(d) async for d in coll.find({"deleted": {"$ne": True}}).sort("created_at", 1)]


@router.post("/{name}")
async def create_item(name: str, body: ItemIn, request: Request, user: dict = Depends(require("master_data.manage"))):
    coll = _coll(name)
    doc = {**body.data, "id": new_id(), "is_active": True, "deleted": False, "created_at": now_iso()}
    await coll.insert_one(dict(doc))
    await log_audit(user, "CREATE", f"MasterData:{name}", obj=body.data.get("name"), after=body.data, request=request)
    return clean(doc)


@router.put("/{name}/{item_id}")
async def update_item(name: str, item_id: str, body: ItemIn, request: Request, user: dict = Depends(require("master_data.manage"))):
    coll = _coll(name)
    existing = await coll.find_one({"id": item_id})
    if not existing:
        raise HTTPException(404, "Item tidak ditemukan")
    data = {k: v for k, v in body.data.items() if k not in ("id", "_id", "created_at")}
    data["updated_at"] = now_iso()
    await coll.update_one({"id": item_id}, {"$set": data})
    await log_audit(user, "EDIT", f"MasterData:{name}", obj=data.get("name", item_id), request=request)
    return clean(await coll.find_one({"id": item_id}))


@router.delete("/{name}/{item_id}")
async def delete_item(name: str, item_id: str, request: Request, user: dict = Depends(require("master_data.manage"))):
    coll = _coll(name)
    existing = await coll.find_one({"id": item_id})
    if not existing:
        raise HTTPException(404, "Item tidak ditemukan")
    await coll.update_one({"id": item_id}, {"$set": {"deleted": True, "is_active": False}})
    await log_audit(user, "DELETE", f"MasterData:{name}", obj=existing.get("name", item_id), request=request)
    return {"ok": True}
