import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/common/Ui";
import { DataTable } from "@/components/common/DataTable";
import { formatDateTime } from "@/lib/format";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ACTION_COLOR = {
  LOGIN: "#047857", LOGOUT: "#64748B", CREATE: "#1D4ED8", EDIT: "#D97706",
  DELETE: "#E11D48", CORRECT: "#6D28D9", APPROVE: "#0F766E", RESET_PASSWORD: "#B45309",
};

export default function AuditLog() {
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const limit = 30;

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/audit-logs?page=${page}&limit=${limit}${action ? `&action=${action}` : ""}`)
      .then(({ data }) => setData(data)).finally(() => setLoading(false));
  }, [page, action]);
  useEffect(() => { load(); }, [load]);

  const pages = Math.ceil(data.total / limit) || 1;

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Catatan aktivitas sistem" actions={
        <select value={action} onChange={(e) => { setPage(1); setAction(e.target.value); }} className="border border-slate-300 rounded-md px-3 py-2 text-sm" data-testid="audit-action-filter">
          <option value="">Semua Aksi</option>
          {["LOGIN", "LOGOUT", "CREATE", "EDIT", "DELETE", "CORRECT", "APPROVE", "RESET_PASSWORD"].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      } />
      <DataTable
        testid="audit-table"
        loading={loading}
        rows={data.items}
        columns={[
          { key: "timestamp", label: "Waktu", render: (r) => formatDateTime(r.timestamp) },
          { key: "user_name", label: "User", render: (r) => r.user_name || r.user_email || "-" },
          { key: "action", label: "Aksi", render: (r) => <span className="font-semibold text-xs" style={{ color: ACTION_COLOR[r.action] || "#334155" }}>{r.action}</span> },
          { key: "module", label: "Modul" },
          { key: "object", label: "Objek", render: (r) => (typeof r.object === "string" ? r.object : r.object ? JSON.stringify(r.object) : "-") },
          { key: "ip", label: "IP", render: (r) => r.ip || "-" },
        ]}
      />
      <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
        <span>Total {data.total} entri</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-2 rounded border border-slate-200 disabled:opacity-40" data-testid="audit-prev"><ChevronLeft size={15} /></button>
          <span>{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="p-2 rounded border border-slate-200 disabled:opacity-40" data-testid="audit-next"><ChevronRight size={15} /></button>
        </div>
      </div>
    </div>
  );
}
