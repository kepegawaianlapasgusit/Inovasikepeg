import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMaster } from "@/hooks/useMaster";
import { PageHeader, Card } from "@/components/common/Ui";
import { DataTable } from "@/components/common/DataTable";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function Attendance() {
  const { has } = useAuth();
  const navigate = useNavigate();
  const { items: types } = useMaster("attendance_types");
  const { items: teams } = useMaster("teams");
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const canCreate = has("attendance.create");

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/attendance/events?${typeFilter ? `attendance_type_id=${typeFilter}` : ""}`).then(({ data }) => setData(data)).finally(() => setLoading(false));
  }, [typeFilter]);
  useEffect(() => { load(); }, [load]);

  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), time: "07:30", attendance_type_id: "", session: "", team_id: "", location: "Lapangan Upacara", pembina: "", pembina_jabatan: "", jumlah_peserta: "", catatan: "" });
  const selectedType = types.find((t) => t.id === form.attendance_type_id);

  const create = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form, jumlah_peserta: Number(form.jumlah_peserta) || 0, team_id: form.team_id || null };
      const { data } = await api.post("/attendance/events", payload);
      toast.success("Kegiatan apel dibuat");
      setOpen(false);
      navigate(`/app/attendance/${data.id}`);
    } catch (e) { toast.error(apiError(e)); } finally { setSubmitting(false); }
  };

  return (
    <div>
      <PageHeader title="Absensi Apel" subtitle="Kegiatan apel, kehadiran, notula & dokumentasi" actions={canCreate && (
        <button onClick={() => setOpen(true)} className="bg-[#C9A227] hover:bg-[#b59120] text-[#071426] font-semibold px-4 py-2 rounded-md text-sm flex items-center gap-2" data-testid="create-event-btn">
          <Plus size={16} /> Buat Kegiatan Apel
        </button>
      )} />

      <div className="mb-4">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="event-type-filter">
          <option value="">Semua Jenis Apel</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <DataTable
        testid="events-table"
        loading={loading}
        rows={data.items}
        onRowClick={(r) => navigate(`/app/attendance/${r.id}`)}
        columns={[
          { key: "code", label: "Kode", render: (r) => <span className="font-mono text-xs font-semibold text-[#0B1F3A]">{r.code}</span> },
          { key: "date", label: "Tanggal", render: (r) => formatDate(r.date) },
          { key: "attendance_type_name", label: "Jenis Apel" },
          { key: "session", label: "Sesi" },
          { key: "pembina", label: "Pembina", render: (r) => r.pembina || "-" },
          { key: "recap", label: "Kehadiran", render: (r) => <span className="text-sm">{r.recap?.present}/{r.recap?.total} <span className="text-[#047857] font-semibold">({r.recap?.percentage}%)</span></span> },
        ]}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader><DialogTitle className="text-[#0B1F3A]">Buat Kegiatan Apel</DialogTitle></DialogHeader>
          <form onSubmit={create} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium text-slate-700">Jenis Apel *</label>
                <select required value={form.attendance_type_id} onChange={(e) => setForm({ ...form, attendance_type_id: e.target.value, session: "" })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="field-attendance_type_id">
                  <option value="">-- Pilih --</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div><label className="text-sm font-medium text-slate-700">Sesi *</label>
                <select required value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="field-session">
                  <option value="">-- Pilih --</option>
                  {(selectedType?.sessions || []).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="text-sm font-medium text-slate-700">Tanggal *</label>
                <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="field-date" /></div>
              <div><label className="text-sm font-medium text-slate-700">Waktu</label>
                <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="field-time" /></div>
              {selectedType?.kind === "rupam" && (
                <div><label className="text-sm font-medium text-slate-700">Regu</label>
                  <select value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="field-team_id">
                    <option value="">-- Pilih --</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div><label className="text-sm font-medium text-slate-700">Lokasi</label>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="field-location" /></div>
              <div><label className="text-sm font-medium text-slate-700">Pembina Apel</label>
                <input value={form.pembina} onChange={(e) => setForm({ ...form, pembina: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="field-pembina" /></div>
              <div><label className="text-sm font-medium text-slate-700">Jabatan Pembina</label>
                <input value={form.pembina_jabatan} onChange={(e) => setForm({ ...form, pembina_jabatan: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="field-pembina_jabatan" /></div>
              <div className="col-span-2"><label className="text-sm font-medium text-slate-700">Catatan</label>
                <textarea value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} rows={2} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="field-catatan" /></div>
            </div>
            <DialogFooter>
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm rounded-md border border-slate-300 text-slate-600">Batal</button>
              <button type="submit" disabled={submitting} className="px-4 py-2 text-sm rounded-md bg-[#0B1F3A] text-white font-medium flex items-center gap-2" data-testid="submit-event">
                {submitting && <Loader2 size={14} className="animate-spin" />} Buat & Lanjut Input Kehadiran
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
