"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { fieldClass } from "@/components/ui/field";

export function PaymentMethodFilter({ paymentMethods }: { paymentMethods: { id: string; name: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = searchParams.get("payment_method_id") ?? "";

  return (
    <select
      value={selected}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value) params.set("payment_method_id", e.target.value);
        else params.delete("payment_method_id");
        router.push(`/transactions?${params.toString()}`);
      }}
      className={`${fieldClass} w-36 print:hidden`}
    >
      <option value="">결제방식 전체</option>
      {paymentMethods.map((pm) => (
        <option key={pm.id} value={pm.id}>
          {pm.name}
        </option>
      ))}
    </select>
  );
}
