from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import date, datetime
from ..db import db, now_iso, new_id, clean, log_audit
from ..security import require, get_current_user, has_perm
from .attendance import employee_summary

router = APIRouter(prefix="/api", tags=["modules"])


async def _emp_name(emp_id):
    if not emp_id:
        return None
    e = await db.employees.find_one({"id": emp_id}, {"_id": 0, "name": 1, "nip": 1})
    return e


def _days_left(target: str):
    try:
        d = datetime.strptime(target[:10], "%Y-%m-%d").date()
        return (d - date.today()).days
    except Exception:
        return None


async def _threshold(key, default):
    s = await db.system_settings.find_one({"id": "global"}) or {}
    return s.get(key, default)


# ================= Generic employee-linked record factory =================
def make_record_router(path: str, coll_name: str, view_perm: str, manage_perm: str, module_label: str):
    coll = db[coll_name]

    class RecordIn(BaseModel):
        data: Dict[str, Any]

    @router.get(f"/{path}")
    async def _list(employee_id: Optional[str] = None, user: dict = Depends(require(view_perm))):
        query: Dict[str, Any] = {"deleted": {"$ne": True}}
        if not (has_perm(user, "employee.view_all") or user.get("is_super")):
            query["employee_id"] = user.get("employee_id") or "__none__"
        elif employee_id:
            query["employee_id"] = employee_id
        out = []
        async for d in coll.find(query).sort("created_at", -1):
            d = clean(d)
            d["employee"] = await _emp_name(d.get("employee_id"))
            out.append(d)
        return out

    @router.post(f"/{path}")
    async def _create(body: RecordIn, request: Request, user: dict = Depends(require(manage_perm))):
        doc = {**body.data, "id": new_id(), "deleted": False, "created_by": user["id"], "created_at": now_iso()}
        await coll.insert_one(dict(doc))
        await log_audit(user, "CREATE", module_label, obj=body.data.get("title") or body.data.get("nomor") or body.data.get("employee_id"), request=request)
        d = clean(doc)
        d["employee"] = await _emp_name(d.get("employee_id"))
        return d

    @router.put(f"/{path}/{{item_id}}")
    async def _update(item_id: str, body: RecordIn, request: Request, user: dict = Depends(require(manage_perm))):
        existing = await coll.find_one({"id": item_id})
        if not existing:
            raise HTTPException(404, "Data tidak ditemukan")
        data = {k: v for k, v in body.data.items() if k not in ("id", "_id", "created_at")}
        data["updated_at"] = now_iso()
        await coll.update_one({"id": item_id}, {"$set": data})
        await log_audit(user, "EDIT", module_label, obj=item_id, request=request)
        d = clean(await coll.find_one({"id": item_id}))
        d["employee"] = await _emp_name(d.get("employee_id"))
        return d

    @router.delete(f"/{path}/{{item_id}}")
    async def _delete(item_id: str, request: Request, user: dict = Depends(require(manage_perm))):
        existing = await coll.find_one({"id": item_id})
        if not existing:
            raise HTTPException(404, "Data tidak ditemukan")
        await coll.update_one({"id": item_id}, {"$set": {"deleted": True}})
        await log_audit(user, "DELETE", module_label, obj=item_id, request=request)
        return {"ok": True}


make_record_router("documents", "documents", "document.view", "document.manage", "Document")
make_record_router("leave", "leave_records", "leave.view", "leave.manage", "Leave")
make_record_router("training", "training_records", "training.view", "training.manage", "Training")
make_record_router("awards", "awards", "award.view", "award.manage", "Award")
make_record_router("discipline", "disciplinary_records", "discipline.view", "discipline.manage", "Discipline")


# ================= KGB =================
@router.get("/kgb")
async def list_kgb(employee_id: Optional[str] = None, user: dict = Depends(require("kgb.view"))):
    query: Dict[str, Any] = {"deleted": {"$ne": True}}
    if not (has_perm(user, "employee.view_all") or user.get("is_super")):
        query["employee_id"] = user.get("employee_id") or "__none__"
    elif employee_id:
        query["employee_id"] = employee_id
    thr = await _threshold("kgb_threshold_days", 90)
    out = []
    async for d in db.kgb_records.find(query).sort("next_date", 1):
        d = clean(d)
        d["employee"] = await _emp_name(d.get("employee_id"))
        dl = _days_left(d.get("next_date", ""))
        d["days_left"] = dl
        if dl is None:
            d["status"] = "aman"
        elif dl < 0:
            d["status"] = "terlambat"
        elif dl <= 30:
            d["status"] = "jatuh_tempo"
        elif dl <= thr:
            d["status"] = "mendekati"
        else:
            d["status"] = "aman"
        out.append(d)
    return out


class KGBIn(BaseModel):
    data: Dict[str, Any]


@router.post("/kgb")
async def create_kgb(body: KGBIn, request: Request, user: dict = Depends(require("kgb.manage"))):
    doc = {**body.data, "id": new_id(), "deleted": False, "created_at": now_iso()}
    await db.kgb_records.insert_one(dict(doc))
    await log_audit(user, "CREATE", "KGB", obj=body.data.get("employee_id"), request=request)
    return clean(doc)


@router.put("/kgb/{item_id}")
async def update_kgb(item_id: str, body: KGBIn, request: Request, user: dict = Depends(require("kgb.manage"))):
    if not await db.kgb_records.find_one({"id": item_id}):
        raise HTTPException(404, "Data tidak ditemukan")
    data = {k: v for k, v in body.data.items() if k not in ("id", "_id")}
    data["updated_at"] = now_iso()
    await db.kgb_records.update_one({"id": item_id}, {"$set": data})
    await log_audit(user, "EDIT", "KGB", obj=item_id, request=request)
    return clean(await db.kgb_records.find_one({"id": item_id}))


@router.delete("/kgb/{item_id}")
async def delete_kgb(item_id: str, request: Request, user: dict = Depends(require("kgb.manage"))):
    await db.kgb_records.update_one({"id": item_id}, {"$set": {"deleted": True}})
    await log_audit(user, "DELETE", "KGB", obj=item_id, request=request)
    return {"ok": True}


# ================= Promotion (Kenaikan Pangkat) =================
@router.get("/promotion")
async def list_promotion(employee_id: Optional[str] = None, user: dict = Depends(require("promotion.view"))):
    query: Dict[str, Any] = {"deleted": {"$ne": True}}
    if not (has_perm(user, "employee.view_all") or user.get("is_super")):
        query["employee_id"] = user.get("employee_id") or "__none__"
    elif employee_id:
        query["employee_id"] = employee_id
    thr = await _threshold("promotion_threshold_days", 120)
    out = []
    async for d in db.promotion_records.find(query).sort("next_date", 1):
        d = clean(d)
        d["employee"] = await _emp_name(d.get("employee_id"))
        dl = _days_left(d.get("next_date", ""))
        d["days_left"] = dl
        if dl is None:
            d["status"] = "aman"
        elif dl < 0:
            d["status"] = "terlambat"
        elif dl <= 30:
            d["status"] = "jatuh_tempo"
        elif dl <= thr:
            d["status"] = "mendekati"
        else:
            d["status"] = "aman"
        out.append(d)
    return out


@router.post("/promotion")
async def create_promotion(body: KGBIn, request: Request, user: dict = Depends(require("promotion.manage"))):
    doc = {**body.data, "id": new_id(), "deleted": False, "created_at": now_iso()}
    await db.promotion_records.insert_one(dict(doc))
    await log_audit(user, "CREATE", "Promotion", obj=body.data.get("employee_id"), request=request)
    return clean(doc)


@router.put("/promotion/{item_id}")
async def update_promotion(item_id: str, body: KGBIn, request: Request, user: dict = Depends(require("promotion.manage"))):
    if not await db.promotion_records.find_one({"id": item_id}):
        raise HTTPException(404, "Data tidak ditemukan")
    data = {k: v for k, v in body.data.items() if k not in ("id", "_id")}
    data["updated_at"] = now_iso()
    await db.promotion_records.update_one({"id": item_id}, {"$set": data})
    await log_audit(user, "EDIT", "Promotion", obj=item_id, request=request)
    return clean(await db.promotion_records.find_one({"id": item_id}))


@router.delete("/promotion/{item_id}")
async def delete_promotion(item_id: str, request: Request, user: dict = Depends(require("promotion.manage"))):
    await db.promotion_records.update_one({"id": item_id}, {"$set": {"deleted": True}})
    await log_audit(user, "DELETE", "Promotion", obj=item_id, request=request)
    return {"ok": True}


# ================= Announcements =================
class AnnouncementIn(BaseModel):
    title: str
    content: str
    target_type: str = "all"  # all, unit, section, role, employee
    target_ids: List[str] = []
    publish_at: Optional[str] = None
    attachment: Optional[str] = None


@router.get("/announcements")
async def list_announcements(user: dict = Depends(require("announcement.view"))):
    out = [clean(a) async for a in db.announcements.find({"deleted": {"$ne": True}}).sort("created_at", -1)]
    return out


@router.post("/announcements")
async def create_announcement(body: AnnouncementIn, request: Request, user: dict = Depends(require("announcement.manage"))):
    doc = {**body.model_dump(), "id": new_id(), "deleted": False, "created_by": user["id"], "created_by_name": user.get("name"), "created_at": now_iso()}
    await db.announcements.insert_one(dict(doc))
    # fan-out notifications to all users (simple) when target all
    await _notify_users(None, "announcement", body.title, "Pengumuman baru dipublikasikan")
    await log_audit(user, "CREATE", "Announcement", obj=body.title, request=request)
    return clean(doc)


@router.put("/announcements/{item_id}")
async def update_announcement(item_id: str, body: AnnouncementIn, request: Request, user: dict = Depends(require("announcement.manage"))):
    if not await db.announcements.find_one({"id": item_id}):
        raise HTTPException(404, "Tidak ditemukan")
    await db.announcements.update_one({"id": item_id}, {"$set": {**body.model_dump(), "updated_at": now_iso()}})
    await log_audit(user, "EDIT", "Announcement", obj=body.title, request=request)
    return clean(await db.announcements.find_one({"id": item_id}))


@router.delete("/announcements/{item_id}")
async def delete_announcement(item_id: str, request: Request, user: dict = Depends(require("announcement.manage"))):
    await db.announcements.update_one({"id": item_id}, {"$set": {"deleted": True}})
    await log_audit(user, "DELETE", "Announcement", obj=item_id, request=request)
    return {"ok": True}


# ================= Notifications =================
async def _notify_users(user_ids: Optional[List[str]], ntype, title, message):
    if user_ids is None:
        user_ids = [u["id"] async for u in db.users.find({"is_active": True, "deleted": {"$ne": True}}, {"id": 1})]
    for uid in user_ids:
        await db.notifications.insert_one({
            "id": new_id(), "user_id": uid, "type": ntype, "title": title,
            "message": message, "read": False, "created_at": now_iso(),
        })


@router.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    out = [clean(n) async for n in db.notifications.find({"user_id": user["id"]}).sort("created_at", -1).limit(100)]
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"items": out, "unread": unread}


@router.post("/notifications/{notif_id}/read")
async def read_notification(notif_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": notif_id, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@router.post("/notifications/read-all")
async def read_all_notifications(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ================= Calendar / Agenda =================
class AgendaIn(BaseModel):
    title: str
    category: Optional[str] = ""
    date: str
    time: Optional[str] = ""
    end_date: Optional[str] = None
    location: Optional[str] = ""
    participants: Optional[str] = ""
    pic: Optional[str] = ""
    description: Optional[str] = ""
    status: Optional[str] = "Terjadwal"


@router.get("/agenda")
async def list_agenda(date_from: Optional[str] = None, date_to: Optional[str] = None, user: dict = Depends(require("calendar.view"))):
    query: Dict[str, Any] = {"deleted": {"$ne": True}}
    if date_from or date_to:
        query["date"] = {}
        if date_from:
            query["date"]["$gte"] = date_from
        if date_to:
            query["date"]["$lte"] = date_to
    return [clean(a) async for a in db.events.find(query).sort("date", 1)]


@router.post("/agenda")
async def create_agenda(body: AgendaIn, request: Request, user: dict = Depends(require("calendar.manage"))):
    doc = {**body.model_dump(), "id": new_id(), "deleted": False, "created_by": user["id"], "created_at": now_iso()}
    await db.events.insert_one(dict(doc))
    await log_audit(user, "CREATE", "Agenda", obj=body.title, request=request)
    return clean(doc)


@router.put("/agenda/{item_id}")
async def update_agenda(item_id: str, body: AgendaIn, request: Request, user: dict = Depends(require("calendar.manage"))):
    if not await db.events.find_one({"id": item_id}):
        raise HTTPException(404, "Tidak ditemukan")
    await db.events.update_one({"id": item_id}, {"$set": {**body.model_dump(), "updated_at": now_iso()}})
    await log_audit(user, "EDIT", "Agenda", obj=body.title, request=request)
    return clean(await db.events.find_one({"id": item_id}))


@router.delete("/agenda/{item_id}")
async def delete_agenda(item_id: str, request: Request, user: dict = Depends(require("calendar.manage"))):
    await db.events.update_one({"id": item_id}, {"$set": {"deleted": True}})
    await log_audit(user, "DELETE", "Agenda", obj=item_id, request=request)
    return {"ok": True}


# ================= Evaluation =================
class TemplateIn(BaseModel):
    name: str
    period: Optional[str] = ""
    categories: List[Dict[str, Any]] = []  # [{name, indicators:[{name, weight, scale, description}]}]


@router.get("/evaluation/templates")
async def list_templates(user: dict = Depends(require("evaluation.view"))):
    return [clean(t) async for t in db.evaluation_templates.find({"deleted": {"$ne": True}}).sort("created_at", -1)]


@router.post("/evaluation/templates")
async def create_template(body: TemplateIn, request: Request, user: dict = Depends(require("evaluation.create", "evaluation.edit"))):
    doc = {**body.model_dump(), "id": new_id(), "deleted": False, "created_at": now_iso()}
    await db.evaluation_templates.insert_one(dict(doc))
    await log_audit(user, "CREATE", "EvaluationTemplate", obj=body.name, request=request)
    return clean(doc)


@router.put("/evaluation/templates/{item_id}")
async def update_template(item_id: str, body: TemplateIn, request: Request, user: dict = Depends(require("evaluation.edit"))):
    if not await db.evaluation_templates.find_one({"id": item_id}):
        raise HTTPException(404, "Tidak ditemukan")
    await db.evaluation_templates.update_one({"id": item_id}, {"$set": {**body.model_dump(), "updated_at": now_iso()}})
    return clean(await db.evaluation_templates.find_one({"id": item_id}))


@router.delete("/evaluation/templates/{item_id}")
async def delete_template(item_id: str, user: dict = Depends(require("evaluation.edit"))):
    await db.evaluation_templates.update_one({"id": item_id}, {"$set": {"deleted": True}})
    return {"ok": True}


class EvaluationIn(BaseModel):
    employee_id: str
    template_id: str
    period: str
    scores: List[Dict[str, Any]] = []  # [{indicator, weight, value}]
    notes: Optional[str] = ""


async def _assigned_employees(user):
    assign = await db.evaluator_assignments.find_one({"evaluator_user_id": user["id"]})
    return (assign or {}).get("employee_ids", [])


@router.get("/evaluation")
async def list_evaluations(employee_id: Optional[str] = None, user: dict = Depends(require("evaluation.view"))):
    query: Dict[str, Any] = {"deleted": {"$ne": True}}
    if user.get("is_super") or has_perm(user, "employee.view_all"):
        if employee_id:
            query["employee_id"] = employee_id
    elif has_perm(user, "evaluation.create", "evaluation.edit"):
        query["employee_id"] = {"$in": await _assigned_employees(user)}
    else:
        query["employee_id"] = user.get("employee_id") or "__none__"
    out = []
    async for e in db.evaluations.find(query).sort("created_at", -1):
        e = clean(e)
        e["employee"] = await _emp_name(e.get("employee_id"))
        out.append(e)
    return out


@router.post("/evaluation")
async def create_evaluation(body: EvaluationIn, request: Request, user: dict = Depends(require("evaluation.create"))):
    if not (user.get("is_super") or has_perm(user, "employee.view_all")):
        if body.employee_id not in await _assigned_employees(user):
            raise HTTPException(403, "Anda tidak ditugaskan menilai pegawai ini")
    summary = await employee_summary(body.employee_id)
    weighted = 0.0
    total_weight = 0.0
    for s in body.scores:
        try:
            w = float(s.get("weight", 0))
            v = float(s.get("value", 0))
            weighted += w * v
            total_weight += w
        except (TypeError, ValueError):
            continue
    manual_score = round(weighted / total_weight, 2) if total_weight else 0
    doc = {
        "id": new_id(), "employee_id": body.employee_id, "template_id": body.template_id,
        "period": body.period, "scores": body.scores, "notes": body.notes,
        "attendance_percentage": summary["overall_percentage"],
        "manual_score": manual_score, "status": "submitted",
        "evaluator_id": user["id"], "evaluator_name": user.get("name"),
        "deleted": False, "created_at": now_iso(),
    }
    await db.evaluations.insert_one(dict(doc))
    await log_audit(user, "CREATE", "Evaluation", obj=body.employee_id, after={"score": manual_score, "attendance": summary["overall_percentage"]}, request=request)
    d = clean(doc)
    d["employee"] = await _emp_name(body.employee_id)
    return d


@router.post("/evaluation/{eval_id}/approve")
async def approve_evaluation(eval_id: str, request: Request, user: dict = Depends(require("evaluation.approve"))):
    if not await db.evaluations.find_one({"id": eval_id}):
        raise HTTPException(404, "Tidak ditemukan")
    await db.evaluations.update_one({"id": eval_id}, {"$set": {"status": "approved", "approved_by": user["id"], "approved_at": now_iso()}})
    await log_audit(user, "APPROVE", "Evaluation", obj=eval_id, request=request)
    return {"ok": True}
