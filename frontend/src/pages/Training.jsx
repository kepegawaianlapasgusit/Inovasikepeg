import RecordModule from "@/components/common/RecordModule";
import { formatDate } from "@/lib/format";

export default function Training() {
  return (
    <RecordModule
      title="Pendidikan & Diklat"
      subtitle="Riwayat pendidikan, pelatihan, sertifikasi, dan diklat"
      icon="GraduationCap"
      endpoint="training"
      viewPerm="training.view"
      managePerm="training.manage"
      fields={[
        { name: "employee_id", label: "Pegawai", type: "employee", required: true, span: 2 },
        { name: "jenis", label: "Jenis", type: "select", options: ["Pendidikan", "Pelatihan", "Sertifikasi", "Seminar", "Workshop", "Diklat"].map((x) => ({ value: x, label: x })), required: true },
        { name: "nama", label: "Nama/Judul", type: "text", required: true },
        { name: "penyelenggara", label: "Penyelenggara", type: "text" },
        { name: "tanggal_mulai", label: "Tanggal Mulai", type: "date" },
        { name: "tanggal_selesai", label: "Tanggal Selesai", type: "date" },
        { name: "nomor_sertifikat", label: "Nomor Sertifikat", type: "text" },
        { name: "keterangan", label: "Keterangan", type: "textarea", span: 2 },
      ]}
      columns={[
        { key: "employee", label: "Pegawai", render: (r) => r.employee?.name || "-" },
        { key: "jenis", label: "Jenis" },
        { key: "nama", label: "Nama/Judul" },
        { key: "penyelenggara", label: "Penyelenggara" },
        { key: "tanggal_mulai", label: "Tanggal", render: (r) => formatDate(r.tanggal_mulai) },
      ]}
    />
  );
}
