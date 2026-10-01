import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, Card, EmptyState } from "@/components/common/Ui";
import { formatDateTime } from "@/lib/format";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";

export default function Notifications() {
  const [data, setData] = useState({ items: [], unread: 0 });
  const load = () => api.get("/notifications").then(({ data }) => setData(data));
  useEffect(() => { load(); }, []);

  const readAll = async () => { await api.post("/notifications/read-all"); toast.success("Ditandai dibaca"); load(); };
  const readOne = async (id) => { await api.post(`/notifications/${id}/read`); load(); };

  return (
    <div>
      <PageHeader title="Notifikasi" subtitle={`${data.unread} belum dibaca`} actions={
        <button onClick={readAll} className="bg-[#0B1F3A] text-white px-4 py-2 rounded-md text-sm flex items-center gap-2" data-testid="read-all-btn">
          <CheckCheck size={15} /> Tandai Semua
        </button>
      } />
      <Card className="divide-y divide-slate-100">
        {data.items.length === 0 ? <EmptyState icon={Bell} title="Tidak ada notifikasi" /> : data.items.map((n) => (
          <button key={n.id} onClick={() => readOne(n.id)} className={`w-full text-left px-5 py-4 hover:bg-slate-50 flex items-start gap-3 ${n.read ? "opacity-60" : ""}`} data-testid={`notif-${n.id}`}>
            <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? "bg-slate-300" : "bg-[#C9A227]"}`} />
            <div>
              <p className="text-sm font-medium text-slate-800">{n.title}</p>
              <p className="text-xs text-slate-500">{n.message}</p>
              <p className="text-[10px] text-slate-400 mt-1">{formatDateTime(n.created_at)}</p>
            </div>
          </button>
        ))}
      </Card>
    </div>
  );
}
