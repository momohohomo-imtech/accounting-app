import { PageTabs } from "@/components/PageTabs";
import { QualityChecklistSection } from "@/components/sections/QualityChecklistSection";
import { ConstructionStageSection } from "@/components/sections/ConstructionStageSection";
import { ToolListSection } from "@/components/sections/ToolListSection";

const TABS = [
  { key: "quality", label: "품질관리" },
  { key: "construction", label: "공사관리" },
  { key: "tools", label: "공구리스트" },
];

export default async function QualityConstructionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; project_id?: string; copyFrom?: string; checklist?: string }>;
}) {
  const { tab, project_id, copyFrom, checklist } = await searchParams;
  const active = tab ?? "quality";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 print:hidden">품질관리·공사관리</h1>
      <div className="print:hidden">
        <PageTabs basePath="/quality-construction" tabs={TABS} active={active} />
      </div>
      {active === "quality" && <QualityChecklistSection projectId={project_id} />}
      {active === "construction" && <ConstructionStageSection projectId={project_id} />}
      {active === "tools" && <ToolListSection copyFrom={copyFrom} checklist={checklist} />}
    </div>
  );
}
