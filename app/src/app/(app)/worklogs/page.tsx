import { createClient } from "@/lib/supabase/server";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import { createWorkLogRecord, updateWorkLogRecord, deleteWorkLogRecord } from "@/lib/actions/worklogs";
import type { FieldConfig } from "@/components/crud/types";

export default async function WorkLogsPage() {
  const supabase = await createClient();
  const [{ data: projects }, { data: logs }] = await Promise.all([
    supabase.from("projects").select("id, name").order("name"),
    supabase
      .from("work_logs")
      .select("*, projects(name)")
      .order("log_date", { ascending: false }),
  ]);

  const fields: FieldConfig[] = [
    { name: "log_date", label: "날짜", type: "date", required: true },
    {
      name: "project_id",
      label: "프로젝트",
      type: "select",
      required: true,
      options: (projects ?? []).map((p) => ({ value: p.id, label: p.name })),
    },
    { name: "title", label: "제목", required: true },
    { name: "workers", label: "작업 인원" },
    { name: "start_time", label: "시작시간", type: "time" },
    { name: "end_time", label: "종료시간", type: "time" },
    { name: "content", label: "작업 내용", type: "textarea" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">작업일지</h1>
      <CreatePanel title="작업일지" fields={fields} createAction={createWorkLogRecord} />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <EntityTable fields={fields} rows={logs ?? []} updateAction={updateWorkLogRecord} deleteAction={deleteWorkLogRecord} />
      </div>
    </div>
  );
}
