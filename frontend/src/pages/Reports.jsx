import { useState } from "react";
import { api } from "@/lib/api";
import { useMaster } from "@/hooks/useMaster";
import { PageHeader, Card, EmptyState } from "@/components/common/Ui";
import { DataTable } from "@/components/common/DataTable";
import { toast } from "sonner";
import { BarChart3, Printer, Search } from "lucide-react";

export default function Reports() {
  const { items: types } = useMaster("attendance_types");
  const [filter, setFilter] = useState({ attendance_type_id: "", date_from: "", date_to: "" });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams(Object.entries(filter).filter(([, v]) => v)).toString();
      const { data } = await api.get(`/reports/attendance-recap?${qs}`);
      setReport(data);
    } catch { toast.error("Gagal memuat laporan"); } finally { setLoading(false); }
  };

  const statusCols = (report?.statuses || []).map((s) => ({ key: s.key, label: s.label, render: (r) => r[s.key] ?? 0 }));

  return (
    <div>
      <PageHeader title="Pusat Laporan" subtitle="Rekap kehadiran apel & laporan kepegawaian" actions={
        report && <button onClick={() => window.print()} className="bg-[#0B1F3A] text-white px-4 py-2 rounded-md text-sm flex items-center gap-2" data-testid="print-btn"><Printer size={15} /> Cetak</button>
      } />

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
        <Card className="p-6"><EmptyState icon={BarChart3} title="Pilih filter lalu klik Tampilkan" hint="Laporan dihitung langsung dari data kehadiran di database." /></Card>
      )}
      <p className="text-xs text-slate-400 mt-4">Export PDF & Excel akan tersedia pada fase laporan lanjutan.</p>
    </div>
  );
}
