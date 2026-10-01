import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMaster } from "@/hooks/useMaster";
import { PageHeader } from "@/components/common/Ui";
import { DataTable } from "@/components/common/DataTable";
import { FormModal } from "@/components/common/FormModal";
import { toast } from "sonner";
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Employees() {
  const { has } = useAuth();
  const navigate = useNavigate();
  const { items: units } = useMaster("organizational_units");
  const { items: sections } = useMaster("sections");
  const { items: positions } = useMaster("positions");
  const { items: grades } = useMaster("grades");
  const { items: teams } = useMaster("teams");

  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [unitId, setUnitId] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState({ open: false, editing: null });
  const [submitting, setSubmitting] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const limit = 20;

  const canCreate = has("employee.create");
  const canEdit = has("employee.edit");
  const canDelete = has("employee.delete");

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page, limit });
    if (q) qs.set("q", q);
    if (unitId) qs.set("unit_id", unitId);
    api.get(`/employees?${qs.toString()}`).then(({ data }) => setData(data)).finally(() => setLoading(false));
  }, [page, q, unitId]);
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  const opt = (arr) => arr.map((x) => ({ value: x.id, label: x.name }));
  const fields = [
    { name: "nip", label: "NIP", type: "text", required: true },
    { name: "name", label: "Nama Lengkap", type: "text", required: true },
    { name: "gelar", label: "Gelar", type: "text" },
    { name: "nik", label: "NIK", type: "text" },
    { name: "tempat_lahir", label: "Tempat Lahir", type: "text" },
    { name: "tanggal_lahir", label: "Tanggal Lahir", type: "date" },
    { name: "jenis_kelamin", label: "Jenis Kelamin", type: "select", options: [{ value: "Laki-laki", label: "Laki-laki" }, { value: "Perempuan", label: "Perempuan" }] },
    { name: "phone", label: "Telepon", type: "text" },
    { name: "email", label: "Email", type: "text" },
    { name: "pendidikan", label: "Pendidikan", type: "text" },
    { name: "alamat", label: "Alamat", type: "textarea", span: 2 },
    { name: "grade_id", label: "Golongan/Pangkat", type: "select", options: grades.map((g) => ({ value: g.id, label: `${g.name} - ${g.pangkat || ""}` })) },
    { name: "position_id", label: "Jabatan", type: "select", options: opt(positions) },
    { name: "unit_id", label: "Unit/Bagian", type: "select", options: opt(units.filter((u) => u.type === "unit")) },
    { name: "section_id", label: "Seksi", type: "select", options: opt(sections) },
    { name: "team_id", label: "Regu (Rupam)", type: "select", options: opt(teams) },
    { name: "status_kepegawaian", label: "Status", type: "select", options: [{ value: "Aktif", label: "Aktif" }, { value: "Non-Aktif", label: "Non-Aktif" }, { value: "Pensiun", label: "Pensiun" }] },
    { name: "tmt_kerja", label: "TMT Kerja", type: "date" },
    { name: "tanggal_pensiun", label: "Tanggal Pensiun", type: "date" },
  ];

  const save = async (values) => {
    setSubmitting(true);
    try {
      if (values.jumlah_peserta) values.jumlah_peserta = Number(values.jumlah_peserta);
      if (modal.editing?.id) await api.put(`/employees/${modal.editing.id}`, values);
      else await api.post("/employees", values);
      toast.success("Data pegawai tersimpan");
      setModal({ open: false, editing: null });
      load();
    } catch (e) { toast.error(apiError(e)); } finally { setSubmitting(false); }
  };
  const doDelete = async () => {
    try { await api.delete(`/employees/${toDelete.id}`); toast.success("Dihapus"); load(); }
    catch (e) { toast.error(apiError(e)); } finally { setToDelete(null); }
  };

  const pages = Math.ceil(data.total / limit) || 1;

  return (
    <div>
      <PageHeader title="Kepegawaian" subtitle="Data pegawai Lapas Gunungsitoli" actions={canCreate && (
        <button onClick={() => setModal({ open: true, editing: { status_kepegawaian: "Aktif" } })} className="bg-[#C9A227] hover:bg-[#b59120] text-[#071426] font-semibold px-4 py-2 rounded-md text-sm flex items-center gap-2" data-testid="add-employee-btn">
          <Plus size={16} /> Tambah Pegawai
        </button>
      )} />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="Cari nama atau NIP..." className="w-full border border-slate-300 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]" data-testid="employee-search" />
        </div>
        <select value={unitId} onChange={(e) => { setPage(1); setUnitId(e.target.value); }} className="border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="employee-unit-filter">
          <option value="">Semua Unit</option>
          {units.filter((u) => u.type === "unit").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      <DataTable
        testid="employees-table"
        loading={loading}
        rows={data.items}
        onRowClick={(r) => navigate(`/app/employees/${r.id}`)}
        columns={[
          { key: "nip", label: "NIP" },
          { key: "name", label: "Nama", render: (r) => <span className="font-medium">{r.name}{r.gelar ? `, ${r.gelar}` : ""}</span> },
          { key: "position_name", label: "Jabatan", render: (r) => r.position_name || "-" },
          { key: "unit_name", label: "Unit", render: (r) => r.unit_name || "-" },
          { key: "grade_name", label: "Gol", render: (r) => r.grade_name || "-" },
          { key: "status_kepegawaian", label: "Status" },
          ...(canEdit || canDelete ? [{ key: "_a", label: "Aksi", render: (r) => (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              {canEdit && <button onClick={() => setModal({ open: true, editing: r })} className="text-xs text-[#0B1F3A] hover:underline" data-testid={`edit-${r.id}`}>Edit</button>}
              {canDelete && <button onClick={() => setToDelete(r)} className="text-xs text-red-500 hover:underline ml-2" data-testid={`delete-${r.id}`}>Hapus</button>}
            </div>
          ) }] : []),
        ]}
      />

      <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
        <span>Total {data.total} pegawai</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-2 rounded border border-slate-200 disabled:opacity-40" data-testid="emp-prev"><ChevronLeft size={15} /></button>
          <span>{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="p-2 rounded border border-slate-200 disabled:opacity-40" data-testid="emp-next"><ChevronRight size={15} /></button>
        </div>
      </div>

      <FormModal
        open={modal.open}
        onClose={() => setModal({ open: false, editing: null })}
        title={modal.editing?.id ? "Edit Pegawai" : "Tambah Pegawai"}
        fields={fields}
        initial={modal.editing}
        onSubmit={save}
        submitting={submitting}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus pegawai {toDelete?.name}?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-700" data-testid="confirm-delete">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
