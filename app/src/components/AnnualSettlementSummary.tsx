import { formatWon } from "@/lib/format";

type SiteRow = { name: string; sales: number; purchase: number; profit: number };
type VendorRow = { name: string; count: number; amount: number };
type CategoryRow = { name: string; count: number; amount: number; color?: string };

const TOP_N = 15;

// 연간 결산 요약 — 프로젝트 전체를 한 장(A4 세로)에서 훑어보기 위한 압축 인쇄용 보고서.
// 현장별 손익 / 거래처별 매입 총액 / 카테고리별 매입 집계를 각각 상위 항목만 잘라서
// 보여준다(전체 목록은 같은 페이지의 해당 섹션에서 확인). 세로 용지 안에서 가로
// 방향으로 바꾸면(과거 동희 서식에서) 빈 페이지가 끼는 크롬 버그가 있어 굳이
// 가로 전환은 시도하지 않고, 필요하면 인쇄 대화상자에서 직접 가로를 고르면 됨.
export function AnnualSettlementSummary({
  year,
  totalSales,
  totalPurchase,
  projectCount,
  bySite,
  byVendor,
  byCategory,
}: {
  year: number;
  totalSales: number;
  totalPurchase: number;
  projectCount: number;
  bySite: SiteRow[];
  byVendor: VendorRow[];
  byCategory: CategoryRow[];
}) {
  const netProfit = totalSales - totalPurchase;
  const topSites = bySite.slice(0, TOP_N);
  const topVendors = byVendor.slice(0, TOP_N);
  const topCategories = byCategory.slice(0, TOP_N);

  return (
    <div className="space-y-4 print:break-inside-avoid">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4 print:gap-2">
        <Stat label={`${year}년 총 매출`} value={formatWon(totalSales)} />
        <Stat label={`${year}년 총 매입`} value={formatWon(totalPurchase)} />
        <Stat label="순손익" value={formatWon(netProfit)} negative={netProfit < 0} />
        <Stat label="프로젝트 수" value={`${projectCount}건`} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 print:grid-cols-2 print:gap-3">
        <MiniTable
          title={`현장별 손익 (상위 ${TOP_N})`}
          headers={["현장", "매출", "매입", "손익"]}
          rows={topSites.map((s) => [s.name, formatWon(s.sales), formatWon(s.purchase), formatWon(s.profit)])}
        />
        <MiniTable
          title={`거래처별 매입 총액 (상위 ${TOP_N})`}
          headers={["거래처", "건수", "매입 합계"]}
          rows={topVendors.map((v) => [v.name, `${v.count}건`, formatWon(v.amount)])}
        />
      </div>

      <MiniTable
        title={`카테고리별 매입 집계 (상위 ${TOP_N})`}
        headers={["카테고리", "건수", "매입 합계"]}
        rows={topCategories.map((c) => [c.name, `${c.count}건`, formatWon(c.amount)])}
        colored={topCategories.map((c) => c.color)}
      />
    </div>
  );
}

function Stat({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 print:rounded-none print:border-slate-300 print:p-2">
      <p className="text-xs text-slate-500 print:text-[9px]">{label}</p>
      <p className={`mt-1 font-mono text-xl font-bold print:text-sm ${negative ? "text-red-600" : "text-slate-900"}`}>
        {value}
      </p>
    </div>
  );
}

function MiniTable({
  title,
  headers,
  rows,
  colored,
}: {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  colored?: (string | undefined)[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 print:rounded-none print:border-slate-300 print:p-2">
      <h3 className="mb-1.5 text-xs font-semibold text-slate-700 print:text-[10px]">{title}</h3>
      <table className="w-full text-xs print:text-[9px]">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            {headers.map((h, i) => (
              <th key={h} className={`pb-1 pr-2 print:pb-0.5 ${i > 0 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0">
              {r.map((cell, j) => (
                <td
                  key={j}
                  className={`truncate py-1 pr-2 print:py-0.5 ${j > 0 ? "text-right font-mono text-slate-900" : "text-slate-700"}`}
                  style={j === 0 && colored?.[i] ? { color: colored[i] } : undefined}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={headers.length} className="py-3 text-center text-slate-400">
                데이터가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
