import { createClient } from "@/lib/supabase/server";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import { createProjectRecord, updateProjectRecord, deleteProjectRecord } from "@/lib/actions/projects";
import type { FieldConfig } from "@/components/crud/types";
import { PageTabs } from "@/components/PageTabs";
import { SitesSection } from "@/components/sections/SitesSection";

const TABS = [
  { key: "list", label: "프로젝트" },
  { key: "sites", label: "현장" },
];

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; year?: string }>;
}) {
  const { tab, year } = await searchParams;
  const active = tab ?? "list";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">프로젝트·현장</h1>
      <PageTabs basePath="/projects" tabs={TABS} active={active} />
      {active === "sites" && <SitesSection />}
      {active === "list" && <ProjectListSection year={year} />}
    </div>
  );
}

async function ProjectListSection({ year }: { year?: string }) {
  const supabase = await createClient();
  const currentYear = new Date().getFullYear();
  const selectedYear = year ? Number(year) : currentYear;

  const [{ data: sites }, { data: allProjects }, { data: projects }] = await Promise.all([
    supabase.from("sites").select("id, name").order("name"),
    supabase.from("projects").select("id, name"),
    supabase
      .from("projects")
      .select("*, sites(name)")
      .eq("year", selectedYear)
      .order("created_at", { ascending: false }),
  ]);

  const fields: FieldConfig[] = [
    {
      name: "site_id",
      label: "현장",
      type: "select",
      required: true,
      options: (sites ?? []).map((s) => ({ value: s.id, label: s.name })),
    },
    { name: "name", label: "프로젝트명", required: true },
    {
      name: "parent_project_id",
      label: "상위 프로젝트",
      type: "select",
      options: [{ value: "", label: "없음" }, ...(allProjects ?? []).map((p) => ({ value: p.id, label: p.name }))],
    },
    {
      name: "status",
      label: "상태",
      type: "select",
      options: [
        { value: "ongoing", label: "진행중" },
        { value: "done", label: "완료" },
        { value: "etc", label: "기타" },
      ],
    },
    { name: "is_service", label: "서비스(무상) 작업", type: "checkbox" },
    { name: "start_date", label: "시작일", type: "date" },
    { name: "end_date", label: "종료일", type: "date" },
    { name: "progress_pct", label: "진행률(%)", type: "number" },
    { name: "year", label: "연도", type: "number", required: true },
  ];

  const years = Array.from({ length: 6 }, (_, i) => currentYear - 3 + i);

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-1">
        {years.map((y) => (
          <a
            key={y}
            href={`/projects?year=${y}`}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              y === selectedYear ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-100"
            }`}
          >
            {y}
          </a>
        ))}
      </div>

      <CreatePanel title="프로젝트" fields={fields} createAction={createProjectRecord} />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <EntityTable
          fields={fields}
          rows={(projects ?? []).map((p) => ({ ...p, site_name: p.sites?.name }))}
          updateAction={updateProjectRecord}
          deleteAction={deleteProjectRecord}
        />
      </div>
    </div>
  );
}
