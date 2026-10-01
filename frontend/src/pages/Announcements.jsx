import { useState, useEffect, useCallback } from "react";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Card, EmptyState } from "@/components/common/Ui";
import { FormModal } from "@/components/common/FormModal";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Megaphone } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Announcements() {
  const { has } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, editing: null });
  const [submitting, setSubmitting] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const canManage = has("announcement.manage");

  const load = useCallback(() => {
    setLoading(true);
    api.get("/announcements").then(({ data }) => setRows(data)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (values) => {
    setSubmitting(true);
    try {
      const payload = { ...values, target_type: values.target_type || "all", target_ids: [] };
      if (modal.editing?.id) await api.put(`/announcements/${modal.editing.id}`, payload);
      else await api.post("/announcements", payload);
      toast.success("Pengumuman tersimpan");
      setModal({ open: false, editing: null });
      load();
    } catch (e) { toast.error(apiError(e)); } finally { setSubmitting(false); }
  };
  const doDelete = async () => {
    try { await api.delete(`/announcements/${toDelete.id}`); toast.success("Dihapus"); load(); }
    catch (e) { toast.error(apiError(e)); } finally { setToDelete(null); }
  };

  return (
    <div>
      <PageHeader title="Pengumuman" subtitle="Publikasi informasi kepada pegawai" actions={canManage && (
        <button onClick={() => setModal({ open: true, editing: {} })} className="bg-[#C9A227] hover:bg-[#b59120] text-[#071426] font-semibold px-4 py-2 rounded-md text-sm flex items-center gap-2" data-testid="add-btn">
          <Plus size={16} /> Buat Pengumuman
        </button>
      )} />

      {loading ? null : rows.length === 0 ? (
        <Card className="p-6"><EmptyState icon={Megaphone} title="Belum ada pengumuman" /></Card>
      ) : (
        <div className="space-y-4">
          {rows.map((a) => (
            <Card key={a.id} className="p-5" data-testid={`announcement-${a.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-[#0B1F3A]">{a.title}</h3>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{a.content}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    {a.created_by_name} · {formatDateTime(a.created_at)} · Target: {a.target_type}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setModal({ open: true, editing: a })} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" data-testid={`edit-${a.id}`}><Pencil size={15} /></button>
                    <button onClick={() => setToDelete(a)} className="p-1.5 rounded hover:bg-red-50 text-red-500" data-testid={`delete-${a.id}`}><Trash2 size={15} /></button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <FormModal
        open={modal.open}
        onClose={() => setModal({ open: false, editing: null })}
        title={modal.editing?.id ? "Edit Pengumuman" : "Buat Pengumuman"}
        fields={[
          { name: "title", label: "Judul", type: "text", required: true, span: 2 },
          { name: "content", label: "Isi", type: "textarea", rows: 5, required: true, span: 2 },
          { name: "target_type", label: "Target", type: "select", span: 2, options: [
            { value: "all", label: "Semua Pegawai" }, { value: "unit", label: "Unit" },
            { value: "section", label: "Seksi" }, { value: "role", label: "Role" },
          ] },
        ]}
        initial={modal.editing}
        onSubmit={save}
        submitting={submitting}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus pengumuman?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-700" data-testid="confirm-delete">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
