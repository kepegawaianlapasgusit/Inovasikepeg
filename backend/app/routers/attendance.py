from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from ..db import db, now_iso, new_id, clean, log_audit
from ..security import require, get_current_user, has_perm

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


# ---------------- helpers ----------------
async def _status_map():
    return {s["id"]: s async for s in db.attendance_statuses.find({"deleted": {"$ne": True}})}


async def _operator_allows(user, attendance_type_id):
    if user.get("is_super"):
        return True
    assign = await db.attendance_operators.find_one({"user_id": user["id"]})
    if not assign:
        # no restriction record -> allow any type they have create perm for
        return True
    return attendance_type_id in (assign.get("attendance_type_ids") or [])


async def compute_event_recap(event_id: str):
    statuses = await _status_map()
    counts: Dict[str, int] = {}
    present = 0
    total = 0
    async for rec in db.attendance_records.find({"event_id": event_id}):
        total += 1
        st = statuses.get(rec.get("status_id"))
        key = st["key"] if st else rec.get("status_id")
        counts[key] = counts.get(key, 0) + 1
        if st and st.get("counts_present"):
            present += 1
    pct = round((present / total) * 100, 2) if total else 0
    ordered = []
    for s in sorted(statuses.values(), key=lambda x: x.get("order", 99)):
        ordered.append({"key": s["key"], "label": s["name"], "count": counts.get(s["key"], 0)})
    return {"total": total, "present": present, "percentage": pct, "by_status": ordered}


async def employee_summary(employee_id: str):
    """Attendance percentage per type + overall for one employee."""
    statuses = await _status_map()
    by_type: Dict[str, Dict[str, int]] = {}
    overall_present = 0
    overall_total = 0
    async for rec in db.attendance_records.find({"employee_id": employee_id}):
        t = rec.get("attendance_type_id")
        by_type.setdefault(t, {"present": 0, "total": 0})
        by_type[t]["total"] += 1
        overall_total += 1
        st = statuses.get(rec.get("status_id"))
        if st and st.get("counts_present"):
            by_type[t]["present"] += 1
            overall_present += 1
    types = {t["id"]: t["name"] async for t in db.attendance_types.find({})}
    result = []
    for tid, v in by_type.items():
        pct = round((v["present"] / v["total"]) * 100, 2) if v["total"] else 0
        result.append({"type_id": tid, "type_name": types.get(tid, tid), "present": v["present"], "total": v["total"], "percentage": pct})
    overall = round((overall_present / overall_total) * 100, 2) if overall_total else 0
    return {"per_type": result, "overall_percentage": overall, "overall_present": overall_present, "overall_total": overall_total}


# ---------------- Events ----------------
class EventIn(BaseModel):
    date: str
    time: str
    attendance_type_id: str
    session: str
    team_id: Optional[str] = None
    location: Optional[str] = ""
    pembina: Optional[str] = ""
    pembina_jabatan: Optional[str] = ""
    jumlah_peserta: Optional[int] = 0
    catatan: Optional[str] = ""


async def _enrich_event(ev: dict):
    t = await db.attendance_types.find_one({"id": ev.get("attendance_type_id")}, {"_id": 0})
    ev["attendance_type_name"] = t["name"] if t else None
    if ev.get("team_id"):
        tm = await db.teams.find_one({"id": ev["team_id"]}, {"_id": 0})
        ev["team_name"] = tm["name"] if tm else None
    return ev


@router.get("/events")
async def list_events(
    attendance_type_id: Optional[str] = None, date_from: Optional[str] = None,
    date_to: Optional[str] = None, page: int = 1, limit: int = 20,
    user: dict = Depends(require("attendance.view")),
):
    query: Dict[str, Any] = {"deleted": {"$ne": True}}
    if attendance_type_id:
        query["attendance_type_id"] = attendance_type_id
    if date_from or date_to:
        query["date"] = {}
        if date_from:
            query["date"]["$gte"] = date_from
        if date_to:
            query["date"]["$lte"] = date_to
    total = await db.attendance_events.count_documents(query)
    cursor = db.attendance_events.find(query, {"_id": 0}).sort("date", -1).skip((page - 1) * limit).limit(limit)
    items = []
    for ev in [e async for e in cursor]:
        await _enrich_event(ev)
        recap = await compute_event_recap(ev["id"])
        ev["recap"] = recap
        items.append(ev)
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.post("/events")
async def create_event(body: EventIn, request: Request, user: dict = Depends(require("attendance.create"))):
    if not await _operator_allows(user, body.attendance_type_id):
        raise HTTPException(403, "Anda tidak ditugaskan untuk jenis apel ini")
    t = await db.attendance_types.find_one({"id": body.attendance_type_id})
    if not t:
        raise HTTPException(400, "Jenis apel tidak valid")
    code = f"APEL-{body.date.replace('-', '')}-{body.session.upper().replace('/', '-').replace(' ', '')}"
    doc = {**body.model_dump(), "id": new_id(), "code": code, "created_by": user["id"],
           "created_by_name": user.get("name"), "deleted": False, "created_at": now_iso()}
    await db.attendance_events.insert_one(dict(doc))
    await log_audit(user, "CREATE", "AttendanceEvent", obj=code, after=body.model_dump(), request=request)
    return await _enrich_event(clean(doc))


@router.get("/events/{event_id}")
async def get_event(event_id: str, user: dict = Depends(require("attendance.view"))):
    ev = await db.attendance_events.find_one({"id": event_id, "deleted": {"$ne": True}}, {"_id": 0})
    if not ev:
        raise HTTPException(404, "Kegiatan apel tidak ditemukan")
    await _enrich_event(ev)
    ev["recap"] = await compute_event_recap(event_id)
    ev["note"] = await db.attendance_notes.find_one({"event_id": event_id}, {"_id": 0})
    ev["documents"] = [clean(d) async for d in db.event_documents.find({"event_id": event_id})]
    return ev


@router.put("/events/{event_id}")
async def update_event(event_id: str, body: EventIn, request: Request, user: dict = Depends(require("attendance.edit"))):
    existing = await db.attendance_events.find_one({"id": event_id})
    if not existing:
        raise HTTPException(404, "Kegiatan apel tidak ditemukan")
    await db.attendance_events.update_one({"id": event_id}, {"$set": {**body.model_dump(), "updated_at": now_iso()}})
    await log_audit(user, "EDIT", "AttendanceEvent", obj=existing.get("code"), request=request)
    return await get_event(event_id, user)


@router.delete("/events/{event_id}")
async def delete_event(event_id: str, request: Request, user: dict = Depends(require("attendance.delete"))):
    existing = await db.attendance_events.find_one({"id": event_id})
    if not existing:
        raise HTTPException(404, "Kegiatan apel tidak ditemukan")
    await db.attendance_events.update_one({"id": event_id}, {"$set": {"deleted": True}})
    await log_audit(user, "DELETE", "AttendanceEvent", obj=existing.get("code"), request=request)
    return {"ok": True}


# ---------------- Attendance records ----------------
class RecordIn(BaseModel):
    employee_id: str
    status_id: str
    keterangan: Optional[str] = ""


class BatchRecordsIn(BaseModel):
    records: List[RecordIn]


@router.get("/events/{event_id}/records")
async def list_records(event_id: str, user: dict = Depends(require("attendance.view"))):
    out = []
    statuses = await _status_map()
    async for rec in db.attendance_records.find({"event_id": event_id}):
        rec = clean(rec)
        emp = await db.employees.find_one({"id": rec["employee_id"]}, {"_id": 0, "name": 1, "nip": 1, "unit_id": 1, "section_id": 1, "position_id": 1})
        rec["employee"] = emp
        st = statuses.get(rec.get("status_id"))
        rec["status_label"] = st["name"] if st else None
        rec["status_key"] = st["key"] if st else None
        out.append(rec)
    return out


async def _record_dup_exists(event, employee_id, exclude_event=None):
    q = {
        "employee_id": employee_id,
        "date": event["date"],
        "attendance_type_id": event["attendance_type_id"],
        "session": event["session"],
    }
    if exclude_event:
        q["event_id"] = {"$ne": exclude_event}
    return await db.attendance_records.find_one(q)


@router.post("/events/{event_id}/records/batch")
async def batch_records(event_id: str, body: BatchRecordsIn, request: Request, user: dict = Depends(require("attendance.create"))):
    event = await db.attendance_events.find_one({"id": event_id})
    if not event:
        raise HTTPException(404, "Kegiatan apel tidak ditemukan")
    created, skipped = 0, []
    for r in body.records:
        # within-event duplicate
        if await db.attendance_records.find_one({"event_id": event_id, "employee_id": r.employee_id}):
            skipped.append(r.employee_id)
            continue
        if await _record_dup_exists(event, r.employee_id, exclude_event=event_id):
            skipped.append(r.employee_id)
            continue
        doc = {
            "id": new_id(), "event_id": event_id, "employee_id": r.employee_id,
            "status_id": r.status_id, "keterangan": r.keterangan,
            "date": event["date"], "attendance_type_id": event["attendance_type_id"],
            "session": event["session"], "created_by": user["id"], "created_at": now_iso(),
        }
        await db.attendance_records.insert_one(dict(doc))
        created += 1
    await log_audit(user, "CREATE", "AttendanceRecords", obj=event.get("code"), after={"created": created, "skipped": len(skipped)}, request=request)
    return {"created": created, "skipped": skipped, "recap": await compute_event_recap(event_id)}


# ---------------- Correction ----------------
class CorrectionIn(BaseModel):
    status_id: str
    keterangan: Optional[str] = ""
    reason: str


@router.post("/records/{record_id}/correct")
async def correct_record(record_id: str, body: CorrectionIn, request: Request, user: dict = Depends(require("attendance.correct"))):
    rec = await db.attendance_records.find_one({"id": record_id})
    if not rec:
        raise HTTPException(404, "Record tidak ditemukan")
    if not body.reason.strip():
        raise HTTPException(400, "Alasan koreksi wajib diisi")
    old = {"status_id": rec.get("status_id"), "keterangan": rec.get("keterangan")}
    await db.attendance_records.update_one({"id": record_id}, {"$set": {"status_id": body.status_id, "keterangan": body.keterangan, "updated_at": now_iso()}})
    correction = {
        "id": new_id(), "record_id": record_id, "event_id": rec.get("event_id"),
        "employee_id": rec.get("employee_id"), "old": old,
        "new": {"status_id": body.status_id, "keterangan": body.keterangan},
        "reason": body.reason, "corrected_by": user["id"], "corrected_by_name": user.get("name"),
        "corrected_at": now_iso(),
    }
    await db.attendance_corrections.insert_one(dict(correction))
    await log_audit(user, "CORRECT", "AttendanceRecord", obj=record_id, before=old, after=correction["new"], request=request)
    return {"ok": True, "recap": await compute_event_recap(rec["event_id"])}


@router.get("/corrections")
async def list_corrections(user: dict = Depends(require("attendance.correct", "attendance.view"))):
    return [clean(c) async for c in db.attendance_corrections.find({}).sort("corrected_at", -1).limit(200)]


# ---------------- Notes (notula / amanat) ----------------
class NoteIn(BaseModel):
    tema: Optional[str] = ""
    pokok: Optional[str] = ""
    isi: Optional[str] = ""
    tindak_lanjut: Optional[str] = ""
    catatan: Optional[str] = ""


@router.put("/events/{event_id}/note")
async def upsert_note(event_id: str, body: NoteIn, request: Request, user: dict = Depends(require("attendance.create", "attendance.edit"))):
    event = await db.attendance_events.find_one({"id": event_id})
    if not event:
        raise HTTPException(404, "Kegiatan apel tidak ditemukan")
    existing = await db.attendance_notes.find_one({"event_id": event_id})
    data = {**body.model_dump(), "event_id": event_id, "updated_by": user["id"], "updated_at": now_iso()}
    if existing:
        await db.attendance_notes.update_one({"event_id": event_id}, {"$set": data})
    else:
        data["id"] = new_id()
        data["created_at"] = now_iso()
        await db.attendance_notes.insert_one(dict(data))
    await log_audit(user, "EDIT", "AttendanceNote", obj=event.get("code"), request=request)
    return await db.attendance_notes.find_one({"event_id": event_id}, {"_id": 0})


# ---------------- Documentation ----------------
class DocIn(BaseModel):
    title: str
    note: Optional[str] = ""
    file_name: Optional[str] = ""
    file_url: Optional[str] = None


@router.post("/events/{event_id}/documents")
async def add_document(event_id: str, body: DocIn, request: Request, user: dict = Depends(require("attendance.create", "attendance.edit"))):
    event = await db.attendance_events.find_one({"id": event_id})
    if not event:
        raise HTTPException(404, "Kegiatan apel tidak ditemukan")
    doc = {**body.model_dump(), "id": new_id(), "event_id": event_id, "created_by": user["id"], "created_at": now_iso()}
    await db.event_documents.insert_one(dict(doc))
    await log_audit(user, "CREATE", "EventDocument", obj=event.get("code"), request=request)
    return clean(doc)


@router.delete("/events/{event_id}/documents/{doc_id}")
async def delete_document(event_id: str, doc_id: str, user: dict = Depends(require("attendance.edit"))):
    await db.event_documents.delete_one({"id": doc_id, "event_id": event_id})
    return {"ok": True}


# ---------------- Personal summary (employee self view) ----------------
@router.get("/my-summary")
async def my_summary(user: dict = Depends(get_current_user)):
    if not user.get("employee_id"):
        return {"per_type": [], "overall_percentage": 0, "overall_present": 0, "overall_total": 0}
    return await employee_summary(user["employee_id"])


@router.get("/summary/{employee_id}")
async def get_summary(employee_id: str, user: dict = Depends(require("attendance.view"))):
    if not (has_perm(user, "employee.view_all") or user.get("is_super") or user.get("employee_id") == employee_id):
        raise HTTPException(403, "Akses ditolak")
    return await employee_summary(employee_id)
