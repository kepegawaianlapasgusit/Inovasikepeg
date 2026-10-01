import { useState, useEffect, useCallback } from "react";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, StatusPill } from "@/components/common/Ui";
import { DataTable } from "@/components/common/DataTable";
import { FormModal } from "@/components/common/FormModal";
import { DUE_STATUS_STYLE, formatDate } from "@/lib/format";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

export function DueModule({ title, subtitle, endpoint, viewPerm, managePerm, extraFields = [], nextLabel }) {
  const { has } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, editing: null });
  const [submitting, setSubmitting] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const canManage = has(managePerm);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/${endpoint}`).then(({ data }) => setRows(data)).catch((e) => toast.error(apiError(e))).finally(() => setLoading(false));
  }, [endpoint]);
  useEffect(() => { load(); }, [load]);

  const save = async (values) => {
    setSubmitting(true);
    try {
      if (modal.editing?.id) await api.put(`/${endpoint}/${modal.editing.id}`, { data: values });
      else await api.post(`/${endpoint}`, { data: values });
      toast.success("Data tersimpan");
      setModal({ open: false, editing: null });
      load();
    } catch (e) { toast.error(apiError(e)); } finally { setSubmitting(false); }
  };
  const doDelete = async () => {
    try { await api.delete(`/${endpoint}/${toDelete.id}`); toast.success("Dihapus"); load(); }
    catch (e) { toast.error(apiError(e)); } finally { setToDelete(null); }
  };

  const summary = {
    aman: rows.filter((r) => r.status === "aman").length,
    mendekati: rows.filter((r) => r.status === "mendekati").length,
    jatuh_tempo: rows.filter((r) => r.status === "jatuh_tempo").length,
    terlambat: rows.filter((r) => r.status === "terlambat").length,
  };

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actions={canManage && (
        <button onClick={() => setModal({ open: true, editing: {} })} className="bg-[#C9A227] hover:bg-[#b59120] text-[#071426] font-semibold px-4 py-2 rounded-md text-sm flex items-center gap-2" data-testid="add-btn">
          <Plus size={16} /> Tambah
        </button>
      )} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {Object.entries(DUE_STATUS_STYLE).map(([k, s]) => (
          <div key={k} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm" data-testid={`countdown-${k}`}>
            <p className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.text }}>{summary[k]}</p>
          </div>
        ))}
      </div>

      <DataTable
        columns={[
          { key: "employee", label: "Pegawai", render: (r) => r.employee?.name || "-" },
          { key: "nomor_sk", label: "Nomor SK" },
          { key: "last_date", label: "Tanggal Terakhir", render: (r) => formatDate(r.last_date) },
          { key: "next_date", label: nextLabel || "Tanggal Berikutnya", render: (r) => formatDate(r.next_date) },
          { key: "days_left", label: "Sisa Hari", render: (r) => (r.days_left == null ? "-" : `${r.days_left} hari`) },
          { key: "status", label: "Status", render: (r) => <StatusPill style={DUE_STATUS_STYLE[r.status]} label={DUE_STATUS_STYLE[r.status]?.label} testid={`status-${r.id}`} /> },
          ...(canManage ? [{ key: "_a", label: "Aksi", render: (r) => (
            <div className="flex gap-1">
              <button onClick={() => setModal({ open: true, editing: r })} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" data-testid={`edit-${r.id}`}><Pencil size={15} /></button>
              <button onClick={() => setToDelete(r)} className="p-1.5 rounded hover:bg-red-50 text-red-500" data-testid={`delete-${r.id}`}><Trash2 size={15} /></button>
            </div>) }] : []),
        ]}
        rows={rows}
        loading={loading}
        testid={`${endpoint}-table`}
      />

      <FormModal
        open={modal.open}
        onClose={() => setModal({ open: false, editing: null })}
        title={modal.editing?.id ? `Edit ${title}` : `Tambah ${title}`}
        fields={[
          { name: "employee_id", label: "Pegawai", type: "employee", required: true, span: 2 },
          { name: "nomor_sk", label: "Nomor SK", type: "text" },
          { name: "last_date", label: "Tanggal Terakhir", type: "date" },
          { name: "next_date", label: nextLabel || "Tanggal Berikutnya", type: "date", required: true },
          ...extraFields,
          { name: "keterangan", label: "Keterangan", type: "textarea", span: 2 },
        ]}
        initial={modal.editing}
        onSubmit={save}
        submitting={submitting}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus data?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-700" data-testid="confirm-delete">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
