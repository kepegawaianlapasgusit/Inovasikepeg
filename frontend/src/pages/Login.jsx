import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader2, ArrowLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";

export default function Login() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/app" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await login(email, password);
    setBusy(false);
    if (res.ok) navigate("/app");
    else setError(res.error);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F8FAFC]">
      <div className="hidden lg:flex lg:w-1/2 bg-[#071426] text-white flex-col justify-between p-12 border-r-4 border-[#C9A227]">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm w-fit" data-testid="back-home-btn">
          <ArrowLeft size={16} /> Beranda
        </button>
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0B1F3A] border border-[#C9A227]/40 text-[#D8B95A] text-xs font-semibold tracking-wider uppercase mb-6">
            <ShieldCheck size={13} /> Akses Terproteksi
          </span>
          <h2 className="text-4xl font-extrabold tracking-tight leading-tight">
            INFORMASI KEPEGAWAIAN <span className="text-[#C9A227]">LAGUSIT</span>
          </h2>
          <p className="text-slate-300 mt-3 text-lg">Sistem Monitoring Kepegawaian</p>
          <p className="text-slate-500 mt-6 text-sm max-w-md">Lapas Gunungsitoli — masuk menggunakan akun yang terdaftar untuk mengakses dashboard.</p>
        </div>
        <p className="text-xs text-slate-600">© {new Date().getFullYear()} Lapas Gunungsitoli</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <h2 className="text-2xl font-extrabold text-[#0B1F3A]">LAGUSIT</h2>
            <p className="text-sm text-slate-500">Sistem Monitoring Kepegawaian</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
            <h1 className="text-xl font-bold text-[#0B1F3A]">Masuk ke Sistem</h1>
            <p className="text-sm text-slate-500 mt-1 mb-6">Gunakan email dan password Anda.</p>

            {error && (
              <div className="mb-4 text-sm bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2" data-testid="login-error">
                {error}
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Email</label>
                <input
                  data-testid="login-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]"
                  placeholder="nama@lagusit.go.id"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Password</label>
                <div className="relative mt-1">
                  <input
                    data-testid="login-password-input"
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full border border-slate-300 rounded-md px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" data-testid="toggle-password">
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button
                data-testid="login-submit-btn"
                type="submit"
                disabled={busy}
                className="w-full bg-[#C9A227] hover:bg-[#b59120] text-[#071426] font-bold py-2.5 rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy && <Loader2 size={16} className="animate-spin" />} MASUK
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
