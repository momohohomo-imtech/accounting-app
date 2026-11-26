"use client";

import { useRouter } from "next/navigation";
import { formatWon } from "@/lib/format";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { closePopup } from "@/lib/popupNavigation";
import { PopupCloseLink } from "@/components/PopupCloseLink";
import { PrintButton } from "@/components/PrintButton";
import { SortableSimpleTable, type SortableCell } from "@/components/SortableSimpleTable";
import { downloadXlsx } from "@/lib/xlsxExport";
import { memoFileName } from "@/lib/memoExport";

// 세무사 열람 "매입처별 정리"에서 매입처 이름을 누르면 여는 상세 팝업(11/26 사용자 요청) — 주소(?vendor=)로 열고, 닫기·ESC는
// 뒤로가기 기록을 쌓지 않음(closePopup). 읽기만(수정 링크 없음 — 세무사 계정도 씀). 칸·합계는 서버(lib/taxReview.ts)가 만들어 넘김.
export type VendorPopupCell = SortableCell & { x: string | number };

export function TaxReviewVendorPopup({
  vendor,
  year,
  closeHref,
  headers,
  rows,
  footer,
  summary,
}: {
  vendor: string;
  year: number;
  closeHref: string;
  headers: string[];
  rows: VendorPopupCell[][];
  footer: VendorPopupCell[];
  summary: { count: number; lines: number; total: number; invoiceTotal: number; otherTotal: number };
}) {
  const router = useRouter();
  useEscapeKey(true, () => closePopup(router, closeHref));

  const items: [string, string][] = [
    ["거래", `${summary.count.toLocaleString("ko-KR")}건`],
    ["합계(부가세 포함)", formatWon(summary.total)],
    ["세금계산서 수취", formatWon(summary.invoiceTotal)],
    ["세금계산서 없음", formatWon(summary.otherTotal)],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="min-w-0 text-lg font-semibold text-slate-900">
          {vendor} 매입 내역 <span className="tabular-nums text-sm font-normal text-slate-400">{year}년</span>
        </h2>
        <div className="flex items-center gap-2 print:hidden">
          {rows.length > 0 && (
            <button
              type="button"
              onClick={() =>
                downloadXlsx(
                  memoFileName(["세무사열람", String(year), "매입처", vendor]),
                  headers,
                  rows.map((cells) => cells.map((c) => c.x)),
                  "매입처 상세",
                  [[`매입처 ${vendor}`, `${year}년`]]
                )
              }
              className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
            >
              엑셀
            </button>
          )}
          {rows.length > 0 && <PrintButton />}
          <PopupCloseLink href={closeHref} className="text-sm text-slate-500 hover:text-slate-800">
            닫기
          </PopupCloseLink>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">이 매입처의 {year}년 매입이 없습니다.</p>
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-2 text-sm min-[480px]:grid-cols-2 lg:grid-cols-4">
            {items.map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="whitespace-nowrap font-semibold tabular-nums text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-slate-500">
            공급가액·부가세는 장부 금액을 부가세 포함으로 보고 나눈 값(비과세 카테고리는 부가세 없음, 불공제는 매입세액 공제 안 됨).
            {summary.lines > summary.count && " 한 결제로 묶은 줄은 줄마다 보이고 건수는 한 건으로 셉니다."}
          </p>
          <SortableSimpleTable headers={headers} rows={rows} footer={footer} leftCount={5} stickyCol={1} minWidthClass="min-w-[820px]" />
        </>
      )}
    </div>
  );
}
