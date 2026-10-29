import { groupProjectProfit, sumByProject, type OutlookProject } from "@/lib/projectProfit";
import { receivableOf } from "@/lib/expectedReceivable";

// ── 프로젝트 목록 하단 합계 · 통합 보고서(필터된 프로젝트 전부를 합친 보고서) 공통 계산 ──
// 계산 단위: 목록의 귀속 묶음(어미 + 같이 보이는 귀속 하위)은 한 단위, 아니면 프로젝트 하나. 이익금은 단위마다 손익보고서와
// 같은 기준(groupProjectProfit — 발주액이 없는 단위는 이익금 없음, 그 매입·대행구매는 이익금에 안 들어감), 미수 금액은
// receivableOf(진행중·공사 완료·수금 대기만). 화면마다 따로 더하면 목록 합계와 보고서 숫자가 어긋나서 여기 한 곳에서 계산.

// topOf = 하위 id → 목록에 보이는 묶음 어미 id(프로젝트 목록의 groupTopOf). 단위의 맨 앞은 어미(목록에 없으면 첫 줄).
export function listUnits<P extends { id: string }>(rows: P[], topOf: Map<string, string>): P[][] {
  const units = new Map<string, P[]>();
  for (const p of rows) {
    const key = topOf.get(p.id) ?? p.id;
    units.set(key, [...(units.get(key) ?? []), p]);
  }
  return Array.from(units.entries()).map(([leadId, members]) => {
    const lead = members.find((m) => m.id === leadId) ?? members[0];
    return [lead, ...members.filter((m) => m !== lead)];
  });
}

// 한 단위의 금액 — 발주액·대행구매·매입(공급가)·이익금·이익율·받은 금액(부가세 제외)·미수 금액(받을 금액이 없는 상태이거나
// 발주액이 없으면 null, 화면에는 "-").
export function unitAmounts(
  members: OutlookProject[],
  purchaseByProject: Map<string, number>,
  agencyByProject: Map<string, number>,
  receivedByProject: Map<string, number>
) {
  const g = groupProjectProfit(members, purchaseByProject, agencyByProject);
  const r = receivableOf(members, agencyByProject, receivedByProject);
  return {
    quote: g.quote,
    agency: g.agency,
    purchase: g.purchase,
    profit: g.profit,
    rate: g.rate,
    received: sumByProject(members, receivedByProject),
    receivable: r && r.quote > 0 ? r.amount : null,
  };
}

// 단위들의 합계 — 프로젝트 목록 하단 합계와 통합 보고서 요약이 같은 숫자. 이익율은 발주액 합계 대비(발주액이 없는 단위는
// 발주액도 0이라 분모에 안 들어감). noQuote = 발주액이 없어 이익금에서 빠진 단위 수와 그 매입+대행구매.
export function listTotals(
  units: OutlookProject[][],
  purchaseByProject: Map<string, number>,
  agencyByProject: Map<string, number>,
  receivedByProject: Map<string, number>
) {
  const rows = units.map((u) => unitAmounts(u, purchaseByProject, agencyByProject, receivedByProject));
  const sum = (pick: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + pick(r), 0);
  const quote = sum((r) => r.quote);
  const agency = sum((r) => r.agency);
  const profit = sum((r) => r.profit ?? 0);
  const noQuote = rows.filter((r) => r.profit === null);
  return {
    quote,
    agency,
    // 수주예상액 = 발주액 − 대행구매액
    contractExpected: quote - agency,
    purchase: sum((r) => r.purchase),
    profit,
    rate: quote > 0 ? (profit / quote) * 100 : null,
    received: sum((r) => r.received),
    receivable: sum((r) => r.receivable ?? 0),
    noQuoteCount: noQuote.length,
    noQuoteCost: noQuote.reduce((s, r) => s + r.purchase + r.agency, 0),
  };
}
