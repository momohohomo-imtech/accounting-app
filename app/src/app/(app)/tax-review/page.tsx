import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAllData, fetchAllRows, fetchAllRowsIn } from "@/lib/supabaseFetchAll";
import { nowKst, nowKstParts } from "@/lib/kstDate";
import { formatWon } from "@/lib/format";
import { YearFilter } from "@/components/YearFilter";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { SortableSimpleTable, type SortableCell } from "@/components/SortableSimpleTable";
import { ReportExcelButton } from "@/components/ReportExcelButton";
import { PrintButton } from "@/components/PrintButton";
import { TaxReviewExcelAll } from "@/components/TaxReviewExcelAll";
import type { XlsxSheet } from "@/lib/xlsxExport";
import {
  categoryExpenseRows,
  clientInvoiceRows,
  creditAsOf,
  creditBalanceRows,
  incomeSummary,
  invoicePeriodRows,
  monthlyRows,
  nonInvoicePurchaseByMethod,
  noticeFor,
  vatPeriodRows,
  type Amounts,
  type CreditPaymentLite,
  type NamedRef,
  type TaxCategory,
  type TaxReviewTx,
} from "@/lib/taxReview";

// 대메뉴 "세무사 열람"(11/26 사용자 요청 "세무사가 볼 수 있는 창 — 회계사가 필요로 할 만한 내용 정리") — 세무사 계정도 열 수 있는 화면
// (미들웨어가 세무사에겐 매입매출 목록과 이 화면만 열어 줌). 세무사 계정이 읽을 수 있는 표로만 — 계산은 lib/taxReview.ts.
// 읽기만(저장·수정 없음). 표마다 엑셀, 위에 전체 엑셀(장마다 표 하나)·인쇄(접힌 칸도 다 나옴).

const TX_SELECT =
  "id, type, trans_date, client_id, client_name_raw, category_id, payment_method_id, payment_type, tax_invoice_issued, payment_group_id, sales_amount, sales_vat, purchase_amount, purchase_vat";

// 화면 칸(글자·정렬값) + 엑셀 값(x — 금액·건수는 숫자, 글자 칸은 글자 그대로)
type Cell = SortableCell & { x: string | number };
const won = (v: number): Cell => ({ text: formatWon(v), value: v, x: v });
const cnt = (v: number): Cell => ({ text: `${v.toLocaleString("ko-KR")}건`, value: v, x: v });
const txt = (v: string, sort: string | number = v): Cell => ({ text: v, value: sort, x: v });
const blank = (): Cell => ({ text: "", value: "", x: "" });
const sumAmounts = (list: Amounts[]): Amounts =>
  list.reduce((a, b) => ({ count: a.count + b.count, supply: a.supply + b.supply, vat: a.vat + b.vat }), { count: 0, supply: 0, vat: 0 });

export default async function TaxReviewPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { year: yearParam } = await searchParams;
  const { year: currentYear, month: currentMonth } = nowKst();
  const today = nowKstParts().date;
  const year = Number(yearParam) || currentYear;
  const asOf = creditAsOf(year, today);
  const supabase = await createClient();

  const [rows, { data: categoryData }, { data: methodData }, { data: clientData }, { data: noticeData }, { data: firstTx }, creditTxs] =
    await Promise.all([
      fetchAllRows<TaxReviewTx>((from, to) =>
        supabase
          .from("transactions")
          .select(TX_SELECT)
          .gte("trans_date", `${year}-01-01`)
          .lte("trans_date", `${year}-12-31`)
          .order("id", { ascending: true })
          .range(from, to)
      ),
      supabase.from("expense_categories").select("id, name, vat_exempt, vat_non_deductible").order("sort_order"),
      supabase.from("payment_methods").select("id, name").order("sort_order"),
      fetchAllData<NamedRef>((from, to) => supabase.from("clients").select("id, name").order("name").order("id").range(from, to)),
      supabase.from("vat_prepayment_notices").select("month, amount").eq("year", year),
      supabase.from("transactions").select("trans_date").order("trans_date", { ascending: true }).limit(1),
      // 외상 잔액은 지난해 외상까지(기준일까지 정산 안 된 것) — 외상 거래만
      fetchAllRows<TaxReviewTx>((from, to) =>
        supabase
          .from("transactions")
          .select(TX_SELECT)
          .eq("payment_type", "credit")
          .lte("trans_date", asOf)
          .order("id", { ascending: true })
          .range(from, to)
      ),
    ]);
  const payments = creditTxs.length
    ? await fetchAllRowsIn<CreditPaymentLite>(
        creditTxs.map((t) => t.id),
        (ids, from, to) =>
          supabase
            .from("credit_payments")
            .select("transaction_id, paid_date, remaining_amount, created_at")
            .in("transaction_id", ids)
            .order("id", { ascending: true })
            .range(from, to)
      )
    : [];

  const categories = (categoryData ?? []) as TaxCategory[];
  const methods = (methodData ?? []) as NamedRef[];
  const clients = clientData ?? [];
  const notices = (noticeData ?? []) as { month: number; amount: number }[];

  const firstYear = Math.min(firstTx?.[0]?.trans_date ? Number(firstTx[0].trans_date.slice(0, 4)) : currentYear, currentYear);
  const years = Array.from({ length: currentYear - firstYear + 1 }, (_, i) => currentYear - i);
  if (!years.includes(year)) years.push(year);
  years.sort((a, b) => b - a);

  // ── 계산 ──
  const vat = vatPeriodRows(rows, categories);
  const vatBy = Object.fromEntries(vat.map((v) => [v.key, v]));
  const quarters = vat.filter((v) => !v.total);
  const invoices = invoicePeriodRows(rows, categories);
  const invoiceQuarters = invoices.filter((v) => !v.total);
  const invoiceYear = invoices.find((v) => v.key === "year")!;
  const methodRows = nonInvoicePurchaseByMethod(rows, categories, methods);
  const salesClients = clientInvoiceRows(rows, categories, clients, "매출");
  const purchaseClients = clientInvoiceRows(rows, categories, clients, "매입");
  const categoryRows = categoryExpenseRows(rows, categories);
  const income = incomeSummary(rows, categories);
  const months = monthlyRows(rows, categories);
  const credit = creditBalanceRows(creditTxs, payments, asOf, clients);
  const receivable = credit.filter((c) => c.side === "외상매출금");
  const payable = credit.filter((c) => c.side === "외상매입금");
  const sumOf = <T,>(list: T[], f: (x: T) => number) => list.reduce((s, x) => s + f(x), 0);

  // ── 표(화면·엑셀 같은 칸) ──
  const vatHeaders = ["기간", "매출 공급가액", "매출세액", "매입 공급가액", "공제 매입세액", "불공제 매입세액", "비과세 매입", "예상 납부(환급)세액"];
  const vatCells = (v: (typeof vat)[number]): Cell[] => [
    txt(v.label, v.order),
    won(v.salesSupply),
    won(v.salesVat),
    won(v.purchaseSupply),
    won(v.deductibleVat),
    won(v.nonDeductibleVat),
    won(v.exemptPurchase),
    won(v.net),
  ];
  const invoiceHeaders = ["기간", "매출 발행 건수", "매출 공급가액", "매출 세액", "매입 수취 건수", "매입 공급가액", "매입 세액"];
  const invoiceCells = (v: (typeof invoices)[number]): Cell[] => [
    txt(v.label, v.order),
    cnt(v.sales.count),
    won(v.sales.supply),
    won(v.sales.vat),
    cnt(v.purchase.count),
    won(v.purchase.supply),
    won(v.purchase.vat),
  ];
  const methodHeaders = ["결제수단", "1기 공급가액", "1기 세액", "2기 공급가액", "2기 세액", "연간 건수"];
  const methodCells = (m: (typeof methodRows)[number]): Cell[] => [
    txt(m.name),
    won(m.h1.supply),
    won(m.h1.vat),
    won(m.h2.supply),
    won(m.h2.vat),
    cnt(m.year.count),
  ];
  const methodTotal = { h1: sumAmounts(methodRows.map((m) => m.h1)), h2: sumAmounts(methodRows.map((m) => m.h2)), year: sumAmounts(methodRows.map((m) => m.year)) };
  const clientHeaders = ["거래처", "1기 건수", "1기 공급가액", "1기 세액", "2기 건수", "2기 공급가액", "2기 세액", "연간 공급가액", "연간 세액"];
  const clientCells = (c: (typeof salesClients)[number]): Cell[] => [
    txt(c.name),
    cnt(c.h1.count),
    won(c.h1.supply),
    won(c.h1.vat),
    cnt(c.h2.count),
    won(c.h2.supply),
    won(c.h2.vat),
    won(c.year.supply),
    won(c.year.vat),
  ];
  const clientFooter = (list: typeof salesClients): Cell[] => {
    const h1 = sumAmounts(list.map((c) => c.h1));
    const h2 = sumAmounts(list.map((c) => c.h2));
    const y = sumAmounts(list.map((c) => c.year));
    return [txt(`합계(${list.length}곳)`), cnt(h1.count), won(h1.supply), won(h1.vat), cnt(h2.count), won(h2.supply), won(h2.vat), won(y.supply), won(y.vat)];
  };
  const categoryHeaders = ["카테고리", "비고", "건수", "합계", "공급가액", "부가세", "비용(소득세 기준)"];
  const categoryCells = (c: (typeof categoryRows)[number]): Cell[] => [
    txt(c.name),
    txt(c.note),
    cnt(c.count),
    won(c.total),
    won(c.supply),
    won(c.vat),
    won(c.cost),
  ];
  const monthHeaders = ["월", "매출 공급가액", "매출세액", "매입 공급가액", "매입세액", "세금계산서 매출 건수", "세금계산서 매입 건수"];
  const monthCells = (m: (typeof months)[number]): Cell[] => [
    txt(`${m.month}월`, m.month),
    won(m.salesSupply),
    won(m.salesVat),
    won(m.purchaseSupply),
    won(m.purchaseVat),
    cnt(m.invoiceSalesCount),
    cnt(m.invoicePurchaseCount),
  ];
  const creditHeaders = ["구분", "거래처", "잔액", "미정산 건수", "가장 오래된 거래일"];
  const creditCells = (c: (typeof credit)[number]): Cell[] => [
    txt(c.side),
    txt(c.name),
    won(c.balance),
    cnt(c.open),
    txt(c.oldest),
  ];

  // 엑셀은 화면 칸 그대로(금액·건수는 숫자로)
  const plain = (cells: Cell[]) => cells.map((c) => c.x);
  const sheets: XlsxSheet[] = [
    { name: "부가세 기간별", headers: vatHeaders, rows: vat.map((v) => plain(vatCells(v))) },
    { name: "세금계산서 기간별", headers: invoiceHeaders, rows: invoices.map((v) => plain(invoiceCells(v))) },
    { name: "세금계산서 없는 매입", headers: methodHeaders, rows: methodRows.map((m) => plain(methodCells(m))) },
    { name: "매출처별 세금계산서", headers: clientHeaders, rows: salesClients.map((c) => plain(clientCells(c))) },
    { name: "매입처별 세금계산서", headers: clientHeaders, rows: purchaseClients.map((c) => plain(clientCells(c))) },
    { name: "카테고리별 경비", headers: categoryHeaders, rows: categoryRows.map((c) => plain(categoryCells(c))) },
    { name: "월별 매출매입", headers: monthHeaders, rows: months.map((m) => plain(monthCells(m))) },
    { name: "외상 잔액", headers: creditHeaders, rows: credit.map((c) => plain(creditCells(c))), leadingRows: [[`기준일 ${asOf}`]] },
  ];
  const sheet = (name: string) => sheets.find((s) => s.name === name)!;
  const excel = (name: string) => {
    const s = sheet(name);
    return <ReportExcelButton filename={`세무사열람_${year}_${name.replace(/\s+/g, "")}.xlsx`} headers={s.headers} rows={s.rows} sheetName={name} />;
  };
  const halfCard = (key: "h1" | "h2", label: string) => {
    const v = vatBy[key];
    const notice = noticeFor(notices, key);
    return (
      <div className="rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm min-[480px]:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">매출세액</dt>
            <dd className="whitespace-nowrap tabular-nums text-slate-900">{formatWon(v.salesVat)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">공제 매입세액</dt>
            <dd className="whitespace-nowrap tabular-nums text-slate-900">{formatWon(v.deductibleVat)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">예상 납부(환급)세액</dt>
            <dd className="whitespace-nowrap font-semibold tabular-nums text-slate-900">{formatWon(v.net)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">{key === "h1" ? "4월" : "10월"} 예정고지액</dt>
            <dd className="whitespace-nowrap tabular-nums text-slate-900">{notice === null ? "입력 없음" : formatWon(notice)}</dd>
          </div>
        </dl>
      </div>
    );
  };

  const filingSeason = currentMonth <= 5 && year === currentYear;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">세무사 열람</h1>
          <p className="text-sm text-slate-500">
            {year}년 세무 신고 자료 — 부가세는 세금계산서(거래일) 기준, 외상 미정산 포함. 금액은 장부에 적은 합계를 부가세 포함으로 보고 나눈
            값입니다(앱의 다른 부가세 계산과 같음).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <YearFilter basePath="/tax-review" years={years} selectedYear={year} />
          <TaxReviewExcelAll filename={`세무사열람_${year}.xlsx`} sheets={sheets} />
          <PrintButton />
        </div>
      </div>

      {filingSeason && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 print:hidden">
          1~5월은 작년 신고 기간입니다(2기 확정 부가세 1월, 종합소득세 5월).{" "}
          <Link href={`/tax-review?year=${currentYear - 1}`} className="font-medium underline underline-offset-2">
            {currentYear - 1}년 자료 보기
          </Link>
        </p>
      )}

      <CollapsibleSection
        title="부가가치세 신고 자료"
        defaultOpen
        printAlways
        headerExtra={<div className="flex flex-wrap items-center gap-2 print:hidden">{excel("부가세 기간별")}</div>}
      >
        <div className="mt-4 space-y-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {halfCard("h1", "1기(1~6월) — 7월 확정신고")}
            {halfCard("h2", "2기(7~12월) — 다음 해 1월 확정신고")}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">분기별</h3>
            <SortableSimpleTable headers={vatHeaders} rows={quarters.map(vatCells)} footer={vatCells({ ...vatBy.year, label: "연간" })} minWidthClass="min-w-[900px]" />
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-700">세금계산서 발행·수취</h3>
              {excel("세금계산서 기간별")}
            </div>
            <SortableSimpleTable
              headers={invoiceHeaders}
              rows={invoiceQuarters.map(invoiceCells)}
              footer={invoiceCells({ ...invoiceYear, label: "연간" })}
              minWidthClass="min-w-[760px]"
            />
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-700">세금계산서 없는 과세 매입 — 결제수단별</h3>
              {excel("세금계산서 없는 매입")}
            </div>
            <p className="mb-2 text-xs text-slate-500">카드 매출전표·현금영수증 등 다른 증빙이 있으면 매입세액 공제 대상 — 증빙 확인용(비과세 카테고리는 뺌).</p>
            <SortableSimpleTable
              headers={methodHeaders}
              rows={methodRows.map(methodCells)}
              footer={[txt("합계"), won(methodTotal.h1.supply), won(methodTotal.h1.vat), won(methodTotal.h2.supply), won(methodTotal.h2.vat), cnt(methodTotal.year.count)]}
              empty="세금계산서 없는 과세 매입이 없습니다."
            />
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            공제 매입세액은 대시보드 부가세와 같은 계산(비과세·불공제 카테고리를 뺀 매입 전부)입니다. 실제 신고에서는 세금계산서·카드 매출전표·
            현금영수증 등 증빙이 있는 매입만 공제됩니다. 불공제 카테고리(승용차 등)는 지출카테고리의 체크로 정합니다.
          </p>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={
          <span>
            거래처별 세금계산서 합계{" "}
            <span className="text-sm font-normal text-slate-500">
              매출처 {salesClients.length}곳 · 매입처 {purchaseClients.length}곳
            </span>
          </span>
        }
        printAlways
        headerExtra={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {excel("매출처별 세금계산서")}
            {excel("매입처별 세금계산서")}
          </div>
        }
      >
        <div className="mt-4 space-y-5">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">매출처별(세금계산서 발행)</h3>
            <SortableSimpleTable
              headers={clientHeaders}
              rows={salesClients.map(clientCells)}
              footer={clientFooter(salesClients)}
              minWidthClass="min-w-[860px]"
              empty="세금계산서 발행 매출이 없습니다."
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">매입처별(세금계산서 수취)</h3>
            <SortableSimpleTable
              headers={clientHeaders}
              rows={purchaseClients.map(clientCells)}
              footer={clientFooter(purchaseClients)}
              minWidthClass="min-w-[860px]"
              empty="세금계산서 수취 매입이 없습니다."
            />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={
          <span>
            카테고리별 매입(경비){" "}
            <span className="text-sm font-normal text-slate-500">비용 {formatWon(income.cost)}</span>
          </span>
        }
        printAlways
        headerExtra={<div className="flex flex-wrap items-center gap-2 print:hidden">{excel("카테고리별 경비")}</div>}
      >
        <div className="mt-4 space-y-3">
          <dl className="grid grid-cols-1 gap-2 text-sm min-[480px]:grid-cols-3">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">매출(공급가액)</dt>
              <dd className="whitespace-nowrap font-semibold tabular-nums text-slate-900">{formatWon(income.sales)}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">경비(소득세 기준 비용)</dt>
              <dd className="whitespace-nowrap font-semibold tabular-nums text-slate-900">{formatWon(income.cost)}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">차액(장부상 이익 참고)</dt>
              <dd className="whitespace-nowrap font-semibold tabular-nums text-slate-900">{formatWon(income.profit)}</dd>
            </div>
          </dl>
          <p className="text-xs text-slate-500">
            비용 = 돌려받는 부가세를 뺀 금액(불공제·비과세 카테고리는 총액). 매입매출장에 적은 거래만 — 장부에 없는 비용(감가상각 등)은 빠짐.
          </p>
          <SortableSimpleTable
            headers={categoryHeaders}
            rows={categoryRows.map(categoryCells)}
            footer={[
              txt("합계"),
              blank(),
              cnt(sumOf(categoryRows, (c) => c.count)),
              won(sumOf(categoryRows, (c) => c.total)),
              won(sumOf(categoryRows, (c) => c.supply)),
              won(sumOf(categoryRows, (c) => c.vat)),
              won(sumOf(categoryRows, (c) => c.cost)),
            ]}
            leftCount={2}
            minWidthClass="min-w-[760px]"
            empty="매입이 없습니다."
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="월별 매출·매입"
        printAlways
        headerExtra={<div className="flex flex-wrap items-center gap-2 print:hidden">{excel("월별 매출매입")}</div>}
      >
        <div className="mt-4">
          <SortableSimpleTable
            headers={monthHeaders}
            rows={months.map(monthCells)}
            footer={[
              txt("합계"),
              won(sumOf(months, (m) => m.salesSupply)),
              won(sumOf(months, (m) => m.salesVat)),
              won(sumOf(months, (m) => m.purchaseSupply)),
              won(sumOf(months, (m) => m.purchaseVat)),
              cnt(sumOf(months, (m) => m.invoiceSalesCount)),
              cnt(sumOf(months, (m) => m.invoicePurchaseCount)),
            ]}
            minWidthClass="min-w-[820px]"
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={
          <span>
            외상 잔액{" "}
            <span className="text-sm font-normal text-slate-500">{asOf} 기준</span>
          </span>
        }
        printAlways
        headerExtra={<div className="flex flex-wrap items-center gap-2 print:hidden">{excel("외상 잔액")}</div>}
      >
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-600">
            외상매출금 <span className="whitespace-nowrap font-semibold tabular-nums text-slate-900">{formatWon(sumOf(receivable, (c) => c.balance))}</span>
            ({receivable.length}곳) · 외상매입금{" "}
            <span className="whitespace-nowrap font-semibold tabular-nums text-slate-900">{formatWon(sumOf(payable, (c) => c.balance))}</span>(
            {payable.length}곳) — 기준일까지의 정산만 반영, 지난해 외상 포함.
          </p>
          <SortableSimpleTable headers={creditHeaders} rows={credit.map(creditCells)} leftCount={2} minWidthClass="min-w-[640px]" empty="남은 외상이 없습니다." />
        </div>
      </CollapsibleSection>
    </div>
  );
}
