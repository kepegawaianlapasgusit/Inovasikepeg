import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";

// Renders a form inside a dialog. fields: [{name,label,type,options,required,span}]
export function FormModal({ open, onClose, title, fields, initial, onSubmit, submitting }) {
  const [values, setValues] = useState({});
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    if (open) setValues(initial || {});
  }, [open, initial]);

  const needEmployees = fields.some((f) => f.type === "employee");
  useEffect(() => {
    if (open && needEmployees && employees.length === 0) {
      api.get("/employees?limit=500").then(({ data }) => setEmployees(data.items || [])).catch(() => {});
    }
  }, [open, needEmployees, employees.length]);

  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    onSubmit(values);
  };

  const renderField = (f) => {
    const common = {
      "data-testid": `field-${f.name}`,
      value: values[f.name] ?? "",
      onChange: (e) => set(f.name, e.target.value),
      required: f.required,
      className: "mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]",
    };
    if (f.type === "textarea") return <textarea {...common} rows={f.rows || 3} />;
    if (f.type === "number") return <input type="number" {...common} />;
    if (f.type === "date") return <input type="date" {...common} />;
    if (f.type === "select")
      return (
        <select {...common}>
          <option value="">-- Pilih --</option>
          {(f.options || []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    if (f.type === "employee")
      return (
        <select {...common}>
          <option value="">-- Pilih Pegawai --</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name} ({e.nip})</option>
          ))}
        </select>
      );
    return <input type="text" {...common} />;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="text-[#0B1F3A]">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.name} className={f.span === 2 ? "col-span-2" : "col-span-2 sm:col-span-1"}>
                <label className="text-sm font-medium text-slate-700">{f.label}{f.required && " *"}</label>
                {renderField(f)}
              </div>
            ))}
          </div>
          <DialogFooter>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-slate-300 text-slate-600">
              Batal
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm rounded-md bg-[#0B1F3A] text-white font-medium flex items-center gap-2" data-testid="form-submit">
              {submitting && <Loader2 size={14} className="animate-spin" />} Simpan
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
