"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProjectSettlementFinalized } from "@/lib/actions/projects";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

export function SettlementFinalizedCheckbox({
  projectId,
  initialChecked,
}: {
  projectId: string;
  initialChecked: boolean;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(initialChecked);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const globalPending = useGlobalPending();

  async function toggle(next: boolean) {
    setChecked(next);
    setPending(true);
    const fd = new FormData();
    fd.set("id", projectId);
    if (next) fd.set("settlement_finalized", "on");
    const result = await globalPending.run(() => updateProjectSettlementFinalized(fd));
    setPending(false);
    if (result?.error) {
      setChecked(!next);
      setError(`저장하지 못했습니다: ${result.error}`);
      return;
    }
    setError(null);
    router.refresh();
  }

  return (
    <div className="print:hidden">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={checked}
          disabled={pending}
          onChange={(e) => toggle(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 accent-slate-900"
        />
        결산완료 노란 경고해제
      </label>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
