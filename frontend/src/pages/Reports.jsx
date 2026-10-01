import { useState } from "react";
import { api, downloadFile } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMaster } from "@/hooks/useMaster";
import { PageHeader, Card, EmptyState } from "@/components/common/Ui";
import { DataTable } from "@/components/common/DataTable";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import {
  BarChart3, Printer, Search, FileSpreadsheet, FileText, Users,
  TrendingUp, Award, CalendarOff, ClipboardList, ScrollText,
} from "lucide-react";

export default function Reports() {
  const { has } = useAuth();
  const { items: types } = useMaster("attendance_types");
  const [filter, setFilter] = useState({ attendance_type_id: "", date_from: "", date_to: "" });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const canExport = has("report.export", "attendance.export");

  const qs = () => new URLSearchParams(Object.entries(filter).filter(([, v]) => v)).toString();

  const run = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/reports/attendance-recap?${qs()}`);
      setReport(data);
    } catch { toast.error("Gagal memuat laporan"); } finally { setLoading(false); }
  };

  const doExport = async (endpoint, format, name) => {
    try {
      await downloadFile(`${endpoint}${endpoint.includes("?") ? "&" : "?"}format=${format}`, name);
      toast.success(`Mengunduh ${name}`);
    } catch { toast.error("Export gagal — periksa izin export Anda"); }
  };

  const statusCols = (report?.statuses || []).map((s) => ({ key: s.key, label: s.label, render: (r) => r[s.key] ?? 0 }));

  const modules = [
    { key: "employees", label: "Data Pegawai", icon: Users, endpoint: "/reports/employees/export", perm: "employee.view_all", file: "data-pegawai" },
    { key: "kgb", label: "KGB", icon: TrendingUp, endpoint: "/reports/kgb/export", perm: "kgb.view", file: "laporan-kgb" },
    { key: "promotion", label: "Kenaikan Pangkat", icon: Award, endpoint: "/reports/promotion/export", perm: "promotion.view", file: "laporan-kenaikan-pangkat" },
    { key: "leave", label: "Cuti", icon: CalendarOff, endpoint: "/reports/leave/export", perm: "leave.view", file: "laporan-cuti" },
    { key: "evaluation", label: "Penilaian Pegawai", icon: ClipboardList, endpoint: "/reports/evaluation/export", perm: "evaluation.view", file: "laporan-penilaian" },
  ].filter((m) => has("report.export") && has(m.perm));

  return (
    <div>
      <PageHeader title="Pusat Laporan" subtitle="Rekap, notula, dan export laporan kepegawaian" />

      {modules.length > 0 && (
        <Card className="p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Export Laporan Modul</h2>
          <div className="divide-y divide-slate-100">
            {modules.map((m) => (
              <div key={m.key} className="flex items-center justify-between py-3 flex-wrap gap-2" data-testid={`report-row-${m.key}`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#0B1F3A]/5 text-[#0B1F3A] flex items-center justify-center"><m.icon size={17} /></div>
                  <span className="text-sm font-medium text-slate-700">{m.label}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => doExport(m.endpoint, "excel", `${m.file}.xlsx`)} className="border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-md text-sm flex items-center gap-2" data-testid={`export-${m.key}-excel`}><FileSpreadsheet size={15} className="text-green-600" /> Excel</button>
                  <button onClick={() => doExport(m.endpoint, "pdf", `${m.file}.pdf`)} className="border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-md text-sm flex items-center gap-2" data-testid={`export-${m.key}-pdf`}><FileText size={15} className="text-red-600" /> PDF</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Rekap Kehadiran Apel</h2>
        <div className="grid sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-slate-500">Jenis Apel</label>
            <select value={filter.attendance_type_id} onChange={(e) => setFilter({ ...filter, attendance_type_id: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="report-type">
              <option value="">Semua</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Dari Tanggal</label>
            <input type="date" value={filter.date_from} onChange={(e) => setFilter({ ...filter, date_from: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="report-from" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Sampai Tanggal</label>
            <input type="date" value={filter.date_to} onChange={(e) => setFilter({ ...filter, date_to: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="report-to" />
          </div>
          <div className="flex items-end">
            <button onClick={run} className="w-full bg-[#C9A227] hover:bg-[#b59120] text-[#071426] font-semibold px-4 py-2 rounded-md text-sm flex items-center justify-center gap-2" data-testid="report-run"><Search size={15} /> Tampilkan</button>
          </div>
        </div>
        {report && canExport && (
          <div className="flex gap-2 mt-4">
            <button onClick={() => doExport(`/reports/attendance-recap/export?${qs()}`, "excel", "rekap-kehadiran.xlsx")} className="border border-slate-300 hover:bg-slate-50 px-3 py-2 rounded-md text-sm flex items-center gap-2" data-testid="export-recap-excel"><FileSpreadsheet size={15} className="text-green-600" /> Excel</button>
            <button onClick={() => doExport(`/reports/attendance-recap/export?${qs()}`, "pdf", "rekap-kehadiran.pdf")} className="border border-slate-300 hover:bg-slate-50 px-3 py-2 rounded-md text-sm flex items-center gap-2" data-testid="export-recap-pdf"><FileText size={15} className="text-red-600" /> PDF</button>
            <button onClick={() => window.print()} className="border border-slate-300 hover:bg-slate-50 px-3 py-2 rounded-md text-sm flex items-center gap-2" data-testid="print-btn"><Printer size={15} /> Cetak</button>
          </div>
        )}
        {report && (report.rows.length === 0 ? (
          <div className="mt-4"><EmptyState icon={BarChart3} title="Tidak ada data pada periode ini" /></div>
        ) : (
          <div className="mt-4">
            <DataTable testid="report-table" loading={loading} rows={report.rows} columns={[{ key: "type_name", label: "Jenis Apel" }, { key: "total_events", label: "Total Kegiatan" }, ...statusCols]} />
          </div>
        ))}
      </Card>

      <NotulaReport types={types} canExport={canExport} doExport={doExport} />
    </div>
  );
}

function NotulaReport({ types, canExport, doExport }) {
  const [f, setF] = useState({ date_from: "", date_to: "", pembina: "", location: "" });
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);

  const qs = () => new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();

  const run = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/reports/notula?${qs()}`);
      setItems(data.items);
    } catch { toast.error("Gagal memuat notula"); } finally { setLoading(false); }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <ScrollText size={18} className="text-[#C9A227]" />
        <h2 className="text-sm font-semibold text-slate-700">Laporan Notula Apel Staf</h2>
      </div>
      <div className="grid sm:grid-cols-5 gap-3">
        <div>
          <label className="text-xs text-slate-500">Dari Tanggal</label>
          <input type="date" value={f.date_from} onChange={(e) => setF({ ...f, date_from: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="notula-from" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Sampai Tanggal</label>
          <input type="date" value={f.date_to} onChange={(e) => setF({ ...f, date_to: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="notula-to" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Pembina</label>
          <input value={f.pembina} onChange={(e) => setF({ ...f, pembina: e.target.value })} placeholder="Nama pembina" className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="notula-pembina" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Lokasi</label>
          <input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Lokasi" className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="notula-location" />
        </div>
        <div className="flex items-end">
          <button onClick={run} className="w-full bg-[#C9A227] hover:bg-[#b59120] text-[#071426] font-semibold px-4 py-2 rounded-md text-sm flex items-center justify-center gap-2" data-testid="notula-run"><Search size={15} /> Tampilkan</button>
        </div>
      </div>

      {items && canExport && (
        <div className="flex gap-2 mt-4">
          <button onClick={() => doExport(`/reports/notula/export?${qs()}`, "pdf", "laporan-notula-apel.pdf")} className="border border-slate-300 hover:bg-slate-50 px-3 py-2 rounded-md text-sm flex items-center gap-2" data-testid="export-notula-pdf"><FileText size={15} className="text-red-600" /> Export PDF</button>
        </div>
      )}

      {items && (
        items.length === 0 ? (
          <div className="mt-4"><EmptyState icon={ScrollText} title="Tidak ada notula pada filter ini" /></div>
        ) : (
          <div className="mt-4 space-y-3">
            {items.map((it) => (
              <div key={it.code} className="border border-slate-200 rounded-lg p-4" data-testid={`notula-item-${it.code}`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="font-mono text-xs font-semibold text-[#0B1F3A]">{it.code}</p>
                  <p className="text-xs text-slate-500">{formatDate(it.date)} · {it.time} · {it.session} · Hadir {it.recap.present}/{it.recap.total} ({it.recap.percentage}%)</p>
                </div>
                <p className="text-sm text-slate-600 mt-1"><b>Pembina:</b> {it.pembina || "-"} ({it.pembina_jabatan || "-"}) · <b>Lokasi:</b> {it.location || "-"}</p>
                <div className="mt-2 text-sm text-slate-700 space-y-0.5">
                  <p><b>Tema:</b> {it.tema || "-"}</p>
                  <p><b>Pokok Amanat:</b> {it.pokok || "-"}</p>
                  <p><b>Tindak Lanjut:</b> {it.tindak_lanjut || "-"}</p>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </Card>
  );
}
