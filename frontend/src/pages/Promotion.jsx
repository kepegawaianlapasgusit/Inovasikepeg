import { DueModule } from "@/components/common/DueModule";

export default function Promotion() {
  return (
    <DueModule
      title="Kenaikan Pangkat"
      subtitle="Monitoring periode & persyaratan kenaikan pangkat"
      endpoint="promotion"
      viewPerm="promotion.view"
      managePerm="promotion.manage"
      nextLabel="Periode Berikutnya"
      extraFields={[
        { name: "pangkat_sekarang", label: "Pangkat Sekarang", type: "text" },
        { name: "pangkat_tujuan", label: "Pangkat Tujuan", type: "text" },
        { name: "persyaratan", label: "Persyaratan", type: "textarea", span: 2 },
      ]}
    />
  );
}
