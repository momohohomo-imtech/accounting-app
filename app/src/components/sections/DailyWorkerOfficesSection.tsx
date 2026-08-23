import { createClient } from "@/lib/supabase/server";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import { createOfficeRecord, updateOfficeRecord, deleteOfficeRecord } from "@/lib/actions/daily-worker-offices";
import type { FieldConfig } from "@/components/crud/types";

const fields: FieldConfig[] = [
  { name: "name", label: "사무소명", required: true },
  { name: "manager_name", label: "담당자" },
  { name: "phone", label: "연락처", type: "tel" },
];

export async function DailyWorkerOfficesSection() {
  const supabase = await createClient();
  const { data: offices } = await supabase
    .from("daily_worker_offices")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">인력사무소</h2>
      <CreatePanel title="인력사무소" fields={fields} createAction={createOfficeRecord} />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <EntityTable
          fields={fields}
          rows={offices ?? []}
          updateAction={updateOfficeRecord}
          deleteAction={deleteOfficeRecord}
        />
      </div>
    </div>
  );
}
