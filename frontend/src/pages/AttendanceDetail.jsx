import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMaster } from "@/hooks/useMaster";
import { Card, StatusPill, EmptyState } from "@/components/common/Ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ATTENDANCE_STATUS_STYLE, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, UserPlus, Wrench, Plus, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export default function AttendanceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { has } = useAuth();
  const { items: statuses } = useMaster("attendance_statuses");
  const [event, setEvent] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const canCreate = has("attendance.create");
  const canCorrect = has("attendance.correct");

  const loadEvent = useCallback(() => {
    api.get(`/attendance/events/${id}`).then(({ data }) => setEvent(data)).catch(() => navigate("/app/attendance"));
    api.get(`/attendance/events/${id}/records`).then(({ data }) => setRecords(data)).finally(() => setLoading(false));
  }, [id, navigate]);
  useEffect(() => { loadEvent(); }, [loadEvent]);

  if (!event) return <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={18} /> Memuat...</div>;
  const recap = event.recap || { total: 0, present: 0, percentage: 0, by_status: [] };

  return (
    <div>
      <button onClick={() => navigate("/app/attendance")} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-4" data-testid="back-btn">
        <ArrowLeft size={16} /> Kembali
      </button>

      <Card className="p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-semibold text-[#C9A227]">{event.code}</p>
            <h1 className="text-xl font-bold text-[#0B1F3A] mt-1">{event.attendance_type_name} — {event.session}</h1>
            <p className="text-sm text-slate-500 mt-1">{formatDate(event.date)} | {event.time} WIB</p>
            <p className="text-sm text-slate-600 mt-2">
              <b>Pembina:</b> {event.pembina || "-"}{event.pembina_jabatan ? ` (${event.pembina_jabatan})` : ""} · <b>Lokasi:</b> {event.location || "-"}
              {event.team_name ? ` · ${event.team_name}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-[#047857]">{recap.percentage}%</p>
            <p className="text-xs text-slate-500">{recap.present} dari {recap.total} hadir</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {recap.by_status.map((s) => (
            <div key={s.key} className="px-3 py-1.5 rounded-md border text-xs font-medium" style={{ background: ATTENDANCE_STATUS_STYLE[s.key]?.bg || "#F1F5F9", color: ATTENDANCE_STATUS_STYLE[s.key]?.text || "#334155", borderColor: ATTENDANCE_STATUS_STYLE[s.key]?.border || "#E2E8F0" }} data-testid={`recap-${s.key}`}>
              {s.label}: <b>{s.count}</b>
            </div>
          ))}
        </div>
      </Card>

      <Tabs defaultValue="kehadiran">
        <TabsList>
          <TabsTrigger value="informasi" data-testid="tab-informasi">Informasi</TabsTrigger>
          <TabsTrigger value="kehadiran" data-testid="tab-kehadiran">Kehadiran</TabsTrigger>
          <TabsTrigger value="notula" data-testid="tab-notula">Notula / Amanat</TabsTrigger>
          <TabsTrigger value="dokumentasi" data-testid="tab-dokumentasi">Dokumentasi</TabsTrigger>
        </TabsList>

        <TabsContent value="informasi">
          <Card className="p-6 space-y-2 text-sm">
            {[["Kode Kegiatan", event.code], ["Tanggal", formatDate(event.date)], ["Waktu", event.time], ["Jenis Apel", event.attendance_type_name], ["Sesi", event.session], ["Lokasi", event.location], ["Pembina", event.pembina], ["Jabatan Pembina", event.pembina_jabatan], ["Jumlah Peserta", event.jumlah_peserta], ["Catatan", event.catatan]].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">{k}</span><span className="font-medium text-slate-800 text-right">{v || "-"}</span>
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="kehadiran">
          <KehadiranTab event={event} records={records} statuses={statuses} loading={loading} canCreate={canCreate} canCorrect={canCorrect} reload={loadEvent} />
        </TabsContent>

        <TabsContent value="notula">
          <NotulaTab event={event} canEdit={canCreate} reload={loadEvent} />
        </TabsContent>

        <TabsContent value="dokumentasi">
          <DokumentasiTab event={event} canEdit={canCreate} reload={loadEvent} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KehadiranTab({ event, records, statuses, loading, canCreate, canCorrect, reload }) {
  const [addOpen, setAddOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [correct, setCorrect] = useState(null);

  const recordedIds = new Set(records.map((r) => r.employee_id));
  const defaultStatus = statuses.find((s) => s.key === "hadir")?.id;

  const openAdd = async () => {
    const { data } = await api.get("/employees?limit=500");
    const avail = (data.items || []).filter((e) => !recordedIds.has(e.id));
    setEmployees(avail);
    const d = {};
    avail.forEach((e) => { d[e.id] = { include: true, status_id: defaultStatus, keterangan: "" }; });
    setDraft(d);
    setAddOpen(true);
  };

  const saveBatch = async () => {
    const payload = { records: Object.entries(draft).filter(([, v]) => v.include).map(([employee_id, v]) => ({ employee_id, status_id: v.status_id, keterangan: v.keterangan })) };
    if (payload.records.length === 0) { toast.error("Pilih minimal satu pegawai"); return; }
    setSaving(true);
    try {
      const { data } = await api.post(`/attendance/events/${event.id}/records/batch`, payload);
      toast.success(`${data.created} kehadiran disimpan${data.skipped.length ? `, ${data.skipped.length} dilewati (duplikat)` : ""}`);
      setAddOpen(false);
      reload();
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  return (
    <div>
      {canCreate && (
        <div className="flex justify-end mb-3">
          <button onClick={openAdd} className="bg-[#0B1F3A] text-white px-4 py-2 rounded-md text-sm flex items-center gap-2" data-testid="input-attendance-btn"><UserPlus size={15} /> Input Kehadiran</button>
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[640px]" data-testid="records-table">
            <thead><tr className="bg-[#F8FAFC] border-b border-slate-200">
              {["Pegawai", "NIP", "Status", "Keterangan", canCorrect ? "Aksi" : ""].filter(Boolean).map((h) => <th key={h} className="text-xs font-bold uppercase text-slate-600 text-left py-3 px-4">{h}</th>)}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="py-10 text-center text-slate-400"><Loader2 className="animate-spin inline" /> Memuat...</td></tr>
                : records.length === 0 ? <tr><td colSpan={5}><EmptyState title="Belum ada kehadiran diinput" hint={canCreate ? "Klik Input Kehadiran untuk menambah." : ""} /></td></tr>
                : records.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 text-sm" data-testid={`record-${r.id}`}>
                    <td className="py-3 px-4 font-medium">{r.employee?.name || "-"}</td>
                    <td className="py-3 px-4 text-slate-500">{r.employee?.nip || "-"}</td>
                    <td className="py-3 px-4"><StatusPill style={ATTENDANCE_STATUS_STYLE[r.status_key] || { bg: "#F1F5F9", text: "#334155" }} label={r.status_label} /></td>
                    <td className="py-3 px-4 text-slate-600">{r.keterangan || "-"}</td>
                    {canCorrect && <td className="py-3 px-4"><button onClick={() => setCorrect(r)} className="text-xs text-[#6D28D9] hover:underline flex items-center gap-1" data-testid={`correct-${r.id}`}><Wrench size={13} /> Koreksi</button></td>}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-thin">
          <DialogHeader><DialogTitle className="text-[#0B1F3A]">Input Kehadiran Pegawai</DialogTitle></DialogHeader>
          {employees.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">Semua pegawai sudah tercatat pada kegiatan ini.</p> : (
            <div className="space-y-2">
              {employees.map((e) => (
                <div key={e.id} className="flex items-center gap-2 border-b border-slate-100 pb-2" data-testid={`draft-${e.id}`}>
                  <input type="checkbox" checked={draft[e.id]?.include} onChange={(ev) => setDraft({ ...draft, [e.id]: { ...draft[e.id], include: ev.target.checked } })} className="w-4 h-4" />
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{e.name}</p><p className="text-xs text-slate-400">{e.nip}</p></div>
                  <select value={draft[e.id]?.status_id} onChange={(ev) => setDraft({ ...draft, [e.id]: { ...draft[e.id], status_id: ev.target.value } })} className="border border-slate-300 rounded px-2 py-1 text-sm">
                    {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input placeholder="Keterangan" value={draft[e.id]?.keterangan || ""} onChange={(ev) => setDraft({ ...draft, [e.id]: { ...draft[e.id], keterangan: ev.target.value } })} className="border border-slate-300 rounded px-2 py-1 text-sm w-32" />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <button onClick={() => setAddOpen(false)} className="px-4 py-2 text-sm rounded-md border border-slate-300">Batal</button>
            <button onClick={saveBatch} disabled={saving} className="px-4 py-2 text-sm rounded-md bg-[#0B1F3A] text-white font-medium flex items-center gap-2" data-testid="save-batch-btn">{saving && <Loader2 size={14} className="animate-spin" />}<Save size={14} /> Simpan Kehadiran</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CorrectionModal record={correct} statuses={statuses} onClose={() => setCorrect(null)} reload={reload} />
    </div>
  );
}

function CorrectionModal({ record, statuses, onClose, reload }) {
  const [form, setForm] = useState({ status_id: "", keterangan: "", reason: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (record) setForm({ status_id: record.status_id, keterangan: record.keterangan || "", reason: "" }); }, [record]);
  if (!record) return null;

  const submit = async () => {
    if (!form.reason.trim()) { toast.error("Alasan koreksi wajib diisi"); return; }
    setSaving(true);
    try {
      await api.post(`/attendance/records/${record.id}/correct`, form);
      toast.success("Koreksi tersimpan & tercatat di audit log");
      onClose();
      reload();
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  return (
    <Dialog open={!!record} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="text-[#0B1F3A]">Koreksi Kehadiran — {record.employee?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><label className="text-sm font-medium text-slate-700">Status Baru</label>
            <select value={form.status_id} onChange={(e) => setForm({ ...form, status_id: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="correct-status">
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><label className="text-sm font-medium text-slate-700">Keterangan</label>
            <input value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="correct-keterangan" /></div>
          <div><label className="text-sm font-medium text-slate-700">Alasan Koreksi *</label>
            <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="correct-reason" /></div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-slate-300">Batal</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm rounded-md bg-[#6D28D9] text-white font-medium flex items-center gap-2" data-testid="save-correction-btn">{saving && <Loader2 size={14} className="animate-spin" />} Simpan Koreksi</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NotulaTab({ event, canEdit, reload }) {
  const [form, setForm] = useState({ tema: "", pokok: "", isi: "", tindak_lanjut: "", catatan: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (event.note) setForm({ tema: event.note.tema || "", pokok: event.note.pokok || "", isi: event.note.isi || "", tindak_lanjut: event.note.tindak_lanjut || "", catatan: event.note.catatan || "" }); }, [event.note]);

  const save = async () => {
    setSaving(true);
    try { await api.put(`/attendance/events/${event.id}/note`, form); toast.success("Notula tersimpan"); reload(); }
    catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  const f = (label, key, rows = 2) => (
    <div><label className="text-sm font-medium text-slate-700">{label}</label>
      <textarea disabled={!canEdit} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} rows={rows} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm disabled:bg-slate-50" data-testid={`notula-${key}`} /></div>
  );

  return (
    <Card className="p-6 space-y-4">
      <p className="text-sm text-slate-500">Pembina: <b>{event.pembina || "-"}</b> {event.pembina_jabatan ? `(${event.pembina_jabatan})` : ""} — otomatis dari informasi kegiatan.</p>
      <div><label className="text-sm font-medium text-slate-700">Tema / Judul Amanat</label>
        <input disabled={!canEdit} value={form.tema} onChange={(e) => setForm({ ...form, tema: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm disabled:bg-slate-50" data-testid="notula-tema" /></div>
      {f("Pokok-Pokok Amanat", "pokok", 3)}
      {f("Isi / Ringkasan Amanat", "isi", 4)}
      {f("Arahan / Tindak Lanjut", "tindak_lanjut", 3)}
      {f("Catatan Tambahan", "catatan", 2)}
      {canEdit && <button onClick={save} disabled={saving} className="bg-[#0B1F3A] text-white px-5 py-2.5 rounded-md text-sm font-medium flex items-center gap-2" data-testid="save-notula-btn">{saving && <Loader2 size={14} className="animate-spin" />}<Save size={14} /> Simpan Notula</button>}
    </Card>
  );
}

function DokumentasiTab({ event, canEdit, reload }) {
  const [form, setForm] = useState({ title: "", note: "", file_name: "" });
  const [saving, setSaving] = useState(false);
  const docs = event.documents || [];

  const add = async () => {
    if (!form.title.trim()) { toast.error("Judul wajib diisi"); return; }
    setSaving(true);
    try { await api.post(`/attendance/events/${event.id}/documents`, form); toast.success("Dokumentasi ditambahkan"); setForm({ title: "", note: "", file_name: "" }); reload(); }
    catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };
  const del = async (docId) => { await api.delete(`/attendance/events/${event.id}/documents/${docId}`); reload(); };

  return (
    <Card className="p-6">
      <p className="text-sm text-slate-500 mb-4">Dokumentasi Kegiatan Apel. Upload file akan tersedia setelah integrasi Google Drive. Saat ini catat judul, keterangan, dan nama file.</p>
      {canEdit && (
        <div className="grid sm:grid-cols-3 gap-3 mb-5 p-4 bg-slate-50 rounded-lg">
          <input placeholder="Judul dokumentasi" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="doc-title" />
          <input placeholder="Nama file (opsional)" value={form.file_name} onChange={(e) => setForm({ ...form, file_name: e.target.value })} className="border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="doc-file" />
          <input placeholder="Keterangan" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="doc-note" />
          <button onClick={add} disabled={saving} className="sm:col-span-3 bg-[#0B1F3A] text-white px-4 py-2 rounded-md text-sm flex items-center justify-center gap-2 w-fit" data-testid="add-doc-btn"><Plus size={14} /> Tambah Dokumentasi</button>
        </div>
      )}
      {docs.length === 0 ? <EmptyState title="Belum ada dokumentasi" /> : (
        <div className="divide-y divide-slate-100">
          {docs.map((d) => (
            <div key={d.id} className="py-3 flex items-center justify-between" data-testid={`doc-${d.id}`}>
              <div><p className="text-sm font-medium text-slate-800">{d.title}</p><p className="text-xs text-slate-500">{d.file_name} {d.note ? `· ${d.note}` : ""}</p></div>
              {canEdit && <button onClick={() => del(d.id)} className="text-red-500 p-1.5 hover:bg-red-50 rounded" data-testid={`del-doc-${d.id}`}><Trash2 size={15} /></button>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
