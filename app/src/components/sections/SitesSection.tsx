import { createClient } from "@/lib/supabase/server";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import { createSiteRecord, updateSiteRecord, deleteSiteRecord } from "@/lib/actions/sites";
import type { FieldConfig } from "@/components/crud/types";
import { ClientsSection } from "@/components/sections/ClientsSection";

export async function SitesSection() {
  const supabase = await createClient();
  const [{ data: sites }, { data: clients }] = await Promise.all([
    supabase.from("sites").select("*, clients(name)").order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name").order("name"),
  ]);

  const fields: FieldConfig[] = [
    {
      name: "client_id",
      label: "거래처(발주처)",
      type: "select",
      options: [{ value: "", label: "없음" }, ...(clients ?? []).map((c) => ({ value: c.id, label: c.name }))],
    },
    { name: "name", label: "현장명", required: true },
    { name: "location", label: "위치" },
    { name: "manager_name", label: "현장 담당자" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">현장</h2>
      <CreatePanel title="현장" fields={fields} createAction={createSiteRecord} />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <EntityTable
          fields={fields}
          rows={(sites ?? []).map((s) => ({ ...s }))}
          updateAction={updateSiteRecord}
          deleteAction={deleteSiteRecord}
        />
      </div>

      <div className="border-t border-slate-200 pt-6">
        <ClientsSection />
      </div>
    </div>
  );
}
