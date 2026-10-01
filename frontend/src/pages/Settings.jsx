import { useState, useEffect } from "react";
import { api, apiError } from "@/lib/api";
import { PageHeader, Card } from "@/components/common/Ui";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Settings() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/master/settings/global").then(({ data }) => setData(data)); }, []);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put("/master/settings/global", { data });
      toast.success("Pengaturan disimpan");
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  if (!data) return <div className="text-slate-400 flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Memuat...</div>;

  const field = (label, key, type = "text") => (
    <div>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input type={type} value={data[key] ?? ""} onChange={(e) => setData({ ...data, [key]: type === "number" ? Number(e.target.value) : e.target.value })} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]" data-testid={`setting-${key}`} />
    </div>
  );

  return (
    <div className="max-w-2xl">
      <PageHeader title="Pengaturan Sistem" subtitle="Konfigurasi aplikasi dan threshold" />
      <Card className="p-6">
        <form onSubmit={save} className="space-y-4">
          {field("Nama Aplikasi", "app_name")}
          {field("Subtitle", "subtitle")}
          {field("Organisasi", "organization")}
          <div className="grid grid-cols-2 gap-4">
            {field("Threshold KGB (hari)", "kgb_threshold_days", "number")}
            {field("Threshold Kenaikan Pangkat (hari)", "promotion_threshold_days", "number")}
          </div>
          <button disabled={busy} className="bg-[#0B1F3A] text-white px-5 py-2.5 rounded-md text-sm font-medium flex items-center gap-2" data-testid="settings-save">
            {busy && <Loader2 size={15} className="animate-spin" />} Simpan Pengaturan
          </button>
        </form>
      </Card>
    </div>
  );
}
