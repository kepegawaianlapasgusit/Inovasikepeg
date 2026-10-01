import RecordModule from "@/components/common/RecordModule";
import { formatDate } from "@/lib/format";
import { useMaster } from "@/hooks/useMaster";

export default function Leave() {
  const { items: cats } = useMaster("categories");
  const leaveCats = cats.filter((c) => c.type === "leave").map((c) => ({ value: c.name, label: c.name }));
  return (
    <RecordModule
      title="Cuti"
      subtitle="Pengajuan dan riwayat cuti pegawai"
      icon="CalendarOff"
      endpoint="leave"
      viewPerm="leave.view"
      managePerm="leave.manage"
      fields={[
        { name: "employee_id", label: "Pegawai", type: "employee", required: true, span: 2 },
        { name: "jenis", label: "Jenis Cuti", type: "select", options: leaveCats, required: true },
        { name: "status", label: "Status", type: "select", options: [{ value: "Diajukan", label: "Diajukan" }, { value: "Disetujui", label: "Disetujui" }, { value: "Ditolak", label: "Ditolak" }] },
        { name: "tanggal_mulai", label: "Tanggal Mulai", type: "date" },
        { name: "tanggal_selesai", label: "Tanggal Selesai", type: "date" },
        { name: "alasan", label: "Alasan", type: "textarea", span: 2 },
      ]}
      columns={[
        { key: "employee", label: "Pegawai", render: (r) => r.employee?.name || "-" },
        { key: "jenis", label: "Jenis" },
        { key: "tanggal_mulai", label: "Mulai", render: (r) => formatDate(r.tanggal_mulai) },
        { key: "tanggal_selesai", label: "Selesai", render: (r) => formatDate(r.tanggal_selesai) },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
