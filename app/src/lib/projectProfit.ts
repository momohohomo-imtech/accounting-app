type ProjectAmountRow = { id: string; quote_amount: number | null };

// 프로젝트 하나 + 귀속 하위 프로젝트들을 합친 이익 — 손익보고서(ProjectProfitReport)와 같은 기준.
// 이익금 = 발주액 합계 − 매입(공급가) 합계 − 대행구매 합계, 이익율은 발주액 대비. 발주액이 없으면 null.
export function groupProjectProfit(
  group: ProjectAmountRow[],
  purchaseByProject: Map<string, number>,
  agencyByProject: Map<string, number>
) {
  const quote = group.reduce((s, p) => s + (p.quote_amount ?? 0), 0);
  const purchase = group.reduce((s, p) => s + (purchaseByProject.get(p.id) ?? 0), 0);
  const agency = group.reduce((s, p) => s + (agencyByProject.get(p.id) ?? 0), 0);
  const profit = quote ? quote - purchase - agency : null;
  const rate = quote && profit !== null ? (profit / quote) * 100 : null;
  return { quote, purchase, agency, profit, rate };
}

// 여러 프로젝트의 이익 총합 — 발주액이 없는 프로젝트(귀속 하위·미정리·검토중 등)의 매입·대행구매도
// 실제로 나간 돈이라 빠짐없이 뺀다.
export function totalProjectProfit(
  projects: ProjectAmountRow[],
  purchaseByProject: Map<string, number>,
  agencyByProject: Map<string, number>
) {
  return projects.reduce(
    (s, p) => s + (p.quote_amount ?? 0) - (purchaseByProject.get(p.id) ?? 0) - (agencyByProject.get(p.id) ?? 0),
    0
  );
}
