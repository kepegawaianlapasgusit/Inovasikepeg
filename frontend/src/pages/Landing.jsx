import { useNavigate } from "react-router-dom";
import { ArrowRight, Info, ShieldCheck, Users, ClipboardCheck, BarChart3 } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="h-screen max-h-screen w-full overflow-hidden bg-[#071426] text-white flex flex-col justify-between p-6 sm:p-10 lg:p-14 relative border-t-4 border-[#C9A227]">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0B1F3A] border border-[#C9A227]/40 text-[#D8B95A] text-xs font-semibold tracking-wider uppercase">
          <ShieldCheck size={13} /> Sistem Resmi Kepegawaian
        </span>
        <span className="text-xs text-slate-400 hidden sm:inline">Lapas Gunungsitoli</span>
      </div>

      <div className="max-w-3xl my-auto">
        <p className="text-[#C9A227] font-semibold tracking-widest text-sm uppercase mb-4">Lapas Gunungsitoli</p>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
          INFORMASI KEPEGAWAIAN <span className="text-[#C9A227]">LAGUSIT</span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-300 font-medium mt-3">Sistem Monitoring Kepegawaian</p>
        <p className="text-sm sm:text-base text-slate-400 mt-5 max-w-2xl leading-relaxed">
          Sistem terintegrasi untuk pengelolaan, monitoring, administrasi, dan evaluasi kepegawaian secara digital —
          absensi apel, KGB, kenaikan pangkat, agenda, dokumen, dan penilaian pegawai dalam satu platform.
        </p>

        <div className="flex flex-wrap gap-3 mt-8">
          <button
            data-testid="landing-login-btn"
            onClick={() => navigate("/login")}
            className="bg-[#C9A227] hover:bg-[#b59120] text-[#071426] font-bold px-7 py-3 rounded-md transition-colors shadow-md flex items-center gap-2 text-sm"
          >
            LOGIN <ArrowRight size={16} />
          </button>
          <button
            data-testid="landing-about-btn"
            onClick={() => document.getElementById("about-dialog").showModal()}
            className="bg-transparent border border-slate-600 hover:border-[#D8B95A] text-slate-200 hover:text-white font-medium px-7 py-3 rounded-md transition-colors flex items-center gap-2 text-sm"
          >
            <Info size={16} /> TENTANG SISTEM
          </button>
        </div>

        <div className="flex flex-wrap gap-5 mt-10 text-slate-400">
          <Feature icon={Users} label="Data Kepegawaian" />
          <Feature icon={ClipboardCheck} label="Absensi Apel & Notula" />
          <Feature icon={BarChart3} label="Monitoring & Laporan" />
        </div>
      </div>

      <div className="border-t border-slate-800 pt-4 flex justify-between items-center text-xs text-slate-500">
        <span>© {new Date().getFullYear()} Lapas Gunungsitoli</span>
        <span className="hidden sm:inline">Sistem Monitoring Kepegawaian</span>
      </div>

      <dialog id="about-dialog" className="rounded-lg p-0 backdrop:bg-black/60 max-w-lg w-[92%]">
        <div className="bg-white p-6 text-slate-800">
          <h3 className="text-lg font-bold text-[#0B1F3A]">Tentang Sistem</h3>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">
            INFORMASI KEPEGAWAIAN LAGUSIT adalah sistem monitoring kepegawaian Lapas Gunungsitoli. Sistem ini mengelola
            data pegawai, struktur organisasi, absensi apel (beserta notula/amanat dan dokumentasi kegiatan), KGB,
            kenaikan pangkat, agenda, pengumuman, dokumen, dan penilaian pegawai dengan kontrol akses berbasis peran dan
            izin (RBAC).
          </p>
          <p className="text-xs text-slate-500 mt-3">
            Pegawai merupakan objek yang dipantau — kehadiran apel diinput oleh Operator/Super Admin, dan pegawai dapat
            melihat rekap kehadiran pribadinya.
          </p>
          <div className="flex justify-end mt-5">
            <button
              onClick={() => document.getElementById("about-dialog").close()}
              className="bg-[#0B1F3A] text-white px-4 py-2 rounded-md text-sm font-medium"
              data-testid="about-close-btn"
            >
              Tutup
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

function Feature({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon size={16} className="text-[#C9A227]" />
      {label}
    </div>
  );
}
