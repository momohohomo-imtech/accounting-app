"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";
import { Button } from "@/components/ui/Button";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { downloadXlsx } from "@/lib/xlsxExport";

type Item = { id: string; tool_name: string; quantity: string; for_access_pass: boolean };

export function ToolChecklistDetailReport({
  title,
  projectName,
  tripDate,
  items,
  closeHref,
  copyHref,
  editHref,
}: {
  title: string;
  projectName: string | null;
  tripDate: string | null;
  items: Item[];
  closeHref: string;
  copyHref: string;
  editHref: string;
}) {
  const router = useRouter();
  const [accessPassOnly, setAccessPassOnly] = useState(false);
  useEscapeKey(true, () => router.push(closeHref));

  const hasAccessPassItems = items.some((it) => it.for_access_pass);
  const visibleItems = accessPassOnly ? items.filter((it) => it.for_access_pass) : items;
  const metaLine = `${projectName ? `${projectName} · ` : ""}${tripDate ? formatDate(tripDate) : "출장일 미지정"}`;

  async function handleExcel() {
    await downloadXlsx(
      `${title}_${accessPassOnly ? "반입반출증" : "공구명세서"}.xlsx`,
      ["공구명", "수량"],
      visibleItems.map((it) => [it.tool_name, it.quantity]),
      accessPassOnly ? "반입반출증" : "공구명세서",
      [[accessPassOnly ? `${title} (반입반출증)` : title], [metaLine], [`총 ${visibleItems.length}개 품목`]]
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {title}
            {accessPassOnly && <span className="ml-2 text-sm font-normal text-slate-500">(반입반출증용만)</span>}
          </h2>
          <p className="text-xs text-slate-500">{metaLine}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          {hasAccessPassItems && (
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={accessPassOnly}
                onChange={(e) => setAccessPassOnly(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              반입반출증용만 표시
            </label>
          )}
          <PrintButton />
          <Button variant="secondary" size="xs" onClick={handleExcel}>
            엑셀 다운로드
          </Button>
          <Link href={editHref} className="text-sm text-slate-500 hover:text-slate-800">
            수정
          </Link>
          <Link href={copyHref} className="text-sm text-slate-500 hover:text-slate-800">
            복사해서 새로 만들기
          </Link>
          <Link href={closeHref} className="text-sm text-slate-500 hover:text-slate-800">
            닫기
          </Link>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visibleItems.map((it) => (
          <li
            key={it.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
          >
            <span className="truncate">☑ {it.tool_name}</span>
            <span className="shrink-0 font-mono font-semibold text-slate-900">{it.quantity}</span>
          </li>
        ))}
        {visibleItems.length === 0 && (
          <li className="col-span-full py-6 text-center text-slate-400">
            {accessPassOnly ? "반입반출증용으로 표시된 품목이 없습니다." : "등록된 품목이 없습니다."}
          </li>
        )}
      </ul>

      <p className="text-right text-xs text-slate-400">총 {visibleItems.length}개 품목</p>
    </div>
  );
}
