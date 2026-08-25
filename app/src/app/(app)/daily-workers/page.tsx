import { createClient } from "@/lib/supabase/server";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import {
  createDailyWorkerRecord,
  updateDailyWorkerRecord,
  deleteDailyWorkerRecord,
} from "@/lib/actions/daily-workers";
import type { FieldConfig } from "@/components/crud/types";
import { PageTabs } from "@/components/PageTabs";
import { DailyWorkerOfficesSection } from "@/components/sections/DailyWorkerOfficesSection";
import { AccessListsSection } from "@/components/sections/AccessListsSection";

const TABS = [
  { key: "list", label: "일용직 근로자" },
  { key: "offices", label: "인력사무소" },
  { key: "access", label: "출입명단" },
];

export default async function DailyWorkersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active = tab ?? "list";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">일용직 관리</h1>
      <PageTabs basePath="/daily-workers" tabs={TABS} active={active} />
      {active === "offices" && <DailyWorkerOfficesSection />}
      {active === "access" && <AccessListsSection />}
      {active === "list" && <WorkerListSection />}
    </div>
  );
}

async function WorkerListSection() {
  const supabase = await createClient();
  const [{ data: offices }, { data: workers }] = await Promise.all([
    supabase.from("daily_worker_offices").select("id, name").order("name"),
    supabase
      .from("daily_workers")
      .select("*, daily_worker_offices(name)")
      .order("registered_at", { ascending: false }),
  ]);

  const fields: FieldConfig[] = [
    {
      name: "office_id",
      label: "인력사무소",
      type: "select",
      required: true,
      options: (offices ?? []).map((o) => ({ value: o.id, label: o.name })),
    },
    { name: "name", label: "이름", required: true },
    { name: "grade", label: "등급", width: "6%" },
    { name: "birth_date", label: "생년월일", type: "date", hideInTable: true },
    {
      name: "resident_id_masked",
      label: "주민번호(마스킹)",
      placeholder: "예: 710429-*******",
      hideInTable: true,
    },
    { name: "phone", label: "연락처", type: "tel" },
    { name: "nationality", label: "국적" },
    { name: "current_location", label: "현재 위치", hideInTable: true },
    {
      name: "status",
      label: "상태",
      type: "select",
      options: [
        { value: "active", label: "근무중" },
        { value: "ended", label: "종료" },
      ],
    },
    { name: "language_ability", label: "언어능력", hideInTable: true },
    { name: "other_ability", label: "기타능력", hideInTable: true },
    { name: "bank_name", label: "은행", hideInTable: true },
    { name: "account_number", label: "계좌번호", hideInTable: true },
    { name: "memo", label: "메모", type: "textarea", hideInTable: true },
  ];

  return (
    <div className="space-y-6">
      <CreatePanel title="일용직 근로자" fields={fields} createAction={createDailyWorkerRecord} />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <EntityTable
          fields={fields}
          rows={workers ?? []}
          updateAction={updateDailyWorkerRecord}
          deleteAction={deleteDailyWorkerRecord}
        />
      </div>
    </div>
  );
}
