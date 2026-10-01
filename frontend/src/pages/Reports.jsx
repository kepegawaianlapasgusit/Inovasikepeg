import { useState } from "react";
import { api, downloadFile } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMaster } from "@/hooks/useMaster";
import { PageHeader, Card, EmptyState } from "@/components/common/Ui";
import { DataTable } from "@/components/common/DataTable";
import { toast } from "sonner";
import { BarChart3, Printer, Search, FileSpreadsheet, FileText, Download, Users } from "lucide-react";

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

  return (
    <div>
      <PageHeader title="Pusat Laporan" subtitle="Rekap kehadiran apel & laporan kepegawaian" />

      {has("report.export", "employee.view_all") && (
        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-[#C9A227]" />
              <div>
                <h2 className="text-sm font-semibold text-slate-700">Laporan Data Pegawai</h2>
                <p className="text-xs text-slate-400">Unduh daftar seluruh pegawai.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => doExport("/reports/employees/export", "excel", "data-pegawai.xlsx")} className="border border-slate-300 hover:bg-slate-50 px-3 py-2 rounded-md text-sm flex items-center gap-2" data-testid="export-emp-excel"><FileSpreadsheet size={15} className="text-green-600" /> Excel</button>
              <button onClick={() => doExport("/reports/employees/export", "pdf", "data-pegawai.pdf")} className="border border-slate-300 hover:bg-slate-50 px-3 py-2 rounded-md text-sm flex items-center gap-2" data-testid="export-emp-pdf"><FileText size={15} className="text-red-600" /> PDF</button>
            </div>
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
      </Card>

      {report ? (
        report.rows.length === 0 ? (
          <Card className="p-6"><EmptyState icon={BarChart3} title="Tidak ada data pada periode ini" /></Card>
        ) : (
          <DataTable
            testid="report-table"
            loading={loading}
            rows={report.rows}
            columns={[
              { key: "type_name", label: "Jenis Apel" },
              { key: "total_events", label: "Total Kegiatan" },
              ...statusCols,
            ]}
          />
        )
      ) : (
        <Card className="p-6"><EmptyState icon={BarChart3} title="Pilih filter lalu klik Tampilkan" hint="Laporan dihitung langsung dari data kehadiran di database. Tersedia export Excel, PDF & Cetak." /></Card>
      )}
    </div>
  );
}

