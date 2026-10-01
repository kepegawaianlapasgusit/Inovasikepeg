# PRD — INFORMASI KEPEGAWAIAN LAGUSIT (Sistem Monitoring Kepegawaian)

Organisasi: Lapas Gunungsitoli
Owner/Admin: kepegawaianlapasgusit@gmail.com

## Original Problem Statement
Sistem informasi kepegawaian terintegrasi, production-ready, modular, RBAC + granular permission, backend authorization, configuration-driven (tanpa hardcode), tanpa gambar dekoratif, palet White+Navy+Gold+Silver. Prinsip inti: **pegawai adalah objek yang dipantau, bukan penginput absensi** (tidak ada self check-in). Notula Amanat adalah bagian dari Apel Event (bukan modul terpisah). Kehadiran apel otomatis masuk attendance dan dipakai di evaluasi.

## Architecture
- Frontend: React 19 (CRA/craco), Tailwind, shadcn/ui, react-router, sonner, lucide-react. Token JWT di localStorage, axios interceptor.
- Backend: FastAPI modular (`/app/backend/app/` → db, security, seed, routers/{auth,rbac,master,employees,attendance,modules,dashboard}). Semua route prefix `/api`.
- DB: MongoDB (uuid string ids, soft delete, `{_id:0}` projections).
- Auth: Email+Password JWT (bcrypt), brute-force lockout, login/logout audit, session timeout (TOKEN_TTL_HOURS=8), change/reset password.
- RBAC: USER→ROLE→PERMISSION, effective perms = union(role perms + extra), wildcard `*` untuk Super Admin. Menu & permission di-check di backend via `require()` dependency. Data scoping: employee.view_all vs self; operator apel-type restriction; evaluator assignments.

## User Personas
- Super Admin (kontrol penuh), Operator Apel (input kehadiran per jenis apel), Penilai (menilai pegawai yang ditugaskan), Pimpinan (monitoring sesuai permission), Pegawai (lihat data pribadi + rekap kehadiran sendiri). Multi-role didukung.

## Implemented (2026-10-01)
- Auth lengkap (login/logout/me/change-password, brute-force, audit).
- RBAC: Users CRUD + reset password, Roles CRUD + permission matrix, operator & evaluator assignment.
- Master Data dinamis (unit, seksi, jabatan, golongan, regu, jenis apel, status kehadiran, kategori) + System Settings (threshold KGB/pangkat).
- Kepegawaian: CRUD pegawai, search/filter/pagination, profil bertab (pribadi/kepegawaian/kehadiran/KGB/pangkat/dokumen/diklat/penghargaan).
- Absensi Apel (APEL EVENT): create event (kode APEL-YYYYMMDD-SESI), input kehadiran batch, duplicate prevention, rekap otomatis %, notula/amanat terintegrasi, dokumentasi (metadata), koreksi absensi + audit. Rekap pribadi pegawai.
- KGB & Kenaikan Pangkat: countdown + status (aman/mendekati/jatuh_tempo/terlambat), threshold configurable.
- Kalender & Agenda (bulanan), Pengumuman (+fan-out notifikasi), Notification center (badge, read-all).
- Penilaian: template builder dinamis + penilaian dengan nilai kehadiran otomatis dari attendance + approve.
- Dokumen, Cuti, Diklat, Penghargaan, Disiplin: CRUD terhubung DB.
- Laporan: rekap kehadiran apel (JSON + print). Global search (permission-aware). Audit Log. Dashboard (admin & pegawai).
- Landing page single-viewport tanpa gambar; desain navy/gold/silver; responsive (sidebar + mobile drawer).

## Testing
- Backend 36/36 pytest green (`/app/backend/tests/test_lagusit_api.py`). Frontend core flows verified via Playwright. No critical issues.

## Backlog / Remaining
- P1: Export PDF & Excel untuk Report Center (saat ini JSON + Print).
- P1: Upload file nyata via Google Drive API (butuh Google Cloud project, OAuth consent, Client ID/Secret & scope Drive dari user). Saat ini simpan metadata.
- P2: Reminder/notifikasi terjadwal (KGB/pangkat/agenda) via cron.
- P2: Laporan gabungan apel (informasi+rekap+notula+dokumentasi) satu halaman cetak.
- P2: Data-access scoping pimpinan per-unit yang lebih granular.
- P3: a11y DialogDescription pada dialog shadcn.

## Next Tasks
1. Export PDF/Excel laporan.
2. Integrasi Google Drive untuk upload dokumen & dokumentasi apel.
3. Reminder terjadwal (scheduled tasks).
