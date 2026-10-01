import { useState, useEffect, useRef } from "react";
import { Outlet, NavLink, useNavigate, Navigate, useLocation } from "react-router-dom";
import * as Icons from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { initials, formatDateTime } from "@/lib/format";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

function Icon({ name, ...props }) {
  const C = Icons[name] || Icons.Circle;
  return <C {...props} />;
}

export default function DashboardLayout() {
  const { user, loading, menu, has, logout, employee } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex items-center gap-3 text-[#0B1F3A]">
          <Icons.Loader2 className="animate-spin" size={22} />
          <span className="text-sm font-medium">Memuat...</span>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  const visibleMenu = (menu || []).filter((m) => has(...m.perms));

  const sidebar = (
    <aside className="w-64 bg-[#071426] text-white flex flex-col h-full border-r border-slate-800">
      <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800 shrink-0">
        <div className="w-9 h-9 rounded-md bg-[#C9A227] text-[#071426] flex items-center justify-center font-extrabold text-sm">LG</div>
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight">LAGUSIT</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Kepegawaian</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        {visibleMenu.map((m) => (
          <NavLink
            key={m.key}
            to={m.path}
            end={m.path === "/app"}
            data-testid={`nav-${m.key}`}
            className={({ isActive }) =>
              `text-sm px-4 py-2.5 flex items-center gap-3 transition-colors ${
                isActive
                  ? "bg-[#0B1F3A] text-[#D8B95A] border-l-4 border-[#C9A227] font-medium"
                  : "text-slate-300 hover:bg-[#0B1F3A]/60 hover:text-white border-l-4 border-transparent"
              }`
            }
          >
            <Icon name={m.icon} size={17} />
            <span>{m.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800 text-[10px] text-slate-500 shrink-0">
        Lapas Gunungsitoli · v1.0
      </div>
    </aside>
  );

  return (
    <div className="h-screen flex overflow-hidden bg-[#F8FAFC]">
      <div className="hidden lg:flex shrink-0">{sidebar}</div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full">{sidebar}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenu={() => setMobileOpen(true)} user={user} employee={employee} logout={logout} />
        <main className="flex-1 overflow-y-auto scrollbar-thin p-4 md:p-6">
          <div className="animate-fade-up max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function Topbar({ onMenu, user, employee, logout }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [openSearch, setOpenSearch] = useState(false);
  const [notifs, setNotifs] = useState({ items: [], unread: 0 });
  const boxRef = useRef();

  const loadNotifs = () => api.get("/notifications").then(({ data }) => setNotifs(data)).catch(() => {});
  useEffect(() => {
    loadNotifs();
    const t = setInterval(loadNotifs, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api.get(`/search?q=${encodeURIComponent(q)}`).then(({ data }) => {
        setResults(data.results || []);
        setOpenSearch(true);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const markAll = async () => {
    await api.post("/notifications/read-all");
    loadNotifs();
  };

  return (
    <header className="h-16 bg-[#0B1F3A] text-white px-4 md:px-6 flex items-center justify-between shrink-0 shadow-sm z-40">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button className="lg:hidden p-1.5 rounded hover:bg-white/10" onClick={onMenu} data-testid="mobile-menu-btn">
          <Icons.Menu size={20} />
        </button>
        <div className="relative max-w-md w-full hidden sm:block" ref={boxRef}>
          <Icons.Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            data-testid="global-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => results.length && setOpenSearch(true)}
            placeholder="Cari pegawai, apel, pengumuman..."
            className="w-full bg-[#071426] border border-slate-700 rounded-md pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#C9A227]"
          />
          {openSearch && results.length > 0 && (
            <div className="absolute mt-1 w-full bg-white rounded-md shadow-lg border border-slate-200 overflow-hidden z-50">
              {results.map((r) => (
                <button
                  key={r.type + r.id}
                  onClick={() => {
                    navigate(r.path);
                    setOpenSearch(false);
                    setQ("");
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between"
                  data-testid={`search-result-${r.id}`}
                >
                  <div>
                    <p className="text-sm text-slate-800">{r.label}</p>
                    <p className="text-xs text-slate-400">{r.sub}</p>
                  </div>
                  <span className="text-[10px] text-[#C9A227] font-semibold uppercase">{r.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <DropdownMenu onOpenChange={(o) => o && loadNotifs()}>
          <DropdownMenuTrigger asChild>
            <button className="relative p-2 rounded hover:bg-white/10" data-testid="notification-bell">
              <Icons.Bell size={18} />
              {notifs.unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#C9A227] text-[#071426] text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                  {notifs.unread}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notifikasi
              <button onClick={markAll} className="text-xs text-[#C9A227] hover:underline" data-testid="notif-read-all">
                Tandai dibaca
              </button>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifs.items.length === 0 && <div className="px-3 py-6 text-center text-xs text-slate-400">Tidak ada notifikasi</div>}
            {notifs.items.slice(0, 8).map((n) => (
              <div key={n.id} className={`px-3 py-2 text-sm ${n.read ? "opacity-60" : ""}`}>
                <p className="font-medium text-slate-800">{n.title}</p>
                <p className="text-xs text-slate-500">{n.message}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{formatDateTime(n.created_at)}</p>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 p-1 pr-2 rounded hover:bg-white/10" data-testid="user-menu">
              <div className="w-8 h-8 rounded-full bg-[#C9A227] text-[#071426] flex items-center justify-center font-bold text-xs">
                {initials(user.name)}
              </div>
              <span className="text-sm hidden md:inline max-w-[140px] truncate">{user.name}</span>
              <Icons.ChevronDown size={14} className="hidden md:inline" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-sm">{user.name}</p>
              <p className="text-xs text-slate-400 font-normal">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/app/change-password")} data-testid="menu-change-password">
              <Icons.KeyRound size={15} className="mr-2" /> Ubah Password
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout} data-testid="menu-logout" className="text-red-600">
              <Icons.LogOut size={15} className="mr-2" /> Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
