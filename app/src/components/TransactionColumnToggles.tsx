"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function TransactionColumnToggles({
  showProject,
  showCategory,
  showItem,
}: {
  showProject: boolean;
  showCategory: boolean;
  showItem: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value ? "1" : "0");
    router.push(`/transactions?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-3 print:hidden">
      <label className="flex items-center gap-1.5 text-xs text-slate-600">
        <input type="checkbox" checked={showProject} onChange={(e) => setParam("showProject", e.target.checked)} className="h-3.5 w-3.5" />
        프로젝트
      </label>
      <label className="flex items-center gap-1.5 text-xs text-slate-600">
        <input type="checkbox" checked={showCategory} onChange={(e) => setParam("showCategory", e.target.checked)} className="h-3.5 w-3.5" />
        카테고리
      </label>
      <label className="flex items-center gap-1.5 text-xs text-slate-600">
        <input type="checkbox" checked={showItem} onChange={(e) => setParam("showItem", e.target.checked)} className="h-3.5 w-3.5" />
        품목
      </label>
    </div>
  );
}
