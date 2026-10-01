import { useState, useEffect, useCallback } from "react";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Card, EmptyState } from "@/components/common/Ui";
import { DataTable } from "@/components/common/DataTable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, CheckCircle2, ClipboardList } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export default function Evaluation() {
  const { has } = useAuth();
  return (
    <div>
      <PageHeader title="Penilaian Pegawai" subtitle="Template, penilaian, dan integrasi kehadiran otomatis" />
      <Tabs defaultValue="evaluations">
        <TabsList>
          <TabsTrigger value="evaluations" data-testid="tab-evaluations">Penilaian</TabsTrigger>
          {has("evaluation.create", "evaluation.edit") && <TabsTrigger value="templates" data-testid="tab-templates">Template</TabsTrigger>}
        </TabsList>
        <TabsContent value="evaluations"><EvalTab /></TabsContent>
        <TabsContent value="templates"><TemplateTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function EvalTab() {
  const { has } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const canCreate = has("evaluation.create");
  const canApprove = has("evaluation.approve");

  const load = useCallback(() => { setLoading(true); api.get("/evaluation").then(({ data }) => setRows(data)).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);

  const approve = async (id) => { try { await api.post(`/evaluation/${id}/approve`); toast.success("Disetujui"); load(); } catch (e) { toast.error(apiError(e)); } };

  return (
    <div>
      {canCreate && <div className="flex justify-end mb-3"><button onClick={() => setModal(true)} className="bg-[#C9A227] hover:bg-[#b59120] text-[#071426] font-semibold px-4 py-2 rounded-md text-sm flex items-center gap-2" data-testid="add-eval-btn"><Plus size={16} /> Buat Penilaian</button></div>}
      <DataTable
        testid="eval-table"
        loading={loading}
        rows={rows}
        columns={[
          { key: "employee", label: "Pegawai", render: (r) => r.employee?.name || "-" },
          { key: "period", label: "Periode" },
          { key: "manual_score", label: "Nilai Manual", render: (r) => <b>{r.manual_score}</b> },
          { key: "attendance_percentage", label: "Nilai Kehadiran (otomatis)", render: (r) => <span className="text-[#047857] font-semibold">{r.attendance_percentage}%</span> },
          { key: "evaluator_name", label: "Penilai" },
          { key: "status", label: "Status", render: (r) => <span className={r.status === "approved" ? "text-green-600" : "text-amber-600"}>{r.status}</span> },
          ...(canApprove ? [{ key: "_a", label: "Aksi", render: (r) => r.status !== "approved" && <button onClick={() => approve(r.id)} className="text-xs text-green-600 flex items-center gap-1 hover:underline" data-testid={`approve-${r.id}`}><CheckCircle2 size={14} /> Setujui</button> }] : []),
        ]}
      />
      {modal && <EvalModal onClose={() => setModal(false)} reload={load} />}
    </div>
  );
}

function EvalModal({ onClose, reload }) {
  const [employees, setEmployees] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({ employee_id: "", template_id: "", period: "", notes: "" });
  const [scores, setScores] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/employees?limit=500").then(({ data }) => setEmployees(data.items || []));
    api.get("/evaluation/templates").then(({ data }) => setTemplates(data));
  }, []);

  const pickTemplate = (tid) => {
    setForm((f) => ({ ...f, template_id: tid }));
    const t = templates.find((x) => x.id === tid);
    const inds = [];
    (t?.categories || []).forEach((c) => (c.indicators || []).forEach((i) => inds.push({ indicator: `${c.name} - ${i.name}`, weight: i.weight || 1, value: 0 })));
    setScores(inds);
  };

  const save = async () => {
    setSaving(true);
    try { await api.post("/evaluation", { ...form, scores }); toast.success("Penilaian tersimpan (nilai kehadiran otomatis)"); onClose(); reload(); }
    catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader><DialogTitle className="text-[#0B1F3A]">Buat Penilaian</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><label className="text-sm font-medium">Pegawai *</label>
            <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="eval-employee">
              <option value="">-- Pilih --</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium">Template</label>
              <select value={form.template_id} onChange={(e) => pickTemplate(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="eval-template">
                <option value="">-- Pilih --</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div><label className="text-sm font-medium">Periode *</label><input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="2026 / Semester I" className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="eval-period" /></div>
          </div>
          {scores.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">Indikator (nilai 0-100)</p>
              {scores.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm flex-1">{s.indicator} <span className="text-xs text-slate-400">(bobot {s.weight})</span></span>
                  <input type="number" min="0" max="100" value={s.value} onChange={(e) => setScores(scores.map((x, j) => j === i ? { ...x, value: Number(e.target.value) } : x))} className="w-20 border border-slate-300 rounded px-2 py-1 text-sm" data-testid={`score-${i}`} />
                </div>
              ))}
            </div>
          )}
          <div className="bg-[#C9A227]/10 border border-[#C9A227]/30 rounded-md p-3 text-xs text-slate-600">
            Nilai kehadiran ditarik <b>otomatis</b> dari database kehadiran pegawai dan tidak dapat diubah manual.
          </div>
          <div><label className="text-sm font-medium">Catatan</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="eval-notes" /></div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-slate-300">Batal</button>
          <button onClick={save} disabled={saving || !form.employee_id || !form.period} className="px-4 py-2 text-sm rounded-md bg-[#0B1F3A] text-white font-medium flex items-center gap-2" data-testid="save-eval-btn">{saving && <Loader2 size={14} className="animate-spin" />} Simpan</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const load = useCallback(() => { setLoading(true); api.get("/evaluation/templates").then(({ data }) => setRows(data)).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex justify-end mb-3"><button onClick={() => setModal(true)} className="bg-[#C9A227] hover:bg-[#b59120] text-[#071426] font-semibold px-4 py-2 rounded-md text-sm flex items-center gap-2" data-testid="add-template-btn"><Plus size={16} /> Buat Template</button></div>
      {rows.length === 0 && !loading ? <Card className="p-6"><EmptyState icon={ClipboardList} title="Belum ada template" hint="Buat template dinamis dengan kategori, indikator, dan bobot." /></Card> : (
        <div className="grid md:grid-cols-2 gap-4">
          {rows.map((t) => (
            <Card key={t.id} className="p-5" data-testid={`template-${t.id}`}>
              <h3 className="font-semibold text-[#0B1F3A]">{t.name}</h3>
              <p className="text-xs text-slate-400">{t.period}</p>
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                {(t.categories || []).map((c, i) => <li key={i}>• {c.name} <span className="text-xs text-slate-400">({(c.indicators || []).length} indikator)</span></li>)}
              </ul>
            </Card>
          ))}
        </div>
      )}
      {modal && <TemplateModal onClose={() => setModal(false)} reload={load} />}
    </div>
  );
}

function TemplateModal({ onClose, reload }) {
  const [name, setName] = useState("");
  const [period, setPeriod] = useState("");
  const [cats, setCats] = useState([{ name: "", indicators: [{ name: "", weight: 1 }] }]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try { await api.post("/evaluation/templates", { name, period, categories: cats }); toast.success("Template tersimpan"); onClose(); reload(); }
    catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader><DialogTitle className="text-[#0B1F3A]">Buat Template Penilaian</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium">Nama Template *</label><input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="template-name" /></div>
            <div><label className="text-sm font-medium">Periode</label><input value={period} onChange={(e) => setPeriod(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="template-period" /></div>
          </div>
          {cats.map((c, ci) => (
            <div key={ci} className="border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <input placeholder="Nama Kategori" value={c.name} onChange={(e) => setCats(cats.map((x, i) => i === ci ? { ...x, name: e.target.value } : x))} className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm" data-testid={`cat-name-${ci}`} />
                <button onClick={() => setCats(cats.filter((_, i) => i !== ci))} className="text-red-500 p-1"><Trash2 size={15} /></button>
              </div>
              {c.indicators.map((ind, ii) => (
                <div key={ii} className="flex gap-2 pl-3">
                  <input placeholder="Indikator" value={ind.name} onChange={(e) => setCats(cats.map((x, i) => i === ci ? { ...x, indicators: x.indicators.map((y, j) => j === ii ? { ...y, name: e.target.value } : y) } : x))} className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm" data-testid={`ind-name-${ci}-${ii}`} />
                  <input type="number" placeholder="Bobot" value={ind.weight} onChange={(e) => setCats(cats.map((x, i) => i === ci ? { ...x, indicators: x.indicators.map((y, j) => j === ii ? { ...y, weight: Number(e.target.value) } : y) } : x))} className="w-20 border border-slate-300 rounded px-2 py-1 text-sm" />
                </div>
              ))}
              <button onClick={() => setCats(cats.map((x, i) => i === ci ? { ...x, indicators: [...x.indicators, { name: "", weight: 1 }] } : x))} className="text-xs text-[#0B1F3A] pl-3 flex items-center gap-1"><Plus size={12} /> Indikator</button>
            </div>
          ))}
          <button onClick={() => setCats([...cats, { name: "", indicators: [{ name: "", weight: 1 }] }])} className="text-sm text-[#0B1F3A] flex items-center gap-1" data-testid="add-cat-btn"><Plus size={14} /> Tambah Kategori</button>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-slate-300">Batal</button>
          <button onClick={save} disabled={saving || !name} className="px-4 py-2 text-sm rounded-md bg-[#0B1F3A] text-white font-medium flex items-center gap-2" data-testid="save-template-btn">{saving && <Loader2 size={14} className="animate-spin" />} Simpan</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
