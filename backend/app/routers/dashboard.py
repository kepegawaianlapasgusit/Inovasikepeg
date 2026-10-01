from fastapi import APIRouter, Depends, Request
from typing import Optional, Dict, Any, List
from datetime import date
from ..db import db, clean
from ..security import require, get_current_user, has_perm

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    today = date.today().isoformat()
    is_admin = user.get("is_super") or has_perm(user, "employee.view_all")

    if is_admin:
        total_employees = await db.employees.count_documents({"deleted": {"$ne": True}})
        active_employees = await db.employees.count_documents({"deleted": {"$ne": True}, "status_kepegawaian": "Aktif"})
        total_units = await db.organizational_units.count_documents({"deleted": {"$ne": True}, "type": "unit"})
        total_users = await db.users.count_documents({"deleted": {"$ne": True}})
        today_events = await db.attendance_events.count_documents({"deleted": {"$ne": True}, "date": today})
        today_records = await db.attendance_records.count_documents({"date": today})

        # KGB / Promotion approaching due (within threshold days or overdue)
        from datetime import datetime as _dt, date as _date
        settings = await db.system_settings.find_one({"id": "global"}) or {}
        kgb_thr = settings.get("kgb_threshold_days", 90)
        promo_thr = settings.get("promotion_threshold_days", 120)

        def _due(records, thr):
            n = 0
            for r in records:
                nd = (r.get("next_date") or "")[:10]
                try:
                    dl = (_dt.strptime(nd, "%Y-%m-%d").date() - _date.today()).days
                    if dl <= thr:
                        n += 1
                except ValueError:
                    continue
            return n

        kgb_items = [k async for k in db.kgb_records.find({"deleted": {"$ne": True}}, {"_id": 0, "next_date": 1})]
        promo_items = [p async for p in db.promotion_records.find({"deleted": {"$ne": True}}, {"_id": 0, "next_date": 1})]
        kgb_due = _due(kgb_items, kgb_thr)
        promo_due = _due(promo_items, promo_thr)

        agenda_today = [clean(a) async for a in db.events.find({"deleted": {"$ne": True}, "date": today}).limit(10)]
        announcements = [clean(a) async for a in db.announcements.find({"deleted": {"$ne": True}}).sort("created_at", -1).limit(5)]
        activities = [clean(a) async for a in db.audit_logs.find({}).sort("timestamp", -1).limit(10)]
        unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})

        return {
            "mode": "admin",
            "stats": {
                "total_employees": total_employees,
                "active_employees": active_employees,
                "total_units": total_units,
                "total_users": total_users,
                "today_events": today_events,
                "today_records": today_records,
                "kgb_due": kgb_due,
                "promotion_due": promo_due,
                "unread_notifications": unread,
            },
            "agenda_today": agenda_today,
            "announcements": announcements,
            "activities": activities,
        }

    # Employee dashboard
    from .attendance import employee_summary
    emp = None
    summary = {"per_type": [], "overall_percentage": 0}
    if user.get("employee_id"):
        emp = await db.employees.find_one({"id": user["employee_id"]}, {"_id": 0})
        summary = await employee_summary(user["employee_id"])
    agenda_today = [clean(a) async for a in db.events.find({"deleted": {"$ne": True}, "date": today}).limit(10)]
    announcements = [clean(a) async for a in db.announcements.find({"deleted": {"$ne": True}}).sort("created_at", -1).limit(5)]
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    kgb = [clean(k) async for k in db.kgb_records.find({"deleted": {"$ne": True}, "employee_id": user.get("employee_id")})]
    return {
        "mode": "employee",
        "employee": emp,
        "attendance_summary": summary,
        "agenda_today": agenda_today,
        "announcements": announcements,
        "kgb": kgb,
        "unread_notifications": unread,
    }


@router.get("/audit-logs")
async def audit_logs(
    module: Optional[str] = None, action: Optional[str] = None,
    page: int = 1, limit: int = 30, user: dict = Depends(require("audit_log.view")),
):
    query: Dict[str, Any] = {}
    if module:
        query["module"] = {"$regex": module, "$options": "i"}
    if action:
        query["action"] = action
    total = await db.audit_logs.count_documents(query)
    cursor = db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip((page - 1) * limit).limit(limit)
    items = [a async for a in cursor]
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/search")
async def global_search(q: str, user: dict = Depends(get_current_user)):
    results: List[Dict[str, Any]] = []
    if not q or len(q) < 2:
        return {"results": results}
    rx = {"$regex": q, "$options": "i"}
    if has_perm(user, "employee.view_all") or user.get("is_super"):
        async for e in db.employees.find({"deleted": {"$ne": True}, "$or": [{"name": rx}, {"nip": rx}]}, {"_id": 0}).limit(8):
            results.append({"type": "Pegawai", "id": e["id"], "label": e["name"], "sub": e.get("nip"), "path": f"/app/employees/{e['id']}"})
    if has_perm(user, "attendance.view"):
        async for ev in db.attendance_events.find({"deleted": {"$ne": True}, "code": rx}, {"_id": 0}).limit(5):
            results.append({"type": "Apel", "id": ev["id"], "label": ev["code"], "sub": ev.get("date"), "path": f"/app/attendance/{ev['id']}"})
    if has_perm(user, "announcement.view"):
        async for a in db.announcements.find({"deleted": {"$ne": True}, "title": rx}, {"_id": 0}).limit(5):
            results.append({"type": "Pengumuman", "id": a["id"], "label": a["title"], "sub": "", "path": "/app/announcements"})
    return {"results": results}


# Simple JSON report aggregator (export PDF/Excel phased later)
@router.get("/reports/attendance-recap")
async def report_attendance_recap(
    attendance_type_id: Optional[str] = None, date_from: Optional[str] = None,
    date_to: Optional[str] = None, user: dict = Depends(require("report.view", "attendance.view")),
):
    from .attendance import _status_map
    statuses = await _status_map()
    ev_query: Dict[str, Any] = {"deleted": {"$ne": True}}
    if attendance_type_id:
        ev_query["attendance_type_id"] = attendance_type_id
    if date_from or date_to:
        ev_query["date"] = {}
        if date_from:
            ev_query["date"]["$gte"] = date_from
        if date_to:
            ev_query["date"]["$lte"] = date_to
    event_ids = [e["id"] async for e in db.attendance_events.find(ev_query, {"id": 1})]
    agg: Dict[str, Dict[str, Any]] = {}
    async for rec in db.attendance_records.find({"event_id": {"$in": event_ids}}):
        tid = rec.get("attendance_type_id")
        agg.setdefault(tid, {"events": set(), "by_key": {}})
        agg[tid]["events"].add(rec.get("event_id"))
        st = statuses.get(rec.get("status_id"))
        key = st["key"] if st else rec.get("status_id")
        agg[tid]["by_key"][key] = agg[tid]["by_key"].get(key, 0) + 1
    types = {t["id"]: t["name"] async for t in db.attendance_types.find({})}
    rows = []
    for tid, v in agg.items():
        row = {"type_id": tid, "type_name": types.get(tid, tid), "total_events": len(v["events"])}
        for s in sorted(statuses.values(), key=lambda x: x.get("order", 99)):
            row[s["key"]] = v["by_key"].get(s["key"], 0)
        rows.append(row)
    return {"rows": rows, "statuses": [{"key": s["key"], "label": s["name"]} for s in sorted(statuses.values(), key=lambda x: x.get("order", 99))]}
