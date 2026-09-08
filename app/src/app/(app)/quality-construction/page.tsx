import { PageTabs } from "@/components/PageTabs";
import { QualityChecklistSection } from "@/components/sections/QualityChecklistSection";
import { ConstructionMemoSection } from "@/components/sections/ConstructionMemoSection";
import { ToolListSection } from "@/components/sections/ToolListSection";

const TABS = [
  { key: "quality", label: "품질관리" },
  { key: "construction", label: "공사 메모" },
  { key: "tools", label: "공구리스트" },
];

export default async function QualityConstructionPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    project_id?: string;
    year?: string;
    client?: string;
    site_id?: string;
    copyFrom?: string;
    editFrom?: string;
    checklist?: string;
  }>;
}) {
  const { tab, project_id, year, client, site_id, copyFrom, editFrom, checklist } = await searchParams;
  const active = tab ?? "quality";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 print:hidden">공사 관리</h1>
      <div className="print:hidden">
        <PageTabs basePath="/quality-construction" tabs={TABS} active={active} />
      </div>
      {active === "quality" && <QualityChecklistSection projectId={project_id} />}
      {active === "construction" && (
        <ConstructionMemoSection year={year} client={client} siteId={site_id} projectId={project_id} />
      )}
      {active === "tools" && <ToolListSection copyFrom={copyFrom} editFrom={editFrom} checklist={checklist} />}
    </div>
  );
}
