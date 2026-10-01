import { useState, useEffect, useCallback } from "react";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Card } from "@/components/common/Ui";
import { FormModal } from "@/components/common/FormModal";
import { useMaster } from "@/hooks/useMaster";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus, ChevronLeft, ChevronRight, Trash2, Pencil } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export default function Calendar() {
  const { has } = useAuth();
  const { items: cats } = useMaster("categories");
  const agendaCats = cats.filter((c) => c.type === "agenda").map((c) => ({ value: c.name, label: c.name }));
  const [cursor, setCursor] = useState(new Date());
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState({ open: false, editing: null });
  const [submitting, setSubmitting] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const canManage = has("calendar.manage");

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  const load = useCallback(() => {
    api.get(`/agenda?date_from=${monthStr}-01&date_to=${monthStr}-31`).then(({ data }) => setItems(data));
  }, [monthStr]);
  useEffect(() => { load(); }, [load]);

  const byDate = {};
  items.forEach((i) => { (byDate[i.date] = byDate[i.date] || []).push(i); });

  const save = async (values) => {
    setSubmitting(true);
    try {
      if (modal.editing?.id) await api.put(`/agenda/${modal.editing.id}`, values);
      else await api.post("/agenda", values);
      toast.success("Agenda tersimpan");
      setModal({ open: false, editing: null });
      load();
    } catch (e) { toast.error(apiError(e)); } finally { setSubmitting(false); }
  };
  const doDelete = async () => {
    try { await api.delete(`/agenda/${toDelete.id}`); toast.success("Dihapus"); load(); }
    catch (e) { toast.error(apiError(e)); } finally { setToDelete(null); }
  };

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader title="Kalender & Agenda" subtitle="Jadwal kegiatan dan agenda" actions={canManage && (
        <button onClick={() => setModal({ open: true, editing: { date: todayStr } })} className="bg-[#C9A227] hover:bg-[#b59120] text-[#071426] font-semibold px-4 py-2 rounded-md text-sm flex items-center gap-2" data-testid="add-btn">
          <Plus size={16} /> Tambah Agenda
        </button>
      )} />

      <Card className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#0B1F3A]">
            {cursor.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
          </h2>
          <div className="flex gap-1">
            <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="p-2 rounded border border-slate-200 hover:bg-slate-50" data-testid="prev-month"><ChevronLeft size={16} /></button>
            <button onClick={() => setCursor(new Date())} className="px-3 text-sm rounded border border-slate-200 hover:bg-slate-50" data-testid="today-btn">Hari ini</button>
            <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="p-2 rounded border border-slate-200 hover:bg-slate-50" data-testid="next-month"><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((d) => <div key={d} className="text-center text-xs font-semibold text-slate-500 py-2">{d}</div>)}
          {cells.map((d, i) => {
            const dateStr = d ? `${monthStr}-${String(d).padStart(2, "0")}` : null;
            const dayItems = dateStr ? byDate[dateStr] || [] : [];
            return (
              <div key={i} className={`min-h-[84px] border border-slate-100 rounded p-1 ${dateStr === todayStr ? "bg-[#C9A227]/10 border-[#C9A227]/40" : ""}`}>
                {d && <div className="text-xs font-medium text-slate-600 px-1">{d}</div>}
                <div className="space-y-1 mt-1">
                  {dayItems.slice(0, 3).map((it) => (
                    <button key={it.id} onClick={() => canManage && setModal({ open: true, editing: it })} className="w-full text-left text-[10px] bg-[#0B1F3A] text-white rounded px-1 py-0.5 truncate" data-testid={`agenda-${it.id}`} title={it.title}>
                      {it.time ? `${it.time} ` : ""}{it.title}
                    </button>
                  ))}
                  {dayItems.length > 3 && <p className="text-[10px] text-slate-400 px-1">+{dayItems.length - 3} lagi</p>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-600 mb-3">Daftar Agenda Bulan Ini</h3>
        <div className="space-y-2">
          {items.length === 0 && <p className="text-sm text-slate-400">Tidak ada agenda.</p>}
          {items.map((it) => (
            <Card key={it.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1 h-10 rounded bg-[#C9A227]" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{it.title} <span className="text-xs text-slate-400">· {it.category}</span></p>
                  <p className="text-xs text-slate-500">{formatDate(it.date)} {it.time} · {it.location || "-"}</p>
                </div>
              </div>
              {canManage && (
                <div className="flex gap-1">
                  <button onClick={() => setModal({ open: true, editing: it })} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" data-testid={`edit-${it.id}`}><Pencil size={14} /></button>
                  <button onClick={() => setToDelete(it)} className="p-1.5 rounded hover:bg-red-50 text-red-500" data-testid={`delete-${it.id}`}><Trash2 size={14} /></button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      <FormModal
        open={modal.open}
        onClose={() => setModal({ open: false, editing: null })}
        title={modal.editing?.id ? "Edit Agenda" : "Tambah Agenda"}
        fields={[
          { name: "title", label: "Judul", type: "text", required: true, span: 2 },
          { name: "category", label: "Kategori", type: "select", options: agendaCats },
          { name: "status", label: "Status", type: "select", options: ["Terjadwal", "Berlangsung", "Selesai", "Dibatalkan"].map((x) => ({ value: x, label: x })) },
          { name: "date", label: "Tanggal", type: "date", required: true },
          { name: "time", label: "Waktu", type: "text" },
          { name: "location", label: "Lokasi", type: "text" },
          { name: "pic", label: "Penanggung Jawab", type: "text" },
          { name: "participants", label: "Peserta", type: "text", span: 2 },
          { name: "description", label: "Deskripsi", type: "textarea", span: 2 },
        ]}
        initial={modal.editing}
        onSubmit={save}
        submitting={submitting}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus agenda?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-700" data-testid="confirm-delete">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
