import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { StatCard, Card, EmptyState } from "@/components/common/Ui";
import { formatDateTime, formatDate, ATTENDANCE_STATUS_STYLE } from "@/lib/format";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Users, UserCheck, Building2, UserCog, ClipboardCheck, CalendarDays,
  TrendingUp, Award, Megaphone, Activity, Loader2, Bell,
} from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [charts, setCharts] = useState(null);

  useEffect(() => {
    api.get("/dashboard").then(({ data }) => setData(data));
    api.get("/dashboard/charts").then(({ data }) => setCharts(data)).catch(() => {});
  }, []);

  if (!data)
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="animate-spin mr-2" /> Memuat dashboard...
      </div>
    );

  return data.mode === "admin" ? <AdminDashboard data={data} user={user} charts={charts} /> : <EmployeeDashboard data={data} user={user} />;
}

function AdminDashboard({ data, user, charts }) {
  const s = data.stats;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0B1F3A]">Selamat datang, {user.name}</h1>
        <p className="text-sm text-slate-500 mt-1">Ringkasan monitoring kepegawaian hari ini.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Pegawai" value={s.total_employees} icon={Users} accent="#0B1F3A" testid="stat-total-employees" />
        <StatCard label="Pegawai Aktif" value={s.active_employees} icon={UserCheck} accent="#047857" testid="stat-active-employees" />
        <StatCard label="Unit / Bagian" value={s.total_units} icon={Building2} accent="#C9A227" testid="stat-units" />
        <StatCard label="Total User" value={s.total_users} icon={UserCog} accent="#6D28D9" testid="stat-users" />
        <StatCard label="Apel Hari Ini" value={s.today_events} icon={ClipboardCheck} accent="#1D4ED8" testid="stat-today-events" />
        <StatCard label="Kehadiran Diinput" value={s.today_records} icon={Activity} accent="#0F766E" testid="stat-today-records" />
        <StatCard label="KGB Terpantau" value={s.kgb_due} icon={TrendingUp} accent="#D97706" testid="stat-kgb" />
        <StatCard label="Kenaikan Pangkat" value={s.promotion_due} icon={Award} accent="#B45309" testid="stat-promotion" />
      </div>

      {charts && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={18} className="text-[#C9A227]" />
              <h2 className="text-lg font-semibold text-[#0B1F3A]">Tren Kehadiran (14 Hari)</h2>
            </div>
            {charts.trend.every((t) => t.total === 0) ? (
              <EmptyState icon={Activity} title="Belum ada data kehadiran" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={charts.trend} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0B1F3A" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#0B1F3A" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94A3B8" }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94A3B8" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v, n) => (n === "percentage" ? [`${v}%`, "Kehadiran"] : [v, n === "total" ? "Peserta" : "Hadir"])} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="percentage" stroke="#C9A227" strokeWidth={2.5} fill="url(#trend)" name="percentage" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={18} className="text-[#C9A227]" />
              <h2 className="text-lg font-semibold text-[#0B1F3A]">Sebaran Status Kehadiran (90 Hari)</h2>
            </div>
            {charts.distribution.every((d) => d.value === 0) ? (
              <EmptyState icon={ClipboardCheck} title="Belum ada data status" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={charts.distribution.filter((d) => d.value > 0)} dataKey="value" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {charts.distribution.filter((d) => d.value > 0).map((d) => (
                      <Cell key={d.key} fill={ATTENDANCE_STATUS_STYLE[d.key]?.text || "#64748B"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays size={18} className="text-[#C9A227]" />
            <h2 className="text-lg font-semibold text-[#0B1F3A]">Agenda Hari Ini</h2>
          </div>
          {data.agenda_today.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Tidak ada agenda" />
          ) : (
            <ul className="space-y-3">
              {data.agenda_today.map((a) => (
                <li key={a.id} className="border-l-2 border-[#C9A227] pl-3">
                  <p className="text-sm font-medium text-slate-800">{a.title}</p>
                  <p className="text-xs text-slate-400">{a.time} · {a.location || "-"}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone size={18} className="text-[#C9A227]" />
            <h2 className="text-lg font-semibold text-[#0B1F3A]">Pengumuman Terbaru</h2>
          </div>
          {data.announcements.length === 0 ? (
            <EmptyState icon={Megaphone} title="Belum ada pengumuman" />
          ) : (
            <ul className="space-y-3">
              {data.announcements.map((a) => (
                <li key={a.id}>
                  <p className="text-sm font-medium text-slate-800">{a.title}</p>
                  <p className="text-xs text-slate-500 line-clamp-2">{a.content}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{formatDateTime(a.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-[#C9A227]" />
            <h2 className="text-lg font-semibold text-[#0B1F3A]">Aktivitas Sistem</h2>
          </div>
          {data.activities.length === 0 ? (
            <EmptyState icon={Activity} title="Belum ada aktivitas" />
          ) : (
            <ul className="space-y-2.5">
              {data.activities.map((a) => (
                <li key={a.id} className="flex items-start gap-2 text-sm">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#C9A227] shrink-0" />
                  <div>
                    <span className="text-slate-700">
                      <b>{a.user_name || "Sistem"}</b> — {a.action} {a.module}
                    </span>
                    <p className="text-[10px] text-slate-400">{formatDateTime(a.timestamp)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function EmployeeDashboard({ data, user }) {
  const emp = data.employee;
  const sum = data.attendance_summary || { per_type: [], overall_percentage: 0 };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0B1F3A]">Selamat datang, {user.name}</h1>
        <p className="text-sm text-slate-500 mt-1">Informasi pribadi dan ringkasan kehadiran Anda.</p>
      </div>

      {emp ? (
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#0B1F3A] text-[#D8B95A] border border-[#C9A227]/40 flex items-center justify-center font-bold text-lg">
              {emp.name?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-bold text-[#0B1F3A]">{emp.name}</p>
              <p className="text-sm text-slate-500">
                {emp.nip} · {emp.position_name || "-"} · {emp.unit_name || "-"}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <p className="text-sm text-slate-500">Akun Anda belum tertaut ke data pegawai. Hubungi Super Admin.</p>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <StatCard label="Persentase Kehadiran" value={`${sum.overall_percentage}%`} icon={UserCheck} accent="#047857" testid="stat-my-attendance" />
        <StatCard label="Total Apel Terpantau" value={sum.overall_total || 0} icon={ClipboardCheck} accent="#1D4ED8" />
        <StatCard label="Notifikasi Belum Dibaca" value={data.unread_notifications || 0} icon={Bell} accent="#C9A227" />
      </div>

      <Card className="p-5">
        <h2 className="text-lg font-semibold text-[#0B1F3A] mb-4">Rekap Kehadiran Apel</h2>
        {sum.per_type.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="Belum ada data kehadiran" hint="Data kehadiran akan muncul setelah Operator menginput absensi apel." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sum.per_type.map((t) => (
              <div key={t.type_id} className="border border-slate-200 rounded-lg p-4" data-testid={`my-summary-${t.type_id}`}>
                <p className="text-sm font-medium text-slate-700">{t.type_name}</p>
                <p className="text-2xl font-bold text-[#0B1F3A] mt-1">
                  {t.present}<span className="text-base text-slate-400"> / {t.total}</span>
                </p>
                <p className="text-sm font-semibold text-[#047857]">{t.percentage}%</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[#0B1F3A] mb-4">Agenda Hari Ini</h2>
          {data.agenda_today.length === 0 ? <EmptyState icon={CalendarDays} title="Tidak ada agenda" /> : (
            <ul className="space-y-3">{data.agenda_today.map((a) => (
              <li key={a.id} className="border-l-2 border-[#C9A227] pl-3">
                <p className="text-sm font-medium text-slate-800">{a.title}</p>
                <p className="text-xs text-slate-400">{a.time} · {a.location || "-"}</p>
              </li>))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[#0B1F3A] mb-4">Pengumuman</h2>
          {data.announcements.length === 0 ? <EmptyState icon={Megaphone} title="Belum ada pengumuman" /> : (
            <ul className="space-y-3">{data.announcements.map((a) => (
              <li key={a.id}>
                <p className="text-sm font-medium text-slate-800">{a.title}</p>
                <p className="text-xs text-slate-500 line-clamp-2">{a.content}</p>
              </li>))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
