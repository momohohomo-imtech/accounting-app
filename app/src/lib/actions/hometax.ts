"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import { one } from "@/lib/relations";
import {
  NEAR_DATE_DAYS,
  reconcileHometax,
  type AppInvoiceTx,
  type HometaxInvoice,
  type InvoiceKind,
  type ReconcileResult,
} from "@/lib/hometaxReconcile";

// 홈택스 세금계산서 대조 — 브라우저에서 읽은 계산서 목록(파일은 밖으로 안 보냄)과 그 기간 매출 또는 매입 거래를 맞춰 봄(읽기만).
// 날짜가 조금 다른 것도 찾도록 기간 앞뒤 45일까지 거래를 읽음. 계산은 lib/hometaxReconcile.ts.
const MAX_INVOICES = 5000;
const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function shiftDays(ymd: string, days: number) {
  const d = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

type TxRow = {
  id: string;
  trans_date: string;
  client_name_raw: string | null;
  item_name: string | null;
  sales_amount: number;
  sales_vat: number;
  purchase_amount: number;
  purchase_vat: number;
  tax_invoice_issued: boolean;
  payment_group_id?: string | null;
  clients: { name: string; biz_reg_no: string | null } | { name: string; biz_reg_no: string | null }[] | null;
};

const BASE_COLUMNS =
  "id, trans_date, client_name_raw, item_name, sales_amount, sales_vat, purchase_amount, purchase_vat, tax_invoice_issued, clients(name, biz_reg_no)";

export async function reconcileHometaxInvoices(input: {
  kind: InvoiceKind;
  invoices: HometaxInvoice[];
  start: string;
  end: string;
}): Promise<{ result?: ReconcileResult; appCount?: number; error?: string }> {
  if (input.kind !== "매출" && input.kind !== "매입") return { error: "매출·매입 중 하나를 골라주세요." };
  if (!isYmd(input.start) || !isYmd(input.end) || input.start > input.end) return { error: "대조할 기간을 확인해주세요." };
  if (!Array.isArray(input.invoices) || input.invoices.length === 0) return { error: "대조할 계산서가 없습니다." };
  if (input.invoices.length > MAX_INVOICES) return { error: `계산서가 너무 많습니다(${MAX_INVOICES.toLocaleString()}장까지).` };

  const supabase = await createClient();
  const from = shiftDays(input.start, -NEAR_DATE_DAYS);
  const to = shiftDays(input.end, NEAR_DATE_DAYS);
  const load = (columns: string) =>
    fetchAllRows<TxRow>((f, t) =>
      supabase
        .from("transactions")
        .select(columns)
        .eq("type", input.kind)
        .gte("trans_date", from)
        .lte("trans_date", to)
        .order("id", { ascending: true })
        .range(f, t)
        .then(({ data, error }) => ({ data: data as TxRow[] | null, error }))
    );
  let rows: TxRow[];
  try {
    rows = await load(`${BASE_COLUMNS}, payment_group_id`);
  } catch {
    // 092 SQL(한 결제로 묶기) 실행 전이면 묶음 칸 없이
    try {
      rows = await load(BASE_COLUMNS);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "거래를 불러오지 못했습니다." };
    }
  }

  const sales = input.kind === "매출";
  const appTxs: AppInvoiceTx[] = rows.map((r) => {
    const client = one(r.clients);
    return {
      id: r.id,
      date: r.trans_date,
      client: client?.name ?? r.client_name_raw ?? "",
      clientBizNo: client?.biz_reg_no ?? "",
      supply: Number(sales ? r.sales_amount : r.purchase_amount) || 0,
      tax: Number(sales ? r.sales_vat : r.purchase_vat) || 0,
      taxInvoice: Boolean(r.tax_invoice_issued),
      groupId: r.payment_group_id ?? null,
      item: r.item_name,
    };
  });
  return {
    result: reconcileHometax(input.invoices, appTxs, { start: input.start, end: input.end }),
    appCount: appTxs.filter((t) => t.date >= input.start && t.date <= input.end).length,
  };
}
