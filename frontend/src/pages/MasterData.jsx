import { useState, useEffect, useCallback } from "react";
import { api, apiError } from "@/lib/api";
import { PageHeader, Card } from "@/components/common/Ui";
import { DataTable } from "@/components/common/DataTable";
import { clearMasterCache } from "@/hooks/useMaster";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TABS = [
  { key: "organizational_units", label: "Unit/Bagian", fields: [{ name: "name", label: "Nama" }, { name: "type", label: "Tipe", default: "unit" }] },
  { key: "sections", label: "Seksi", fields: [{ name: "name", label: "Nama" }] },
  { key: "positions", label: "Jabatan", fields: [{ name: "name", label: "Nama" }] },
  { key: "grades", label: "Golongan", fields: [{ name: "name", label: "Golongan" }, { name: "pangkat", label: "Pangkat" }] },
  { key: "teams", label: "Regu (Rupam)", fields: [{ name: "name", label: "Nama" }] },
  { key: "attendance_types", label: "Jenis Apel", fields: [{ name: "name", label: "Nama" }, { name: "kind", label: "Kind (staf/rupam)" }, { name: "sessions_csv", label: "Sesi (pisah koma)" }] },
  { key: "attendance_statuses", label: "Status Kehadiran", fields: [{ name: "name", label: "Nama" }, { name: "key", label: "Key" }, { name: "counts_present_bool", label: "Dihitung Hadir (true/false)" }] },
  { key: "categories", label: "Kategori", fields: [{ name: "type", label: "Tipe (document/agenda/leave/award/evaluation)" }, { name: "name", label: "Nama" }] },
];

export default function MasterData() {
  const [tab, setTab] = useState(TABS[0].key);
  const current = TABS.find((t) => t.key === tab);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/master/${tab}`).then(({ data }) => setRows(data)).finally(() => setLoading(false));
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const serialize = (values) => {
    const out = { ...values };
    if ("sessions_csv" in out) { out.sessions = (out.sessions_csv || "").split(",").map((s) => s.trim()).filter(Boolean); delete out.sessions_csv; }
    if ("counts_present_bool" in out) { out.counts_present = String(out.counts_present_bool).toLowerCase() === "true"; delete out.counts_present_bool; }
    return out;
  };
  const deserialize = (row) => {
    const out = { ...row };
    if (row.sessions) out.sessions_csv = row.sessions.join(", ");
    if ("counts_present" in row) out.counts_present_bool = String(!!row.counts_present);
    return out;
  };

  const save = async (values) => {
    try {
      const data = serialize(values);
      if (modal.id) await api.put(`/master/${tab}/${modal.id}`, { data });
      else await api.post(`/master/${tab}`, { data });
      toast.success("Tersimpan"); clearMasterCache(); setModal(null); load();
    } catch (e) { toast.error(apiError(e)); }
  };
  const doDelete = async () => {
    try { await api.delete(`/master/${tab}/${toDelete.id}`); toast.success("Dihapus"); clearMasterCache(); load(); }
    catch (e) { toast.error(apiError(e)); } finally { setToDelete(null); }
  };

  const columns = [
    ...current.fields.filter((f) => !["sessions_csv", "counts_present_bool"].includes(f.name)).map((f) => ({ key: f.name, label: f.label })),
    ...(current.key === "attendance_types" ? [{ key: "sessions", label: "Sesi", render: (r) => (r.sessions || []).join(", ") }] : []),
    { key: "_a", label: "Aksi", render: (r) => (
      <div className="flex gap-1">
        <button onClick={() => setModal(deserialize(r))} className="text-slate-500 p-1 hover:bg-slate-100 rounded" data-testid={`edit-${r.id}`}><Pencil size={15} /></button>
        <button onClick={() => setToDelete(r)} className="text-red-500 p-1 hover:bg-red-50 rounded" data-testid={`delete-${r.id}`}><Trash2 size={15} /></button>
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Master Data" subtitle="Konfigurasi data acuan sistem (dinamis, tanpa ubah kode)" />
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded-md text-sm font-medium border ${tab === t.key ? "bg-[#0B1F3A] text-white border-[#0B1F3A]" : "bg-white text-slate-600 border-slate-200"}`} data-testid={`master-tab-${t.key}`}>{t.label}</button>
        ))}
      </div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setModal({})} className="bg-[#C9A227] hover:bg-[#b59120] text-[#071426] font-semibold px-4 py-2 rounded-md text-sm flex items-center gap-2" data-testid="add-master-btn"><Plus size={16} /> Tambah</button>
      </div>
      <DataTable testid="master-table" loading={loading} rows={rows} columns={columns} />

      {modal && (
        <Dialog open onOpenChange={(o) => !o && setModal(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle className="text-[#0B1F3A]">{modal.id ? "Edit" : "Tambah"} {current.label}</DialogTitle></DialogHeader>
            <MasterForm fields={current.fields} initial={modal} onSave={save} />
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus data ini?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-700" data-testid="confirm-delete">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MasterForm({ fields, initial, onSave }) {
  const [values, setValues] = useState(() => {
    const v = { ...initial };
    fields.forEach((f) => { if (f.default && !v[f.name]) v[f.name] = f.default; });
    return v;
  });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => { e.preventDefault(); setSaving(true); await onSave(values); setSaving(false); };
  return (
    <form onSubmit={submit} className="space-y-3">
      {fields.map((f) => (
        <div key={f.name}>
          <label className="text-sm font-medium text-slate-700">{f.label}</label>
          <input value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid={`master-field-${f.name}`} required />
        </div>
      ))}
      <DialogFooter>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-md bg-[#0B1F3A] text-white font-medium flex items-center gap-2" data-testid="save-master-btn">{saving && <Loader2 size={14} className="animate-spin" />} Simpan</button>
      </DialogFooter>
    </form>
  );
}
