"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fieldClass } from "@/components/ui/field";

export function WorkLogMonthRangeFilter({ value }: { value: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [input, setInput] = useState(value);

  function apply() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("wlMonths", input.trim() || "1-12");
    router.push(`/reports?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && apply()}
        placeholder="예: 3 또는 1-12"
        className={`${fieldClass} w-28`}
      />
      <button
        type="button"
        onClick={apply}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
      >
        적용
      </button>
    </div>
  );
}
