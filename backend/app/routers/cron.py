import os
import hmac
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Request, BackgroundTasks, HTTPException
from ..db import db, new_id, now_iso

router = APIRouter(prefix="/api/cron", tags=["cron"])


def _check_auth(request: Request):
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else ""
    if not secret or not token or not hmac.compare_digest(token, secret):
        raise HTTPException(status_code=401, detail="Unauthorized")


async def _users_with_perms(perms):
    """Return set of user_ids whose roles grant any of the given perms or wildcard."""
    role_ids = set()
    async for r in db.roles.find({"$or": [{"permissions": "*"}, {"permissions": {"$in": perms}}]}, {"id": 1}):
        role_ids.add(r["id"])
    uids = set()
    async for u in db.users.find({"is_active": True, "deleted": {"$ne": True}}, {"id": 1, "role_ids": 1, "extra_permissions": 1}):
        if set(u.get("role_ids", [])) & role_ids or (set(u.get("extra_permissions", [])) & set(perms)):
            uids.add(u["id"])
    return uids


async def _notify(user_id, ntype, title, message, ref):
    # dedup: skip if same user already has a notification for this ref
    if await db.notifications.find_one({"user_id": user_id, "ref": ref}):
        return 0
    await db.notifications.insert_one({
        "id": new_id(), "user_id": user_id, "type": ntype, "title": title,
        "message": message, "ref": ref, "read": False, "created_at": now_iso(),
    })
    return 1


def _days_left(target):
    try:
        return (datetime.strptime((target or "")[:10], "%Y-%m-%d").date() - date.today()).days
    except (ValueError, TypeError):
        return None


async def _run_reminders():
    settings = await db.system_settings.find_one({"id": "global"}) or {}
    kgb_thr = settings.get("kgb_threshold_days", 90)
    promo_thr = settings.get("promotion_threshold_days", 120)
    emp_user = {}
    async for u in db.users.find({"employee_id": {"$ne": None}, "is_active": True}, {"id": 1, "employee_id": 1}):
        emp_user[u["employee_id"]] = u["id"]

    kgb_mgrs = await _users_with_perms(["kgb.view", "kgb.manage"])
    promo_mgrs = await _users_with_perms(["promotion.view", "promotion.manage"])
    created = 0

    async for k in db.kgb_records.find({"deleted": {"$ne": True}}):
        dl = _days_left(k.get("next_date"))
        if dl is None or dl > kgb_thr:
            continue
        emp = await db.employees.find_one({"id": k.get("employee_id")}, {"_id": 0, "name": 1})
        nm = emp["name"] if emp else "Pegawai"
        ref = f"kgb:{k['id']}:{(k.get('next_date') or '')[:10]}"
        msg = f"KGB {nm} jatuh tempo {k.get('next_date','')[:10]} ({dl} hari lagi)" if dl >= 0 else f"KGB {nm} TERLAMBAT {abs(dl)} hari"
        targets = set(kgb_mgrs)
        if k.get("employee_id") in emp_user:
            targets.add(emp_user[k["employee_id"]])
        for uid in targets:
            created += await _notify(uid, "kgb", "Pengingat KGB", msg, ref)

    async for p in db.promotion_records.find({"deleted": {"$ne": True}}):
        dl = _days_left(p.get("next_date"))
        if dl is None or dl > promo_thr:
            continue
        emp = await db.employees.find_one({"id": p.get("employee_id")}, {"_id": 0, "name": 1})
        nm = emp["name"] if emp else "Pegawai"
        ref = f"promo:{p['id']}:{(p.get('next_date') or '')[:10]}"
        msg = f"Kenaikan pangkat {nm} periode {p.get('next_date','')[:10]} ({dl} hari lagi)" if dl >= 0 else f"Periode kenaikan pangkat {nm} TERLAMBAT {abs(dl)} hari"
        targets = set(promo_mgrs)
        if p.get("employee_id") in emp_user:
            targets.add(emp_user[p["employee_id"]])
        for uid in targets:
            created += await _notify(uid, "promotion", "Pengingat Kenaikan Pangkat", msg, ref)

    # Agenda happening today or tomorrow -> notify all active users
    today = date.today().isoformat()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    all_users = [u["id"] async for u in db.users.find({"is_active": True, "deleted": {"$ne": True}}, {"id": 1})]
    async for a in db.events.find({"deleted": {"$ne": True}, "date": {"$in": [today, tomorrow]}}):
        when = "hari ini" if a.get("date") == today else "besok"
        ref = f"agenda:{a['id']}:{a.get('date')}"
        msg = f"{a.get('title')} ({when}) {a.get('time','')} di {a.get('location','-')}"
        for uid in all_users:
            created += await _notify(uid, "agenda", "Pengingat Agenda", msg, ref)
    return created


@router.post("/reminders")
async def reminders(request: Request, background_tasks: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    _check_auth(request)
    background_tasks.add_task(_run_reminders)
    return {"ok": True, "queued": True}
