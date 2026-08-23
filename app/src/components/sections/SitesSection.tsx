import { createClient } from "@/lib/supabase/server";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import { createSiteRecord, updateSiteRecord, deleteSiteRecord } from "@/lib/actions/sites";
import type { FieldConfig } from "@/components/crud/types";

const fields: FieldConfig[] = [
  { name: "name", label: "현장명", required: true },
  { name: "location", label: "위치" },
  { name: "manager_name", label: "현장 담당자" },
];

export async function SitesSection() {
  const supabase = await createClient();
  const { data: sites } = await supabase.from("sites").select("*").order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">현장</h2>
      <CreatePanel title="현장" fields={fields} createAction={createSiteRecord} />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <EntityTable fields={fields} rows={sites ?? []} updateAction={updateSiteRecord} deleteAction={deleteSiteRecord} />
      </div>
    </div>
  );
}
