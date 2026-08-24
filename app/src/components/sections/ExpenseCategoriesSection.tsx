import { createClient } from "@/lib/supabase/server";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import {
  createExpenseCategoryRecord,
  updateExpenseCategoryRecord,
  deleteExpenseCategoryRecord,
} from "@/lib/actions/expense-categories";
import type { FieldConfig } from "@/components/crud/types";

const fields: FieldConfig[] = [
  { name: "name", label: "이름", required: true, placeholder: "예: 차량, 출장, 회식, 접대" },
  { name: "sort_order", label: "정렬순서", type: "number" },
];

export async function ExpenseCategoriesSection() {
  const supabase = await createClient();
  const { data: categories } = await supabase.from("expense_categories").select("*").order("sort_order");

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">지출카테고리</h2>
      <CreatePanel title="지출카테고리" fields={fields} createAction={createExpenseCategoryRecord} />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <EntityTable
          fields={fields}
          rows={categories ?? []}
          updateAction={updateExpenseCategoryRecord}
          deleteAction={deleteExpenseCategoryRecord}
        />
      </div>
    </div>
  );
}
