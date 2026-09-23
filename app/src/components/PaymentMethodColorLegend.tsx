"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePaymentMethodColor } from "@/lib/actions/payment-methods";
import { PAYMENT_METHOD_COLORS } from "@/lib/paymentMethodColors";
import { ColorSwatchPicker } from "@/components/ColorSwatchPicker";
import { Button } from "@/components/ui/Button";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

type PaymentMethod = { id: string; name: string; text_color: string | null; background_color: string | null };

function PaymentMethodRow({ method }: { method: PaymentMethod }) {
  const router = useRouter();
  const globalPending = useGlobalPending();
  const [editing, setEditing] = useState(false);
  const [textColor, setTextColor] = useState<string | null>(method.text_color);
  const [backgroundColor, setBackgroundColor] = useState<string | null>(method.background_color);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const fd = new FormData();
    fd.append("id", method.id);
    fd.append("text_color", textColor ?? "");
    fd.append("background_color", backgroundColor ?? "");
    await globalPending.run(() => updatePaymentMethodColor(fd));
    setPending(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          className="flex-1 truncate rounded-full px-2.5 py-0.5 text-center text-sm"
          style={{ color: method.text_color ?? undefined, backgroundColor: method.background_color ?? "#f1f5f9" }}
        >
          {method.name}
        </span>
        {editing ? (
          <Button type="button" variant="secondary" size="xs" disabled={pending} onClick={() => setEditing(false)}>
            취소
          </Button>
        ) : (
          <Button type="button" variant="secondary" size="xs" onClick={() => setEditing(true)}>
            색 지정
          </Button>
        )}
      </div>
      {editing && (
        <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
          <ColorSwatchPicker label="글씨색" value={textColor} onChange={setTextColor} colors={PAYMENT_METHOD_COLORS} />
          <ColorSwatchPicker
            label="배경색"
            value={backgroundColor}
            onChange={setBackgroundColor}
            colors={PAYMENT_METHOD_COLORS}
          />
          <Button type="button" size="xs" disabled={pending} onClick={save}>
            저장
          </Button>
        </div>
      )}
    </div>
  );
}

export function PaymentMethodColorLegend({ methods }: { methods: PaymentMethod[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
      <h2 className="mb-1 font-semibold text-slate-900">결제수단 색상</h2>
      <p className="mb-3 text-xs text-slate-400">
        결제수단 이름의 글씨색·배경색을 지정할 수 있어요. 지정 안 하면 기본 색으로 표시돼요.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {methods.map((m) => (
          <PaymentMethodRow key={m.id} method={m} />
        ))}
        {methods.length === 0 && <p className="text-sm text-slate-400">등록된 결제수단이 없습니다.</p>}
      </div>
    </div>
  );
}
