import { PageTabs } from "@/components/PageTabs";
import { QualityChecklistSection } from "@/components/sections/QualityChecklistSection";
import { ConstructionMemoSection } from "@/components/sections/ConstructionMemoSection";
import { ToolListSection } from "@/components/sections/ToolListSection";

const TABS = [
  { key: "tools", label: "공구리스트" },
  { key: "construction", label: "공사 메모" },
  { key: "quality", label: "품질관리" },
];

export default async function QualityConstructionPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    project_id?: string;
    year?: string;
    site_id?: string;
    month?: string;
    copyFrom?: string;
    editFrom?: string;
    checklist?: string;
    historyYear?: string;
    historyMonth?: string;
    historySite?: string;
  }>;
}) {
  const {
    tab,
    project_id,
    year,
    site_id,
    month,
    copyFrom,
    editFrom,
    checklist,
    historyYear,
    historyMonth,
    historySite,
  } = await searchParams;
  const active = tab ?? "tools";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 print:hidden">공사 관리</h1>
      <div className="print:hidden">
        <PageTabs basePath="/quality-construction" tabs={TABS} active={active} />
      </div>
      {active === "quality" && <QualityChecklistSection projectId={project_id} />}
      {active === "construction" && <ConstructionMemoSection year={year} siteId={site_id} month={month} />}
      {active === "tools" && (
        <ToolListSection
          copyFrom={copyFrom}
          editFrom={editFrom}
          checklist={checklist}
          historyYear={historyYear}
          historyMonth={historyMonth}
          historySite={historySite}
        />
      )}
    </div>
  );
}
