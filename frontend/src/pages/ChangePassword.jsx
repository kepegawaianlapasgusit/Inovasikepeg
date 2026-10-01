import { useState } from "react";
import { api, apiError } from "@/lib/api";
import { PageHeader, Card } from "@/components/common/Ui";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function ChangePassword() {
  const [form, setForm] = useState({ old_password: "", new_password: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/change-password", { old_password: form.old_password, new_password: form.new_password });
      toast.success("Password berhasil diubah");
      setForm({ old_password: "", new_password: "", confirm: "" });
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const field = (label, key, extra = {}) => (
    <div>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        type="password"
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        required
        data-testid={`cp-${key}`}
        className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A227]"
        {...extra}
      />
    </div>
  );

  return (
    <div className="max-w-lg">
      <PageHeader title="Ubah Password" subtitle="Perbarui kata sandi akun Anda." />
      <Card className="p-6">
        <form onSubmit={submit} className="space-y-4">
          {field("Password Lama", "old_password")}
          {field("Password Baru", "new_password", { minLength: 6 })}
          {field("Konfirmasi Password Baru", "confirm", { minLength: 6 })}
          <button disabled={busy} className="bg-[#0B1F3A] text-white px-5 py-2.5 rounded-md text-sm font-medium flex items-center gap-2" data-testid="cp-submit">
            {busy && <Loader2 size={15} className="animate-spin" />} Simpan
          </button>
        </form>
      </Card>
    </div>
  );
}
