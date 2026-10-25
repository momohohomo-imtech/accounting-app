import type { createClient } from "@/lib/supabase/server";
import type { Transaction } from "@/lib/types";

// 한 결제로 묶기(092 SQL) — 카드 결제 한 번(영수증·계산서 1건)을 프로젝트별로 나눠 저장한 거래들은 같은
// payment_group_id를 갖는다. 저장·계산(프로젝트 손익·보고서·부가세)은 거래(줄)마다 그대로 하고, 매입장 화면·엑셀에서만
// 한 줄로 묶어 보여 준다.

type GroupableRow = { id: string; payment_group_id?: string | null };

// 매입장 목록을 화면 줄 단위로 묶음 — 같은 묶음의 거래는 처음 나온 자리에 한 덩어리로(목록 순서 유지).
// 화면에 한 줄만 보이는 묶음(프로젝트 필터 등으로 일부만 조회됨)은 그냥 한 줄로 둔다.
export function groupLedgerRows<T extends GroupableRow>(rows: T[]) {
  const byGroup = new Map<string, T[]>();
  for (const r of rows) {
    if (!r.payment_group_id) continue;
    const list = byGroup.get(r.payment_group_id);
    if (list) list.push(r);
    else byGroup.set(r.payment_group_id, [r]);
  }
  const items: { key: string; groupId: string | null; lines: T[] }[] = [];
  const placed = new Set<string>();
  for (const r of rows) {
    const lines = r.payment_group_id ? byGroup.get(r.payment_group_id)! : [r];
    if (lines.length < 2) {
      items.push({ key: r.id, groupId: null, lines: [r] });
      continue;
    }
    if (placed.has(r.payment_group_id!)) continue;
    placed.add(r.payment_group_id!);
    items.push({ key: `group:${r.payment_group_id}`, groupId: r.payment_group_id!, lines });
  }
  return items;
}

// 묶음 안의 줄 순서(펼친 줄·묶음 수정 화면) — 프로젝트 이름, 그다음 품목 이름 순(일반경비는 맨 뒤).
export function sortGroupLines<T extends { item_name: string | null; projects?: { name: string } | null }>(lines: T[]) {
  const projectKey = (l: T) => l.projects?.name ?? "￿";
  return [...lines].sort(
    (a, b) => projectKey(a).localeCompare(projectKey(b), "ko") || (a.item_name ?? "").localeCompare(b.item_name ?? "", "ko")
  );
}

// 묶음 한 줄에 보일 이름 — 하나뿐이면 그 이름, 여럿이면 "A 외 1곳"(같은 이름은 한 번만 셈). "외 1곳"은 줄이 바뀌어도
// 떨어지지 않게 붙는 공백으로.
export function summaryLabel(names: string[], unit: string) {
  const distinct = Array.from(new Set(names));
  if (distinct.length <= 1) return distinct[0] ?? "";
  return `${distinct[0]} 외\u00a0${distinct.length - 1}${unit}`;
}

// 등록 화면에서 모든 줄이 같이 쓰는 칸(프로젝트·품목·수량·단가·금액만 줄마다 다름).
const GROUP_COMMON_FIELDS = [
  "trans_date",
  "type",
  "client_id",
  "client_name_raw",
  "category_id",
  "payment_method_id",
  "payment_type",
  "tax_invoice_issued",
  "vat_included",
  "needs_classification",
  "note1",
  "note2",
] as const;

// 묶음 전체 수정은 공통 칸이 모든 줄에서 같을 때만 — 다르면 한꺼번에 저장할 때 한 값으로 덮어써서 원래 값이
// 바뀌므로 그 줄만 수정한다.
export function sameCommonFields(lines: Pick<Transaction, (typeof GROUP_COMMON_FIELDS)[number]>[]) {
  return lines.every((l) => GROUP_COMMON_FIELDS.every((f) => (l[f] ?? null) === (lines[0][f] ?? null)));
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

// 092 SQL 실행 전에는 칸이 없어서 묶기 체크·버튼을 숨긴다 — 실행 전에도 화면·등록이 깨지지 않게.
export async function paymentGroupReady(supabase: Supabase) {
  const { error } = await supabase.from("transactions").select("payment_group_id").limit(1);
  return !error;
}

// 수정 화면용 — 이 거래가 한 결제로 묶여 있으면 묶음의 모든 줄을 불러옴. 공통 칸이 줄마다 같으면 묶음 전체 수정(group),
// 다르면 이 줄만 수정(partOfGroup). 묶음은 몇 줄뿐이라 그냥 조회.
export async function loadPaymentGroupForEdit(supabase: Supabase, tx: Transaction) {
  if (!tx.payment_group_id) return { group: undefined, partOfGroup: false };
  const { data } = await supabase
    .from("transactions")
    .select("*, projects(name)")
    .eq("payment_group_id", tx.payment_group_id);
  const lines = sortGroupLines((data ?? []) as Transaction[]);
  if (lines.length < 2) return { group: undefined, partOfGroup: false };
  return sameCommonFields(lines) ? { group: lines, partOfGroup: false } : { group: undefined, partOfGroup: true };
}
