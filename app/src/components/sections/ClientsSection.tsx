import { createClient } from "@/lib/supabase/server";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import { createClientRecord, updateClientRecord, deleteClientRecord } from "@/lib/actions/clients";
import type { FieldConfig } from "@/components/crud/types";

export async function ClientsSection() {
  const supabase = await createClient();
  const [{ data: clients }, { data: categories }] = await Promise.all([
    supabase.from("clients").select("*").order("created_at", { ascending: false }),
    supabase.from("expense_categories").select("id, name").order("sort_order"),
  ]);

  const fields: FieldConfig[] = [
    { name: "name", label: "거래처명", required: true },
    {
      name: "type",
      label: "구분",
      type: "select",
      options: [
        { value: "both", label: "매입/매출처" },
        { value: "vendor", label: "매입처" },
        { value: "customer", label: "매출처" },
      ],
    },
    { name: "phone", label: "연락처", type: "tel" },
    { name: "default_item_name", label: "기본 품목", placeholder: "예: A제품 (거래 등록 시 자동 입력)" },
    {
      name: "default_category_id",
      label: "기본 카테고리",
      tableLabel: "기본 카테고리",
      type: "select",
      options: [
        { value: "", label: "선택 안함" },
        ...(categories ?? []).map((c) => ({ value: c.id, label: c.name })),
      ],
    },
    { name: "memo", label: "메모", type: "textarea" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">거래처</h2>
      <CreatePanel title="거래처" fields={fields} createAction={createClientRecord} />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <EntityTable
          fields={fields}
          rows={clients ?? []}
          updateAction={updateClientRecord}
          deleteAction={deleteClientRecord}
        />
      </div>
    </div>
  );
}
