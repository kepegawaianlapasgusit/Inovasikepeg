import { useState, useEffect, useCallback } from "react";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/common/Ui";
import { DataTable } from "@/components/common/DataTable";
import { FormModal } from "@/components/common/FormModal";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import * as Icons from "lucide-react";

// Generic CRUD page. wrap=true posts {data: values}; else posts values directly.
export default function RecordModule({
  title, subtitle, icon = "FileText", endpoint, viewPerm, managePerm,
  columns, fields, wrap = true, buildInitial,
}) {
  const { has } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, editing: null });
  const [submitting, setSubmitting] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const Icon = Icons[icon] || Icons.FileText;

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/${endpoint}`).then(({ data }) => setRows(Array.isArray(data) ? data : data.items || [])).catch((e) => toast.error(apiError(e))).finally(() => setLoading(false));
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);

  const canManage = managePerm && has(managePerm);

  const save = async (values) => {
    setSubmitting(true);
    try {
      const payload = wrap ? { data: values } : values;
      if (modal.editing) await api.put(`/${endpoint}/${modal.editing.id}`, payload);
      else await api.post(`/${endpoint}`, payload);
      toast.success("Data tersimpan");
      setModal({ open: false, editing: null });
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    try {
      await api.delete(`/${endpoint}/${toDelete.id}`);
      toast.success("Data dihapus");
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setToDelete(null);
    }
  };

  const actionCol = canManage
    ? [{
        key: "_actions", label: "Aksi", render: (row) => (
          <div className="flex gap-1">
            <button onClick={(e) => { e.stopPropagation(); setModal({ open: true, editing: row }); }} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" data-testid={`edit-${row.id}`}><Pencil size={15} /></button>
            <button onClick={(e) => { e.stopPropagation(); setToDelete(row); }} className="p-1.5 rounded hover:bg-red-50 text-red-500" data-testid={`delete-${row.id}`}><Trash2 size={15} /></button>
          </div>
        ),
      }]
    : [];

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={canManage && (
          <button onClick={() => setModal({ open: true, editing: buildInitial ? buildInitial() : {} })} className="bg-[#C9A227] hover:bg-[#b59120] text-[#071426] font-semibold px-4 py-2 rounded-md text-sm flex items-center gap-2" data-testid="add-btn">
            <Plus size={16} /> Tambah
          </button>
        )}
      />
      <DataTable columns={[...columns, ...actionCol]} rows={rows} loading={loading} testid={`${endpoint}-table`} />

      <FormModal
        open={modal.open}
        onClose={() => setModal({ open: false, editing: null })}
        title={modal.editing?.id ? `Edit ${title}` : `Tambah ${title}`}
        fields={fields}
        initial={modal.editing}
        onSubmit={save}
        submitting={submitting}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-700" data-testid="confirm-delete">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
