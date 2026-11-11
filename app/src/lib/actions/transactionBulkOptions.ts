"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchAllData, fetchAllRawClientNames } from "@/lib/supabaseFetchAll";
import { one } from "@/lib/relations";
import type { TransactionBulkOptions } from "@/lib/transactionBulkEdit";

// 보고서 내역 표의 일괄 변경 칸(11/11)이 처음 열릴 때 부르는 선택 목록 — 보고서 화면을 열 때마다 미리 읽지 않게(체크했을 때만).
// 매입매출장은 화면에 이미 있는 목록을 그대로 씀. 조회만 함(바꾸는 건 lib/actions/transactions.ts의 bulkUpdate*).
export async function loadTransactionBulkOptions(): Promise<{ options?: TransactionBulkOptions; error?: string }> {
  try {
    const supabase = await createClient();
    const [{ data: clients }, { data: projects }, payment, category, { data: rawRows }] = await Promise.all([
      fetchAllData<{ id: string; name: string }>((from, to) =>
        supabase.from("clients").select("id, name").order("name").order("id").range(from, to)
      ),
      fetchAllData<{ id: string; name: string; year: number; site_id: string; sites: unknown }>((from, to) =>
        supabase
          .from("projects")
          .select("id, name, year, site_id, sites(name, clients(name))")
          .order("name")
          .order("id")
          .range(from, to)
      ),
      supabase.from("payment_methods").select("id, name, text_color, background_color").order("sort_order"),
      supabase.from("expense_categories").select("id, name").order("sort_order"),
      fetchAllRawClientNames(supabase),
    ]);
    if (payment.error) return { error: payment.error.message };
    if (category.error) return { error: category.error.message };

    const projectNodes = (projects ?? []).map((p) => {
      const site = one(p.sites) as { name: string; clients?: unknown } | undefined;
      const client = one(site?.clients) as { name: string } | undefined;
      return {
        id: p.id,
        name: p.name,
        year: p.year,
        siteId: p.site_id,
        siteName: site?.name ?? "미지정",
        clientName: client?.name ?? null,
      };
    });
    const rawClientNames = Array.from(
      new Set((rawRows ?? []).map((r) => r.client_name_raw).filter((n): n is string => Boolean(n)))
    );

    return {
      options: {
        clients: clients ?? [],
        categories: (category.data ?? []) as { id: string; name: string }[],
        paymentMethods: (payment.data ?? []) as TransactionBulkOptions["paymentMethods"],
        projectNodes,
        rawClientNames,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "선택 목록을 불러오지 못했습니다." };
  }
}
