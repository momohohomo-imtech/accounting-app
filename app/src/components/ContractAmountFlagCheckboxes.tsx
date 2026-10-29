"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProjectContractAmountFlag } from "@/lib/actions/projects";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

type Field = "contract_amount_estimated" | "contract_amount_minimum";

export function ContractAmountFlagCheckboxes({
  projectId,
  initialEstimated,
  initialMinimum,
}: {
  projectId: string;
  initialEstimated: boolean;
  initialMinimum: boolean;
}) {
  const router = useRouter();
  const [estimated, setEstimated] = useState(initialEstimated);
  const [minimum, setMinimum] = useState(initialMinimum);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const globalPending = useGlobalPending();

  async function toggle(field: Field, checked: boolean) {
    const before = { estimated, minimum };
    if (field === "contract_amount_estimated") {
      setEstimated(checked);
      if (checked) setMinimum(false);
    } else {
      setMinimum(checked);
      if (checked) setEstimated(false);
    }
    setPending(true);
    const fd = new FormData();
    fd.set("id", projectId);
    fd.set("field", field);
    if (checked) fd.set("checked", "on");
    const result = await globalPending.run(() => updateProjectContractAmountFlag(fd));
    setPending(false);
    if (result?.error) {
      // 저장 안 됐으면 체크도 되돌림
      setEstimated(before.estimated);
      setMinimum(before.minimum);
      setError(`저장하지 못했습니다: ${result.error}`);
      return;
    }
    setError(null);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-4 print:hidden">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={estimated}
          disabled={pending}
          onChange={(e) => toggle("contract_amount_estimated", e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 accent-red-600"
        />
        수주액 예상금액 (체크 시 빨간색으로 표시)
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={minimum}
          disabled={pending}
          onChange={(e) => toggle("contract_amount_minimum", e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 accent-green-600"
        />
        최소금액 산정액 (체크시 녹색으로 표시)
      </label>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}
