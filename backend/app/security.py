import os
import jwt
import bcrypt
from datetime import datetime, timezone, timedelta
from fastapi import Request, HTTPException, Depends
from .db import db

JWT_ALGORITHM = "HS256"


# ---------------- Permission Catalog ----------------
# Format: module.action -> label
PERMISSION_CATALOG = [
    {"key": "dashboard.view", "label": "Lihat Dashboard", "module": "Dashboard"},
    {"key": "employee.view", "label": "Lihat Pegawai", "module": "Kepegawaian"},
    {"key": "employee.view_all", "label": "Lihat Semua Pegawai", "module": "Kepegawaian"},
    {"key": "employee.create", "label": "Tambah Pegawai", "module": "Kepegawaian"},
    {"key": "employee.edit", "label": "Edit Pegawai", "module": "Kepegawaian"},
    {"key": "employee.delete", "label": "Hapus Pegawai", "module": "Kepegawaian"},
    {"key": "attendance.view", "label": "Lihat Absensi", "module": "Absensi Apel"},
    {"key": "attendance.create", "label": "Input Absensi / Kegiatan Apel", "module": "Absensi Apel"},
    {"key": "attendance.edit", "label": "Edit Absensi", "module": "Absensi Apel"},
    {"key": "attendance.correct", "label": "Koreksi Absensi", "module": "Absensi Apel"},
    {"key": "attendance.delete", "label": "Hapus Absensi", "module": "Absensi Apel"},
    {"key": "attendance.export", "label": "Export Absensi", "module": "Absensi Apel"},
    {"key": "kgb.view", "label": "Lihat KGB", "module": "KGB"},
    {"key": "kgb.manage", "label": "Kelola KGB", "module": "KGB"},
    {"key": "promotion.view", "label": "Lihat Kenaikan Pangkat", "module": "Kenaikan Pangkat"},
    {"key": "promotion.manage", "label": "Kelola Kenaikan Pangkat", "module": "Kenaikan Pangkat"},
    {"key": "calendar.view", "label": "Lihat Kalender & Agenda", "module": "Kalender & Agenda"},
    {"key": "calendar.manage", "label": "Kelola Agenda", "module": "Kalender & Agenda"},
    {"key": "announcement.view", "label": "Lihat Pengumuman", "module": "Pengumuman"},
    {"key": "announcement.manage", "label": "Kelola Pengumuman", "module": "Pengumuman"},
    {"key": "notification.view", "label": "Lihat Notifikasi", "module": "Notifikasi"},
    {"key": "evaluation.view", "label": "Lihat Penilaian", "module": "Penilaian Pegawai"},
    {"key": "evaluation.create", "label": "Buat Penilaian", "module": "Penilaian Pegawai"},
    {"key": "evaluation.edit", "label": "Edit Penilaian", "module": "Penilaian Pegawai"},
    {"key": "evaluation.approve", "label": "Setujui Penilaian", "module": "Penilaian Pegawai"},
    {"key": "document.view", "label": "Lihat Dokumen", "module": "Dokumen"},
    {"key": "document.manage", "label": "Kelola Dokumen", "module": "Dokumen"},
    {"key": "leave.view", "label": "Lihat Cuti", "module": "Cuti"},
    {"key": "leave.manage", "label": "Kelola Cuti", "module": "Cuti"},
    {"key": "training.view", "label": "Lihat Pendidikan & Diklat", "module": "Pendidikan & Diklat"},
    {"key": "training.manage", "label": "Kelola Pendidikan & Diklat", "module": "Pendidikan & Diklat"},
    {"key": "award.view", "label": "Lihat Penghargaan", "module": "Penghargaan"},
    {"key": "award.manage", "label": "Kelola Penghargaan", "module": "Penghargaan"},
    {"key": "discipline.view", "label": "Lihat Disiplin", "module": "Disiplin"},
    {"key": "discipline.manage", "label": "Kelola Disiplin", "module": "Disiplin"},
    {"key": "report.view", "label": "Lihat Laporan", "module": "Laporan"},
    {"key": "report.export", "label": "Export Laporan", "module": "Laporan"},
    {"key": "user.manage", "label": "Kelola User", "module": "User Management"},
    {"key": "role.manage", "label": "Kelola Role", "module": "User Management"},
    {"key": "permission.manage", "label": "Kelola Permission", "module": "User Management"},
    {"key": "master_data.manage", "label": "Kelola Master Data", "module": "Master Data"},
    {"key": "audit_log.view", "label": "Lihat Audit Log", "module": "Audit Log"},
    {"key": "settings.manage", "label": "Pengaturan Sistem", "module": "Pengaturan Sistem"},
]

ALL_PERMISSION_KEYS = [p["key"] for p in PERMISSION_CATALOG]

# Menu definition: each item requires a permission (any_of) to appear
MENU = [
    {"key": "dashboard", "label": "Dashboard", "path": "/app", "icon": "LayoutDashboard", "perms": ["dashboard.view"]},
    {"key": "employees", "label": "Kepegawaian", "path": "/app/employees", "icon": "Users", "perms": ["employee.view"]},
    {"key": "attendance", "label": "Absensi Apel", "path": "/app/attendance", "icon": "ClipboardCheck", "perms": ["attendance.view"]},
    {"key": "kgb", "label": "KGB", "path": "/app/kgb", "icon": "TrendingUp", "perms": ["kgb.view"]},
    {"key": "promotion", "label": "Kenaikan Pangkat", "path": "/app/promotion", "icon": "Award", "perms": ["promotion.view"]},
    {"key": "calendar", "label": "Kalender & Agenda", "path": "/app/calendar", "icon": "Calendar", "perms": ["calendar.view"]},
    {"key": "announcements", "label": "Pengumuman", "path": "/app/announcements", "icon": "Megaphone", "perms": ["announcement.view"]},
    {"key": "notifications", "label": "Notifikasi", "path": "/app/notifications", "icon": "Bell", "perms": ["notification.view"]},
    {"key": "evaluation", "label": "Penilaian Pegawai", "path": "/app/evaluation", "icon": "ClipboardList", "perms": ["evaluation.view"]},
    {"key": "documents", "label": "Dokumen", "path": "/app/documents", "icon": "FileText", "perms": ["document.view"]},
    {"key": "leave", "label": "Cuti", "path": "/app/leave", "icon": "CalendarOff", "perms": ["leave.view"]},
    {"key": "training", "label": "Pendidikan & Diklat", "path": "/app/training", "icon": "GraduationCap", "perms": ["training.view"]},
    {"key": "awards", "label": "Penghargaan", "path": "/app/awards", "icon": "Medal", "perms": ["award.view"]},
    {"key": "discipline", "label": "Disiplin", "path": "/app/discipline", "icon": "ShieldAlert", "perms": ["discipline.view"]},
    {"key": "reports", "label": "Laporan", "path": "/app/reports", "icon": "BarChart3", "perms": ["report.view"]},
    {"key": "users", "label": "User Management", "path": "/app/users", "icon": "UserCog", "perms": ["user.manage", "role.manage"]},
    {"key": "master", "label": "Master Data", "path": "/app/master", "icon": "Database", "perms": ["master_data.manage"]},
    {"key": "audit", "label": "Audit Log", "path": "/app/audit", "icon": "ScrollText", "perms": ["audit_log.view"]},
    {"key": "settings", "label": "Pengaturan Sistem", "path": "/app/settings", "icon": "Settings", "perms": ["settings.manage"]},
]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _ttl_hours() -> int:
    try:
        return int(os.environ.get("TOKEN_TTL_HOURS", "8"))
    except ValueError:
        return 8


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=_ttl_hours()),
        "type": "access",
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


async def compute_permissions(user: dict) -> dict:
    """Attach effective permissions (union of roles + extra) and is_super flag."""
    role_ids = user.get("role_ids", []) or []
    perms = set(user.get("extra_permissions", []) or [])
    is_super = False
    role_names = []
    if role_ids:
        async for role in db.roles.find({"id": {"$in": role_ids}}):
            role_names.append(role.get("name"))
            rperms = role.get("permissions", []) or []
            if "*" in rperms:
                is_super = True
            perms.update(rperms)
    if "*" in perms:
        is_super = True
    user["role_names"] = role_names
    user["is_super"] = is_super
    user["permissions"] = sorted(perms) if not is_super else ["*"]
    return user


async def get_current_user(request: Request) -> dict:
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi telah berakhir, silakan login kembali")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")
    user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User tidak ditemukan")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan")
    user.pop("password_hash", None)
    await compute_permissions(user)
    return user


def has_perm(user: dict, *required: str) -> bool:
    if user.get("is_super") or "*" in user.get("permissions", []):
        return True
    perms = set(user.get("permissions", []))
    return any(r in perms for r in required)


def require(*required: str):
    async def dependency(user: dict = Depends(get_current_user)) -> dict:
        if not has_perm(user, *required):
            raise HTTPException(status_code=403, detail="Akses ditolak: izin tidak mencukupi")
        return user
    return dependency
