import { createClient } from "@/lib/supabase/server";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import {
  createPaymentMethodRecord,
  updatePaymentMethodRecord,
  deletePaymentMethodRecord,
} from "@/lib/actions/payment-methods";
import type { FieldConfig } from "@/components/crud/types";

const fields: FieldConfig[] = [
  { name: "name", label: "이름", required: true, placeholder: "예: 신한카드, 현금, 송금" },
  { name: "sort_order", label: "정렬순서", type: "number" },
];

export async function PaymentMethodsSection() {
  const supabase = await createClient();
  const { data: paymentMethods } = await supabase.from("payment_methods").select("*").order("sort_order");

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">결제수단</h2>
      <CreatePanel title="결제수단" fields={fields} createAction={createPaymentMethodRecord} />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <EntityTable
          fields={fields}
          rows={paymentMethods ?? []}
          updateAction={updatePaymentMethodRecord}
          deleteAction={deletePaymentMethodRecord}
        />
      </div>
    </div>
  );
}
