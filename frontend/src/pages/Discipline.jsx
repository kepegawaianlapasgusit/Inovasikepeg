import RecordModule from "@/components/common/RecordModule";
import { formatDate } from "@/lib/format";

export default function Discipline() {
  return (
    <RecordModule
      title="Disiplin"
      subtitle="Data pelanggaran dan tindakan disiplin (akses terbatas)"
      icon="ShieldAlert"
      endpoint="discipline"
      viewPerm="discipline.view"
      managePerm="discipline.manage"
      fields={[
        { name: "employee_id", label: "Pegawai", type: "employee", required: true, span: 2 },
        { name: "jenis", label: "Jenis Pelanggaran", type: "text", required: true },
        { name: "pelanggaran", label: "Uraian Pelanggaran", type: "textarea", span: 2 },
        { name: "tindakan", label: "Tindakan", type: "text" },
        { name: "tanggal", label: "Tanggal", type: "date" },
        { name: "status", label: "Status", type: "select", options: [{ value: "Proses", label: "Proses" }, { value: "Selesai", label: "Selesai" }] },
        { name: "nomor_dokumen", label: "Nomor Dokumen", type: "text" },
      ]}
      columns={[
        { key: "employee", label: "Pegawai", render: (r) => r.employee?.name || "-" },
        { key: "jenis", label: "Jenis" },
        { key: "tindakan", label: "Tindakan" },
        { key: "tanggal", label: "Tanggal", render: (r) => formatDate(r.tanggal) },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
