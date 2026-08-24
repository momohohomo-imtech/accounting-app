"use client";

import { useMemo, useState } from "react";
import { formatWon, formatDate } from "@/lib/format";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/field";
import { downloadXlsx } from "@/lib/xlsxExport";

export type VendorHistoryItem = {
  id: string;
  trans_date: string;
  item_name: string | null;
  project_name: string | null;
  amount: number;
  status: "미정산" | "즉시결제" | "정산완료" | "정산 합계";
  methodName: string | null;
};
export type VendorHistoryGroup = {
  key: string;
  label: string;
  items: VendorHistoryItem[];
};

const STATUS_VARIANT = {
  미정산: "amber",
  즉시결제: "slate",
  정산완료: "emerald",
  "정산 합계": "blue",
} as const;

export function CreditHistoryToggle({ groups }: { groups: VendorHistoryGroup[] }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState("all");
  const [month, setMonth] = useState("all");

  const years = useMemo(
    () =>
      Array.from(new Set(groups.flatMap((g) => g.items.map((it) => it.trans_date.slice(0, 4))))).sort((a, b) =>
        b.localeCompare(a)
      ),
    [groups]
  );

  const filtered = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          items: g.items.filter((it) => {
            if (year !== "all" && it.trans_date.slice(0, 4) !== year) return false;
            if (month !== "all" && it.trans_date.slice(5, 7) !== month) return false;
            return true;
          }),
        }))
        .filter((g) => g.items.length > 0),
    [groups, year, month]
  );

  async function handleExport() {
    const rows: (string | number)[][] = [];
    for (const g of filtered) {
      for (const it of g.items) {
        rows.push([it.status, g.label, formatDate(it.trans_date), it.project_name ?? "일반경비", it.item_name ?? "-", it.methodName ?? "", it.amount]);
      }
    }
    const label = year === "all" ? "전체" : month === "all" ? `${year}년` : `${year}-${month}`;
    await downloadXlsx(
      `외상이력_${label}.xlsx`,
      ["상태", "거래처", "날짜", "프로젝트", "품목", "결제수단", "금액"],
      rows,
      "외상이력"
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-900"
        >
          {open ? "거래처별 이력 숨기기" : "거래처별 이력 보기"}
        </button>
        {open && (
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <select value={year} onChange={(e) => setYear(e.target.value)} className={fieldClass}>
              <option value="all">전체 연도</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className={fieldClass}>
              <option value="all">전체 월</option>
              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => (
                <option key={m} value={m}>
                  {Number(m)}월
                </option>
              ))}
            </select>
            <Button variant="secondary" size="sm" onClick={handleExport}>
              필터 결과 엑셀 다운로드
            </Button>
          </div>
        )}
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          {filtered.map((g) => {
            const total = g.items.reduce((s, it) => s + it.amount, 0);
            return (
              <Card key={g.key}>
                <CardHeader>
                  <CardTitle>{g.label}</CardTitle>
                  <span className="text-sm text-slate-500">
                    {g.items.length}건 · 합계 <span className="font-semibold text-slate-900">{formatWon(total)}</span>
                  </span>
                </CardHeader>
                <ul className="divide-y divide-slate-100">
                  {g.items.map((it) => (
                    <li key={it.id} className="flex items-center gap-3 py-2 text-sm">
                      <span className="w-24 shrink-0 text-slate-500">{formatDate(it.trans_date)}</span>
                      <Badge variant={STATUS_VARIANT[it.status]} className="w-16 shrink-0 justify-center">
                        {it.status}
                      </Badge>
                      <span className="w-28 shrink-0 truncate text-slate-500">{it.project_name ?? "일반경비"}</span>
                      <span className="flex-1 truncate text-slate-700">{it.item_name ?? "-"}</span>
                      <span className="w-20 shrink-0 truncate text-right text-slate-400">{it.methodName ?? ""}</span>
                      <span className="w-28 shrink-0 text-right font-medium text-slate-900">{formatWon(it.amount)}</span>
                      <LinkButton href={`/transactions/${it.id}/edit`} variant="secondary" size="xs" className="print:hidden">
                        수정
                      </LinkButton>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
          {filtered.length === 0 && <p className="py-4 text-center text-sm text-slate-400">이력이 없습니다.</p>}
        </div>
      )}
    </div>
  );
}
