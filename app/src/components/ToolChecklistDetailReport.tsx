"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";
import { Button } from "@/components/ui/Button";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { downloadToolChecklistXlsx, downloadAccessPassFormXlsx } from "@/lib/xlsxExport";
import { AccessPassPermitTable } from "@/components/AccessPassPermitTable";

type GroupItem = { id: string; tool_name: string; quantity: string; for_access_pass: boolean };
type Group = { label: string; items: GroupItem[] };

export function ToolChecklistDetailReport({
  title,
  helperCount,
  projectName,
  tripDate,
  groups,
  closeHref,
  copyHref,
  editHref,
}: {
  title: string;
  helperCount?: number | null;
  projectName: string | null;
  tripDate: string | null;
  groups: Group[];
  closeHref: string;
  copyHref: string;
  editHref: string;
}) {
  const router = useRouter();
  const [accessPassOnly, setAccessPassOnly] = useState(false);
  const [formMode, setFormMode] = useState(false);
  useEscapeKey(true, () => router.push(closeHref));

  const hasAccessPassItems = groups.some((g) => g.items.some((it) => it.for_access_pass));
  const visibleGroups = groups
    .map((g) => ({ label: g.label, items: accessPassOnly ? g.items.filter((it) => it.for_access_pass) : g.items }))
    .filter((g) => g.items.length > 0);
  const selectedCount = visibleGroups.reduce(
    (sum, g) => sum + g.items.filter((it) => it.quantity.trim() !== "").length,
    0
  );
  const accessPassItems = groups
    .flatMap((g) => g.items)
    .filter((it) => it.for_access_pass && it.quantity.trim() !== "")
    .map((it) => ({ tool_name: it.tool_name, quantity: it.quantity }));
  const metaLine = `${projectName ? `${projectName} · ` : ""}${tripDate ? formatDate(tripDate) : "출장일 미지정"}`;

  async function handleExcel() {
    if (formMode) {
      await downloadAccessPassFormXlsx(`${title}_반입반출확인증(기아화성).xlsx`, accessPassItems);
      return;
    }
    await downloadToolChecklistXlsx(
      `${title}_${accessPassOnly ? "반입반출증" : "공구명세서"}.xlsx`,
      accessPassOnly ? `${title} (반입반출증)` : title,
      metaLine,
      visibleGroups
    );
  }

  return (
    <div className="space-y-4 print:space-y-1">
      {/* 양식 모드에서는 이 표제부가 인쇄에 안 나오게 함 — 아래 AccessPassPermitTable이
          자체 제목을 갖고 있고, 이 블록까지 같이 나오면 표가 페이지 높이(100vh)만큼
          늘어나면서 합쳐서 1장을 넘어가 버림. */}
      <div className={`flex flex-wrap items-center justify-between gap-2 print:mb-1 ${formMode ? "print:hidden" : ""}`}>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 print:text-sm">
            {title}
            {helperCount != null && <span className="ml-2 text-lg font-semibold text-slate-900 print:text-sm">조공 {helperCount}</span>}
            {formMode && <span className="ml-2 text-sm font-normal text-slate-500 print:text-xs">(반입반출확인증 양식)</span>}
            {!formMode && accessPassOnly && (
              <span className="ml-2 text-sm font-normal text-slate-500 print:text-xs">(반입반출증용만)</span>
            )}
          </h2>
          {!formMode && <p className="text-xs text-slate-500 print:text-[9px]">{metaLine}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          {hasAccessPassItems && !formMode && (
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
          {hasAccessPassItems && (
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={formMode}
                onChange={(e) => setFormMode(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              기아 화성공장 반입반출확인증 양식으로 보기
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

      {formMode ? (
        accessPassItems.length === 0 ? (
          <p className="py-6 text-center text-slate-400">반입반출증용으로 표시된 품목이 없습니다.</p>
        ) : (
          <AccessPassPermitTable items={accessPassItems} />
        )
      ) : (
        <>
          {/* 인쇄 시 항목이 아무리 많아도 1장에 다 들어가도록, 화면보다 글씨를 훨씬 작게
              하고 열을 늘려 촘촘하게 배치함(테두리도 인쇄에서는 뺌). */}
          <div className="space-y-4 print:space-y-1">
            {visibleGroups.map((g) => (
              <div key={g.label} className="print:break-inside-avoid">
                <p className="mb-1.5 text-xs font-semibold text-slate-500 print:mb-0.5 print:text-[10.5px]">{g.label}</p>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 print:grid-cols-4 print:gap-x-[45px] print:gap-y-0">
                  {g.items.map((it) => {
                    const filled = it.quantity.trim() !== "";
                    return (
                      <li
                        key={it.id}
                        className={`flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 print:gap-2 print:rounded-none print:border-0 print:border-b print:border-slate-200 print:px-0 print:py-0.5 print:text-[11px] ${filled ? "" : "print:opacity-50"}`}
                      >
                        <span className="truncate print:text-slate-900">☐ {it.tool_name}</span>
                        <span
                          className={`shrink-0 font-mono font-semibold print:text-slate-900 ${filled ? "text-slate-900" : "text-slate-400"}`}
                        >
                          {filled ? it.quantity : "-"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {visibleGroups.length === 0 && (
              <p className="py-6 text-center text-slate-400">
                {accessPassOnly ? "반입반출증용으로 표시된 품목이 없습니다." : "등록된 품목이 없습니다."}
              </p>
            )}
          </div>

          <p className="text-right text-xs text-slate-400 print:text-[9px]">총 {selectedCount}개 품목 선택됨</p>
        </>
      )}
    </div>
  );
}
