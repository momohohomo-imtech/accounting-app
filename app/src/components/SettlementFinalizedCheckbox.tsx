"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProjectSettlementFinalized } from "@/lib/actions/projects";

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

  async function toggle(next: boolean) {
    setChecked(next);
    setPending(true);
    const fd = new FormData();
    fd.set("id", projectId);
    if (next) fd.set("settlement_finalized", "on");
    await updateProjectSettlementFinalized(fd);
    setPending(false);
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-sm text-slate-700 print:hidden">
      <input
        type="checkbox"
        checked={checked}
        disabled={pending}
        onChange={(e) => toggle(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 accent-slate-900"
      />
      프로젝트 결산 정리완료 (체크 시 목록에서 노란색 경고 표시 해제)
    </label>
  );
}
