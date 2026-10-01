import { DueModule } from "@/components/common/DueModule";

export default function Kgb() {
  return (
    <DueModule
      title="KGB — Kenaikan Gaji Berkala"
      subtitle="Monitoring & countdown KGB pegawai"
      endpoint="kgb"
      viewPerm="kgb.view"
      managePerm="kgb.manage"
      nextLabel="KGB Berikutnya"
      extraFields={[{ name: "gaji_pokok", label: "Gaji Pokok", type: "text" }]}
    />
  );
}
