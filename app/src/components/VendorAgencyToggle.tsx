"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function VendorAgencyToggle({ checked }: { checked: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function toggle(next: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("vendorAgency", "1");
    else params.delete("vendorAgency");
    router.push(`/reports?${params.toString()}`);
  }

  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-600 print:hidden">
      <input type="checkbox" checked={checked} onChange={(e) => toggle(e.target.checked)} className="h-3.5 w-3.5" />
      대행구매 합산
    </label>
  );
}
