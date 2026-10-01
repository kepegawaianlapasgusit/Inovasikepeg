import RecordModule from "@/components/common/RecordModule";
import { StatusPill } from "@/components/common/Ui";
import { formatDate } from "@/lib/format";
import { useMaster } from "@/hooks/useMaster";

const VERIF = { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" };
const UNVERIF = { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" };

export default function Documents() {
  const { items: cats } = useMaster("categories");
  const docCats = cats.filter((c) => c.type === "document").map((c) => ({ value: c.name, label: c.name }));
  return (
    <RecordModule
      title="Dokumen"
      subtitle="Manajemen dokumen kepegawaian"
      icon="FileText"
      endpoint="documents"
      viewPerm="document.view"
      managePerm="document.manage"
      fields={[
        { name: "employee_id", label: "Pegawai", type: "employee", required: true, span: 2 },
        { name: "category", label: "Kategori", type: "select", options: docCats, required: true },
        { name: "nomor", label: "Nomor Dokumen", type: "text" },
        { name: "tanggal", label: "Tanggal", type: "date" },
        { name: "tanggal_berlaku", label: "Tanggal Berlaku", type: "date" },
        { name: "tanggal_kedaluwarsa", label: "Tanggal Kedaluwarsa", type: "date" },
        { name: "verification_status", label: "Status Verifikasi", type: "select", options: [{ value: "Terverifikasi", label: "Terverifikasi" }, { value: "Belum Verifikasi", label: "Belum Verifikasi" }] },
        { name: "file_name", label: "Nama File", type: "text" },
        { name: "catatan", label: "Catatan", type: "textarea", span: 2 },
      ]}
      columns={[
        { key: "employee", label: "Pegawai", render: (r) => r.employee?.name || "-" },
        { key: "category", label: "Kategori" },
        { key: "nomor", label: "Nomor" },
        { key: "tanggal", label: "Tanggal", render: (r) => formatDate(r.tanggal) },
        { key: "verification_status", label: "Verifikasi", render: (r) => <StatusPill style={r.verification_status === "Terverifikasi" ? VERIF : UNVERIF} label={r.verification_status || "Belum Verifikasi"} /> },
      ]}
    />
  );
}
