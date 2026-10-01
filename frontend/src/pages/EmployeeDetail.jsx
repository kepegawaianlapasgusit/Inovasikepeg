import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, StatusPill } from "@/components/common/Ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDate, initials } from "@/lib/format";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [emp, setEmp] = useState(null);
  const [summary, setSummary] = useState(null);
  const [related, setRelated] = useState({ kgb: [], promotion: [], documents: [], training: [], awards: [] });

  useEffect(() => {
    api.get(`/employees/${id}`).then(({ data }) => setEmp(data)).catch(() => navigate("/app/employees"));
    api.get(`/attendance/summary/${id}`).then(({ data }) => setSummary(data)).catch(() => {});
    Promise.allSettled([
      api.get(`/kgb?employee_id=${id}`), api.get(`/promotion?employee_id=${id}`),
      api.get(`/documents?employee_id=${id}`), api.get(`/training?employee_id=${id}`),
      api.get(`/awards?employee_id=${id}`),
    ]).then(([k, p, d, t, a]) => setRelated({
      kgb: k.value?.data || [], promotion: p.value?.data || [], documents: d.value?.data || [],
      training: t.value?.data || [], awards: a.value?.data || [],
    }));
  }, [id, navigate]);

  if (!emp) return <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={18} /> Memuat...</div>;

  const Row = ({ label, value }) => (
    <div className="flex justify-between py-2 border-b border-slate-100 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800 font-medium text-right">{value || "-"}</span>
    </div>
  );

  const list = (rows, cols, empty) => (
    rows.length === 0 ? <p className="text-sm text-slate-400 py-4">{empty}</p> : (
      <div className="divide-y divide-slate-100">
        {rows.map((r) => (
          <div key={r.id} className="py-3 text-sm flex justify-between">
            {cols(r)}
          </div>
        ))}
      </div>
    )
  );

  return (
    <div>
      <button onClick={() => navigate("/app/employees")} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-4" data-testid="back-btn">
        <ArrowLeft size={16} /> Kembali
      </button>

      <Card className="p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#0B1F3A] text-[#D8B95A] border border-[#C9A227]/40 flex items-center justify-center font-bold text-xl">{initials(emp.name)}</div>
          <div>
            <h1 className="text-xl font-bold text-[#0B1F3A]">{emp.name}{emp.gelar ? `, ${emp.gelar}` : ""}</h1>
            <p className="text-sm text-slate-500">{emp.nip}</p>
            <p className="text-sm text-slate-600 mt-1">{emp.position_name || "-"} · {emp.unit_name || "-"}</p>
          </div>
          <div className="ml-auto"><StatusPill style={{ bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" }} label={emp.status_kepegawaian} /></div>
        </div>
      </Card>

      <Tabs defaultValue="pribadi">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="pribadi" data-testid="tab-pribadi">Data Pribadi</TabsTrigger>
          <TabsTrigger value="kepegawaian" data-testid="tab-kepegawaian">Kepegawaian</TabsTrigger>
          <TabsTrigger value="kehadiran" data-testid="tab-kehadiran">Ringkasan Kehadiran</TabsTrigger>
          <TabsTrigger value="kgb" data-testid="tab-kgb">KGB</TabsTrigger>
          <TabsTrigger value="pangkat" data-testid="tab-pangkat">Kenaikan Pangkat</TabsTrigger>
          <TabsTrigger value="dokumen" data-testid="tab-dokumen">Dokumen</TabsTrigger>
          <TabsTrigger value="diklat" data-testid="tab-diklat">Pendidikan & Diklat</TabsTrigger>
          <TabsTrigger value="penghargaan" data-testid="tab-penghargaan">Penghargaan</TabsTrigger>
        </TabsList>

        <TabsContent value="pribadi">
          <Card className="p-6">
            <Row label="NIK" value={emp.nik} />
            <Row label="Tempat, Tanggal Lahir" value={`${emp.tempat_lahir || "-"}, ${formatDate(emp.tanggal_lahir)}`} />
            <Row label="Jenis Kelamin" value={emp.jenis_kelamin} />
            <Row label="Alamat" value={emp.alamat} />
            <Row label="Telepon" value={emp.phone} />
            <Row label="Email" value={emp.email} />
            <Row label="Pendidikan" value={emp.pendidikan} />
          </Card>
        </TabsContent>

        <TabsContent value="kepegawaian">
          <Card className="p-6">
            <Row label="Golongan/Pangkat" value={`${emp.grade_name || "-"}${emp.pangkat ? ` (${emp.pangkat})` : ""}`} />
            <Row label="Jabatan" value={emp.position_name} />
            <Row label="Unit/Bagian" value={emp.unit_name} />
            <Row label="Seksi" value={emp.section_name} />
            <Row label="Regu (Rupam)" value={emp.team_name} />
            <Row label="Status" value={emp.status_kepegawaian} />
            <Row label="TMT Kerja" value={formatDate(emp.tmt_kerja)} />
            <Row label="Tanggal Pensiun" value={formatDate(emp.tanggal_pensiun)} />
          </Card>
        </TabsContent>

        <TabsContent value="kehadiran">
          <Card className="p-6">
            {!summary ? <p className="text-sm text-slate-400">Memuat...</p> : summary.per_type.length === 0 ? (
              <p className="text-sm text-slate-400">Belum ada data kehadiran.</p>
            ) : (
              <div>
                <div className="grid sm:grid-cols-3 gap-4 mb-4">
                  {summary.per_type.map((t) => (
                    <div key={t.type_id} className="border border-slate-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-slate-700">{t.type_name}</p>
                      <p className="text-2xl font-bold text-[#0B1F3A] mt-1">{t.present}<span className="text-base text-slate-400"> / {t.total}</span></p>
                      <p className="text-sm font-semibold text-[#047857]">{t.percentage}%</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-slate-600">Persentase kehadiran keseluruhan: <b className="text-[#0B1F3A]">{summary.overall_percentage}%</b></p>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="kgb"><Card className="p-6">{list(related.kgb, (r) => (<><span>{r.nomor_sk || "KGB"} · {formatDate(r.next_date)}</span><StatusPill style={{ bg: "#FEF3C7", text: "#D97706" }} label={r.status} /></>), "Belum ada data KGB.")}</Card></TabsContent>
        <TabsContent value="pangkat"><Card className="p-6">{list(related.promotion, (r) => (<><span>{r.pangkat_tujuan || "Kenaikan"} · {formatDate(r.next_date)}</span><StatusPill style={{ bg: "#FEF3C7", text: "#D97706" }} label={r.status} /></>), "Belum ada data kenaikan pangkat.")}</Card></TabsContent>
        <TabsContent value="dokumen"><Card className="p-6">{list(related.documents, (r) => (<><span>{r.category} · {r.nomor || "-"}</span><span className="text-slate-400">{formatDate(r.tanggal)}</span></>), "Belum ada dokumen.")}</Card></TabsContent>
        <TabsContent value="diklat"><Card className="p-6">{list(related.training, (r) => (<><span>{r.jenis}: {r.nama}</span><span className="text-slate-400">{formatDate(r.tanggal_mulai)}</span></>), "Belum ada data pendidikan/diklat.")}</Card></TabsContent>
        <TabsContent value="penghargaan"><Card className="p-6">{list(related.awards, (r) => (<><span>{r.nama} · {r.pemberi || "-"}</span><span className="text-slate-400">{formatDate(r.tanggal)}</span></>), "Belum ada penghargaan.")}</Card></TabsContent>
      </Tabs>
    </div>
  );
}
