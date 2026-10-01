import RecordModule from "@/components/common/RecordModule";
import { formatDate } from "@/lib/format";
import { useMaster } from "@/hooks/useMaster";

export default function Awards() {
  const { items: cats } = useMaster("categories");
  const awardCats = cats.filter((c) => c.type === "award").map((c) => ({ value: c.name, label: c.name }));
  return (
    <RecordModule
      title="Penghargaan / Prestasi"
      subtitle="Data penghargaan dan prestasi pegawai"
      icon="Medal"
      endpoint="awards"
      viewPerm="award.view"
      managePerm="award.manage"
      fields={[
        { name: "employee_id", label: "Pegawai", type: "employee", required: true, span: 2 },
        { name: "jenis", label: "Jenis Penghargaan", type: "select", options: awardCats, required: true },
        { name: "nama", label: "Nama Penghargaan", type: "text", required: true },
        { name: "tanggal", label: "Tanggal", type: "date" },
        { name: "pemberi", label: "Pemberi", type: "text" },
        { name: "nomor", label: "Nomor Dokumen", type: "text" },
        { name: "keterangan", label: "Keterangan", type: "textarea", span: 2 },
      ]}
      columns={[
        { key: "employee", label: "Pegawai", render: (r) => r.employee?.name || "-" },
        { key: "jenis", label: "Jenis" },
        { key: "nama", label: "Nama" },
        { key: "pemberi", label: "Pemberi" },
        { key: "tanggal", label: "Tanggal", render: (r) => formatDate(r.tanggal) },
      ]}
    />
  );
}
