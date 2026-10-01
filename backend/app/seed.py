import os
from .db import db, now_iso, new_id
from .security import hash_password, PERMISSION_CATALOG, ALL_PERMISSION_KEYS


async def _upsert(coll, doc):
    await coll.update_one({"id": doc["id"]}, {"$setOnInsert": doc}, upsert=True)


async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.employees.create_index("id", unique=True)
    await db.attendance_records.create_index(
        [("employee_id", 1), ("date", 1), ("attendance_type_id", 1), ("session", 1)]
    )
    await db.audit_logs.create_index("timestamp")
    await db.login_attempts.create_index("identifier")


async def seed():
    await ensure_indexes()

    # Permissions catalog
    for p in PERMISSION_CATALOG:
        await db.permissions.update_one(
            {"key": p["key"]},
            {"$set": {"key": p["key"], "label": p["label"], "module": p["module"]}},
            upsert=True,
        )

    # Roles
    pegawai_perms = [
        "dashboard.view", "employee.view", "attendance.view", "kgb.view", "promotion.view",
        "calendar.view", "announcement.view", "notification.view", "evaluation.view",
        "document.view", "training.view", "award.view",
    ]
    operator_perms = [
        "dashboard.view", "employee.view", "employee.view_all", "attendance.view",
        "attendance.create", "attendance.edit", "attendance.export", "calendar.view",
        "announcement.view", "notification.view",
    ]
    penilai_perms = [
        "dashboard.view", "employee.view", "employee.view_all", "attendance.view",
        "evaluation.view", "evaluation.create", "evaluation.edit", "notification.view",
    ]
    pimpinan_perms = [
        "dashboard.view", "employee.view", "employee.view_all", "attendance.view",
        "kgb.view", "promotion.view", "calendar.view", "announcement.view", "notification.view",
        "evaluation.view", "document.view", "report.view", "report.export",
    ]
    roles = [
        {"id": "role-superadmin", "name": "Super Admin", "description": "Kontrol penuh sistem", "permissions": ["*"], "system": True},
        {"id": "role-pegawai", "name": "Pegawai", "description": "Akses data pribadi", "permissions": pegawai_perms, "system": True},
        {"id": "role-operator", "name": "Operator Apel", "description": "Input kegiatan & kehadiran apel", "permissions": operator_perms, "system": False},
        {"id": "role-penilai", "name": "Penilai", "description": "Menilai pegawai yang ditugaskan", "permissions": penilai_perms, "system": False},
        {"id": "role-pimpinan", "name": "Pimpinan", "description": "Monitoring sesuai permission", "permissions": pimpinan_perms, "system": False},
    ]
    for r in roles:
        r.update({"is_active": True, "deleted": False, "created_at": now_iso()})
        await _upsert(db.roles, r)

    # Admin user
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": new_id(),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Super Administrator",
            "username": "superadmin",
            "role_ids": ["role-superadmin"],
            "extra_permissions": [],
            "employee_id": None,
            "is_active": True,
            "deleted": False,
            "created_at": now_iso(),
        })

    # Master data
    org = {"id": "org-lapas", "name": "Lapas Gunungsitoli", "type": "organization", "parent_id": None}
    await _upsert(db.organizational_units, {**org, "is_active": True, "deleted": False, "created_at": now_iso()})

    units = [
        {"id": "unit-kplp", "name": "KPLP", "parent_id": "org-lapas"},
        {"id": "unit-adm", "name": "Sub Bagian Tata Usaha", "parent_id": "org-lapas"},
        {"id": "unit-binadik", "name": "Seksi Pembinaan", "parent_id": "org-lapas"},
        {"id": "unit-giatja", "name": "Seksi Kegiatan Kerja", "parent_id": "org-lapas"},
        {"id": "unit-admkamtib", "name": "Seksi Administrasi Keamanan & Ketertiban", "parent_id": "org-lapas"},
    ]
    for u in units:
        await _upsert(db.organizational_units, {**u, "type": "unit", "is_active": True, "deleted": False, "created_at": now_iso()})

    sections = [
        {"id": "sec-umum", "name": "Urusan Umum", "unit_id": "unit-adm"},
        {"id": "sec-keuangan", "name": "Urusan Keuangan", "unit_id": "unit-adm"},
        {"id": "sec-registrasi", "name": "Sub Seksi Registrasi", "unit_id": "unit-binadik"},
        {"id": "sec-bimkemas", "name": "Sub Seksi Bimbingan Kemasyarakatan", "unit_id": "unit-binadik"},
        {"id": "sec-keamanan", "name": "Sub Seksi Keamanan", "unit_id": "unit-admkamtib"},
        {"id": "sec-pelaporan", "name": "Sub Seksi Pelaporan & Tata Tertib", "unit_id": "unit-admkamtib"},
    ]
    for s in sections:
        await _upsert(db.sections, {**s, "is_active": True, "deleted": False, "created_at": now_iso()})

    positions = [
        {"id": "pos-kalapas", "name": "Kepala Lapas"},
        {"id": "pos-kasubbag", "name": "Kepala Sub Bagian Tata Usaha"},
        {"id": "pos-kasi", "name": "Kepala Seksi"},
        {"id": "pos-kasubsi", "name": "Kepala Sub Seksi"},
        {"id": "pos-staf", "name": "Staf"},
        {"id": "pos-penjaga", "name": "Petugas Penjagaan"},
    ]
    for p in positions:
        await _upsert(db.positions, {**p, "is_active": True, "deleted": False, "created_at": now_iso()})

    grades = [
        {"id": "gol-iia", "name": "II/a", "pangkat": "Pengatur Muda"},
        {"id": "gol-iib", "name": "II/b", "pangkat": "Pengatur Muda Tingkat I"},
        {"id": "gol-iic", "name": "II/c", "pangkat": "Pengatur"},
        {"id": "gol-iid", "name": "II/d", "pangkat": "Pengatur Tingkat I"},
        {"id": "gol-iiia", "name": "III/a", "pangkat": "Penata Muda"},
        {"id": "gol-iiib", "name": "III/b", "pangkat": "Penata Muda Tingkat I"},
        {"id": "gol-iiic", "name": "III/c", "pangkat": "Penata"},
        {"id": "gol-iiid", "name": "III/d", "pangkat": "Penata Tingkat I"},
        {"id": "gol-iva", "name": "IV/a", "pangkat": "Pembina"},
    ]
    for g in grades:
        await _upsert(db.grades, {**g, "is_active": True, "deleted": False, "created_at": now_iso()})

    teams = [
        {"id": "regu-a", "name": "Rupam A"},
        {"id": "regu-b", "name": "Rupam B"},
        {"id": "regu-c", "name": "Rupam C"},
        {"id": "regu-d", "name": "Rupam D"},
    ]
    for t in teams:
        await _upsert(db.teams, {**t, "is_active": True, "deleted": False, "created_at": now_iso()})

    att_types = [
        {"id": "att-staf", "name": "Apel Staf", "kind": "staf", "sessions": ["Pagi", "Siang/Sore"]},
        {"id": "att-rupam", "name": "Serah Terima Regu Penjagaan", "kind": "rupam", "sessions": ["Pagi", "Siang", "Malam"]},
    ]
    for a in att_types:
        await _upsert(db.attendance_types, {**a, "is_active": True, "deleted": False, "created_at": now_iso()})

    statuses = [
        {"id": "st-hadir", "name": "Hadir", "key": "hadir", "counts_present": True, "order": 1},
        {"id": "st-terlambat", "name": "Terlambat", "key": "terlambat", "counts_present": True, "order": 2},
        {"id": "st-izin", "name": "Izin", "key": "izin", "counts_present": False, "order": 3},
        {"id": "st-sakit", "name": "Sakit", "key": "sakit", "counts_present": False, "order": 4},
        {"id": "st-dinas", "name": "Dinas", "key": "dinas", "counts_present": True, "order": 5},
        {"id": "st-cuti", "name": "Cuti", "key": "cuti", "counts_present": False, "order": 6},
        {"id": "st-tk", "name": "Tanpa Keterangan", "key": "tanpa_keterangan", "counts_present": False, "order": 7},
    ]
    for s in statuses:
        await _upsert(db.attendance_statuses, {**s, "is_active": True, "deleted": False, "created_at": now_iso()})

    categories = [
        ("document", ["SK", "SK Pangkat", "SK Jabatan", "KGB", "Ijazah", "Sertifikat", "Diklat", "Piagam", "Lainnya"]),
        ("agenda", ["Rapat", "Apel", "Kunjungan", "Pelatihan", "Kegiatan", "Lainnya"]),
        ("leave", ["Cuti Tahunan", "Cuti Sakit", "Cuti Besar", "Cuti Alasan Penting", "Cuti Melahirkan"]),
        ("award", ["Satyalancana", "Piagam Penghargaan", "Penghargaan Internal", "Lainnya"]),
        ("evaluation", ["Perilaku Kerja", "Kinerja", "Kehadiran", "Kedisiplinan"]),
    ]
    for ctype, names in categories:
        for n in names:
            cid = f"cat-{ctype}-{n.lower().replace(' ', '-').replace('/', '-')}"
            await _upsert(db.categories, {"id": cid, "type": ctype, "name": n, "is_active": True, "deleted": False, "created_at": now_iso()})

    # System settings
    await db.system_settings.update_one(
        {"id": "global"},
        {"$setOnInsert": {
            "id": "global",
            "app_name": "INFORMASI KEPEGAWAIAN LAGUSIT",
            "subtitle": "Sistem Monitoring Kepegawaian",
            "organization": "Lapas Gunungsitoli",
            "kgb_threshold_days": 90,
            "promotion_threshold_days": 120,
            "created_at": now_iso(),
        }},
        upsert=True,
    )
