"use client";

import { useMemo, useState } from "react";

// 보고서 메뉴의 분기별·월별 매입·매출·손익, 매출처별 집계 표 — 예전엔 정렬이 안 되는 SimpleTable이었음(목록형 표는 헤더
// 클릭 정렬 규칙). 칸마다 보이는 글자(text)와 정렬값(value)을 따로 받음: 금액은 "1,234원" 글자가 아니라 숫자로, 월·분기
// 이름은 순서 번호로 정렬해야 "10월"이 "2월"보다 앞에 오지 않음. 첫 칸은 왼쪽, 나머지 칸은 오른쪽 숫자 칸.
export type SortableCell = { text: string; value: string | number };

export function SortableSimpleTable({
  headers,
  rows,
  empty = "데이터가 없습니다.",
  footer,
  leftCount = 1,
  minWidthClass = "min-w-[600px]",
}: {
  headers: string[];
  rows: SortableCell[][];
  empty?: string;
  /** 합계 줄 — 정렬과 상관없이 늘 맨 아래(세무사 열람 등) */
  footer?: SortableCell[];
  /** 앞에서 몇 칸까지 왼쪽 글자 칸인지(나머지는 오른쪽 숫자 칸) — 기본 첫 칸만 */
  leftCount?: number;
  minWidthClass?: string;
}) {
  const [sortKey, setSortKey] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: number) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // 원래 순서 번호를 key로(정렬해도 같은 줄은 같은 key) — 원본 배열은 그대로 두고 복사본만 정렬
  const sorted = useMemo(() => {
    const copy = rows.map((cells, index) => ({ cells, index }));
    if (sortKey === null) return copy;
    copy.sort((a, b) => {
      const va = a.cells[sortKey]?.value ?? "";
      const vb = b.cells[sortKey]?.value ?? "";
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${minWidthClass} text-sm`}>
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            {headers.map((h, i) => (
              <th key={h} className={`pb-2 pr-4 ${i >= leftCount ? "text-right" : ""}`}>
                <button type="button" onClick={() => handleSort(i)} className="inline-flex items-center gap-1 hover:text-slate-800">
                  {h}
                  {sortKey === i && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ cells, index }) => (
            <tr key={index} className="border-b border-slate-100 last:border-0">
              {cells.map((cell, j) => (
                <td
                  key={j}
                  className={`py-2 pr-4 ${j >= leftCount ? "whitespace-nowrap text-right tabular-nums text-slate-700" : "text-slate-700"}`}
                >
                  {cell.text}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={headers.length} className="py-8 text-center text-slate-400">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
        {footer && rows.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-slate-200 font-semibold">
              {footer.map((cell, j) => (
                <td
                  key={j}
                  className={`py-2 pr-4 ${j >= leftCount ? "whitespace-nowrap text-right tabular-nums text-slate-900" : "text-slate-900"}`}
                >
                  {cell.text}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
