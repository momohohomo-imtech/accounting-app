"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { inlineFieldClass } from "@/components/ui/field";
import { formatWon } from "@/lib/format";
import { reconcileHometaxInvoices } from "@/lib/actions/hometax";
import { parseHometaxSheet, type AppInvoiceTx, type HometaxInvoice, type InvoiceKind, type ReconcileResult } from "@/lib/hometaxReconcile";

// 장부 점검 탭의 "홈택스 세금계산서 대조" — 홈택스에서 받은 전자세금계산서 목록 엑셀을 이 브라우저에서 읽고(파일 자체는 안 올림,
// 읽은 날짜·거래처·금액만 이 앱 서버의 대조 액션으로 — 외부 서비스로는 안 보냄) 그 기간 매출 또는 매입과 맞춰 봄. 찾기만 하고
// 바꾸지 않음(고치는 건 수정 버튼).

function cellText(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text) return o.text;
    if (o.result instanceof Date) return o.result.toISOString().slice(0, 10);
    if (o.result != null) return String(o.result);
    return "";
  }
  return String(v);
}

async function readSheet(file: File): Promise<string[][]> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const table: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    table[rowNumber - 1] = (row.values as unknown[]).slice(1).map(cellText);
  });
  return Array.from(table, (r) => r ?? []);
}

const monthStart = (ymd: string) => `${ymd.slice(0, 7)}-01`;
function monthEnd(ymd: string) {
  const d = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7), 0));
  return d.toISOString().slice(0, 10);
}

type Column<T> = { key: string; label: string; right?: boolean; value: (row: T) => string | number; render?: (row: T) => ReactNode };

function SortableTable<T>({ rows, columns, rowKey }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string }) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  function handleSort(key: string) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, columns, sortKey, sortDir]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            {columns.map((c) => (
              <th key={c.key} className={`pb-2 pr-3 ${c.right ? "text-right" : ""}`}>
                <button type="button" onClick={() => handleSort(c.key)} className="inline-flex items-center gap-1 hover:text-slate-800">
                  {c.label}
                  {sortKey === c.key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={rowKey(r)} className="border-b border-slate-100">
              {columns.map((c) => (
                <td key={c.key} className={`py-2 pr-3 ${c.right ? "whitespace-nowrap text-right tabular-nums" : ""}`}>
                  {c.render ? c.render(r) : c.value(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const clientCell = (name: string) => (
  <span className="text-slate-800 max-md:inline-block max-md:max-w-[10rem] max-md:truncate max-md:align-bottom" title={name}>
    {name || "거래처 없음"}
  </span>
);

export function HometaxReconcilePanel({ year }: { year: number }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [table, setTable] = useState<string[][] | null>(null);
  const [kind, setKind] = useState<InvoiceKind>("매입");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(ReconcileResult & { appCount: number; invoiceCount: number }) | null>(null);

  const parsed = useMemo(() => (table ? parseHometaxSheet(table, kind) : null), [table, kind]);
  const editHref = (id: string) => `/transactions?tab=check&year=${year}&editTx=${id}`;
  const editCell = (t: AppInvoiceTx) => (
    <LinkButton href={editHref(t.id)} variant="secondary" size="xs">
      수정
    </LinkButton>
  );

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    setTable(null);
    setFileName(file.name);
    if (/\.xls$/i.test(file.name)) {
      setError("예전 엑셀 형식(.xls)은 읽을 수 없습니다. 엑셀에서 열어 '다른 이름으로 저장 → Excel 통합 문서(*.xlsx)'로 저장한 뒤 올려 주세요.");
      return;
    }
    setLoading(true);
    try {
      const rows = await readSheet(file);
      const first = parseHometaxSheet(rows, "매입");
      if (first.error) {
        setError(first.error);
        return;
      }
      setTable(rows);
      if (first.detectedKind) setKind(first.detectedKind);
      const dates = first.invoices.map((i) => i.date).sort();
      setStart(monthStart(dates[0]));
      setEnd(monthEnd(dates[dates.length - 1]));
    } catch {
      setError("엑셀 파일을 읽지 못했습니다. 홈택스에서 받은 파일을 엑셀에서 열어 .xlsx로 다시 저장한 뒤 올려 주세요.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReconcile() {
    if (!parsed || parsed.error) return;
    setLoading(true);
    setError(null);
    try {
      const res = await reconcileHometaxInvoices({ kind, invoices: parsed.invoices, start, end });
      if (res.error || !res.result) {
        setError(res.error ?? "대조하지 못했습니다.");
        return;
      }
      setResult({ ...res.result, appCount: res.appCount ?? 0, invoiceCount: parsed.invoices.length });
    } catch {
      setError("대조 중 오류가 발생했습니다. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  const invoiceColumns: Column<HometaxInvoice>[] = [
    { key: "cp", label: "거래처", value: (i) => i.counterparty, render: (i) => clientCell(i.counterparty) },
    { key: "date", label: "작성일자", value: (i) => i.date },
    { key: "supply", label: "공급가액", right: true, value: (i) => i.supply, render: (i) => formatWon(i.supply) },
    { key: "tax", label: "세액", right: true, value: (i) => i.tax, render: (i) => formatWon(i.tax) },
    { key: "total", label: "합계", right: true, value: (i) => i.total, render: (i) => formatWon(i.total) },
    { key: "item", label: "품목", value: (i) => i.item },
    { key: "row", label: "엑셀 줄", right: true, value: (i) => i.row },
  ];
  const txColumns: Column<AppInvoiceTx>[] = [
    { key: "client", label: "거래처", value: (t) => t.client, render: (t) => clientCell(t.client) },
    { key: "date", label: "날짜", value: (t) => t.date },
    { key: "supply", label: "공급가액", right: true, value: (t) => t.supply, render: (t) => formatWon(t.supply) },
    { key: "tax", label: "세액", right: true, value: (t) => t.tax, render: (t) => formatWon(t.tax) },
    { key: "item", label: "품목", value: (t) => t.item ?? "" },
    { key: "edit", label: "관리", right: true, value: () => "", render: editCell },
  ];
  type Mismatch = ReconcileResult["mismatched"][number];
  const mismatchColumns: Column<Mismatch>[] = [
    { key: "cp", label: "거래처", value: (m) => m.invoice.counterparty, render: (m) => clientCell(m.invoice.counterparty) },
    { key: "reason", label: "다른 점", value: (m) => m.reason, render: (m) => <span className="font-medium text-amber-700">{m.reason}</span> },
    { key: "hdate", label: "홈택스 날짜", value: (m) => m.invoice.date },
    { key: "htotal", label: "홈택스 합계", right: true, value: (m) => m.invoice.total, render: (m) => formatWon(m.invoice.total) },
    { key: "adate", label: "앱 날짜", value: (m) => m.tx.date },
    { key: "atotal", label: "앱 합계", right: true, value: (m) => m.tx.supply + m.tx.tax, render: (m) => formatWon(m.tx.supply + m.tx.tax) },
    { key: "edit", label: "관리", right: true, value: () => "", render: (m) => editCell(m.tx) },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        홈택스 → 전자(세금)계산서 → 목록조회에서 받은 엑셀을 올리면 그 기간 매출 또는 매입과 맞춰 봅니다. 파일은 이 브라우저에서
        읽고, 대조에는 날짜·거래처·금액만 씁니다(외부 서비스로는 보내지 않음). 찾기만 하고 바꾸지 않습니다.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".xlsx,.xls"
          className="max-w-full text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
        {loading && <span className="text-sm text-slate-500">읽는 중...</span>}
      </div>
      {parsed && !parsed.error && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-600">
            {fileName} · 계산서 {parsed.invoices.length.toLocaleString()}장
          </span>
          <select value={kind} onChange={(e) => setKind(e.target.value as InvoiceKind)} className={inlineFieldClass}>
            <option value="매입">매입 계산서(받은 것)</option>
            <option value="매출">매출 계산서(발급한 것)</option>
          </select>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={`${inlineFieldClass} w-40`} />
          <span className="text-slate-400">~</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={`${inlineFieldClass} w-40`} />
          <Button type="button" size="sm" onClick={handleReconcile} disabled={loading}>
            대조하기
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            홈택스 계산서 {result.invoiceCount.toLocaleString()}장 · 앱 {kind} {result.appCount.toLocaleString()}건 — 일치{" "}
            <b>{result.matched.length}</b> · 홈택스에만 <b className={result.hometaxOnly.length ? "text-red-600" : ""}>{result.hometaxOnly.length}</b> ·
            앱에만 <b className={result.appOnly.length ? "text-red-600" : ""}>{result.appOnly.length}</b> · 날짜·금액 다름{" "}
            <b className={result.mismatched.length ? "text-amber-700" : ""}>{result.mismatched.length}</b> · 세금계산서 표시 빠짐{" "}
            <b className={result.missingFlag.length ? "text-amber-700" : ""}>{result.missingFlag.length}</b>
          </p>
          {result.hometaxOnly.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold text-slate-900">홈택스에만 있음 — 앱에 안 적었거나 날짜·금액이 많이 다른 계산서</h3>
              <SortableTable rows={result.hometaxOnly} columns={invoiceColumns} rowKey={(i) => `${i.row}`} />
            </section>
          )}
          {result.appOnly.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold text-slate-900">앱에만 있음 — 앱에 세금계산서 발행으로 적었는데 홈택스에 없는 거래</h3>
              <SortableTable rows={result.appOnly} columns={txColumns} rowKey={(t) => t.id} />
            </section>
          )}
          {result.mismatched.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold text-slate-900">날짜·금액 다름 — 거래처는 같은데 날짜나 금액이 다른 것</h3>
              <SortableTable rows={result.mismatched} columns={mismatchColumns} rowKey={(m) => `${m.invoice.row}-${m.tx.id}`} />
            </section>
          )}
          {result.missingFlag.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold text-slate-900">세금계산서 표시 빠짐 — 홈택스와 맞는데 앱 거래에 세금계산서 발행 체크가 없음</h3>
              <SortableTable rows={result.missingFlag} columns={txColumns} rowKey={(t) => t.id} />
            </section>
          )}
          {result.hometaxOnly.length + result.appOnly.length + result.mismatched.length + result.missingFlag.length === 0 && (
            <p className="text-sm font-medium text-emerald-700">모두 일치합니다.</p>
          )}
        </div>
      )}
    </div>
  );
}
