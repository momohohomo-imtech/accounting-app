"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";
import { Button } from "@/components/ui/Button";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { usePrintFitToPage } from "@/lib/usePrintFitToPage";
import { downloadToolChecklistXlsx, downloadAccessPassFormXlsx } from "@/lib/xlsxExport";
import { AccessPassPermitTable } from "@/components/AccessPassPermitTable";
import { DongheeAccessPassPermitTable, ROW_COUNT as DONGHEE_ROW_COUNT } from "@/components/DongheeAccessPassPermitTable";

type FormMode = "none" | "kia" | "donghee";

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
  const [formMode, setFormMode] = useState<FormMode>("none");
  // 동희 반입반출증은 품목 수에 따라 여러 페이지로 늘어나는 게 정상이라, 전체를
  // 억지로 1페이지에 욱여넣는 이 훅을 꺼야 함(아래 dongheePages 참고).
  const printRef = usePrintFitToPage<HTMLDivElement>(270, formMode === "donghee");
  useEscapeKey(true, () => router.push(closeHref));

  // 마스터 목록 패딩용 항목(이 명세서에 실제로 안 담긴 것)은 제외 — 그렇지 않으면
  // 반입반출증용 공구가 마스터 어딘가에만 있어도 이 명세서와 무관하게 옵션이 뜸.
  const hasAccessPassItems = groups.some((g) => g.items.some((it) => it.for_access_pass && it.quantity.trim() !== ""));
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

  // 동희 반입반출증 한 장(DongheeAccessPassPermitTable)은 원본 서류와 동일하게
  // 품목 5줄 고정이라, 품목이 5개보다 많으면 여러 장으로 나눠야 함. 한 장은 A5라
  // 가로 A4 한 페이지에 왼쪽/오른쪽 2장씩 들어가므로, 5개씩 나눈 "장" 목록을 다시
  // 2개씩 묶어 페이지로 만든다(장이 홀수면 마지막 페이지 오른쪽은 비워둠 — 예전처럼
  // 왼쪽과 같은 내용을 복제하지 않음).
  const dongheeForms: { tool_name: string; quantity: string }[][] = [];
  for (let i = 0; i < accessPassItems.length; i += DONGHEE_ROW_COUNT) {
    dongheeForms.push(accessPassItems.slice(i, i + DONGHEE_ROW_COUNT));
  }
  const dongheePages: { tool_name: string; quantity: string }[][][] = [];
  for (let i = 0; i < dongheeForms.length; i += 2) {
    dongheePages.push(dongheeForms.slice(i, i + 2));
  }

  async function handleExcel() {
    if (formMode === "kia") {
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
    <div ref={printRef} className="space-y-4 print:space-y-1">
      {/* 양식 모드에서는 이 표제부가 인쇄에 안 나오게 함 — 아래 AccessPassPermitTable이
          자체 제목을 갖고 있어서 같이 나오면 중복됨. */}
      <div className={`flex flex-wrap items-center justify-between gap-2 print:mb-0.5 ${formMode !== "none" ? "print:hidden" : ""}`}>
        <div>
          {/* 제목/조공 인원 글씨는 품목 글씨(25px)의 2배 크기로 표시. */}
          <h2 className="text-lg font-semibold text-slate-900 print:text-[50px]">
            {title}
            {helperCount != null && <span className="ml-2 text-lg font-semibold text-slate-900 print:ml-1.5 print:text-[50px]">조공 {helperCount}</span>}
            {formMode === "kia" && <span className="ml-2 text-sm font-normal text-slate-500 print:text-xs">(화성 반입반출증 양식)</span>}
            {formMode === "donghee" && <span className="ml-2 text-sm font-normal text-slate-500 print:text-xs">(동희 반입반출증 양식)</span>}
            {formMode === "none" && accessPassOnly && (
              <span className="ml-2 text-sm font-normal text-slate-500 print:text-xs">(반입반출증용만)</span>
            )}
          </h2>
          {formMode === "none" && <p className="text-xs text-slate-500 print:text-[8px]">{metaLine}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          {hasAccessPassItems && formMode === "none" && (
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
                checked={formMode === "kia"}
                onChange={(e) => setFormMode(e.target.checked ? "kia" : "none")}
                className="h-3.5 w-3.5"
              />
              화성 반입반출증
            </label>
          )}
          {hasAccessPassItems && (
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={formMode === "donghee"}
                onChange={(e) => setFormMode(e.target.checked ? "donghee" : "none")}
                className="h-3.5 w-3.5"
              />
              동희 반입반출증
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

      {formMode === "kia" ? (
        accessPassItems.length === 0 ? (
          <p className="py-6 text-center text-slate-400">반입반출증용으로 표시된 품목이 없습니다.</p>
        ) : (
          <AccessPassPermitTable items={accessPassItems} />
        )
      ) : formMode === "donghee" ? (
        accessPassItems.length === 0 ? (
          <p className="py-6 text-center text-slate-400">반입반출증용으로 표시된 품목이 없습니다.</p>
        ) : (
          // 동희오토 양식은 원래 A5 규격이라, 인쇄 시 용지를 가로로 돌려 왼쪽/오른쪽에
          // 2장씩 들어가게 배치함(용지 방향 전환은 globals.css의
          // .print-donghee-landscape). 품목이 5개(장당 고정 줄 수)를 넘으면 왼쪽·오른쪽에
          // 서로 다른 품목을 담은 다음 장으로 이어지고, 그래도 남으면 다음 페이지로
          // 계속됨 — 예전처럼 왼쪽·오른쪽에 같은 내용을 복제하지 않음. 오른쪽 자리가
          // 없는 마지막 홀수 장은 비워둠. 가운데 절취선은 화면에서만 보이고 인쇄 시에는
          // 숨김.
          <div className="space-y-4 print:space-y-0">
            {dongheePages.map((page, pageIdx) => (
              <div
                key={pageIdx}
                className={`print-donghee-landscape flex gap-4 print:gap-3 print:break-inside-avoid ${
                  pageIdx < dongheePages.length - 1 ? "print:break-after-page" : ""
                }`}
              >
                <div className="flex-1">
                  <DongheeAccessPassPermitTable items={page[0]} />
                </div>
                <div className="w-px shrink-0 border-l border-dashed border-slate-300 print:hidden" />
                <div className="flex-1 print:break-inside-avoid">
                  {page[1] && <DongheeAccessPassPermitTable items={page[1]} />}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          {/* 인쇄 레이아웃은 품목 12개 안팎(그룹당)을 기준으로 페이지가 꽉 차 보이도록
              여유 있게 잡음 — 실제 품목이 더 많아 넘치면 usePrintFitToPage가 알아서
              1장에 맞게 축소하므로, 적을 때 빈 공간이 남는 문제와 많을 때 넘치는
              문제를 동시에 해결함. */}
          <div className="space-y-4 print:space-y-1">
            {visibleGroups.map((g) => (
              <div key={g.label} className="print:break-inside-avoid">
                <p className="mb-1.5 text-xs font-semibold text-slate-500 print:mb-0.5 print:text-[15px]">{g.label}</p>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 print:grid-cols-5 print:gap-x-[50px] print:gap-y-2">
                  {g.items.map((it) => {
                    const filled = it.quantity.trim() !== "";
                    return (
                      <li
                        key={it.id}
                        className={`flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 print:gap-2 print:rounded-none print:border-0 print:px-0 print:py-1 print:text-[28px] ${filled ? "print:border-b-2 print:border-black" : "print:opacity-50"}`}
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
