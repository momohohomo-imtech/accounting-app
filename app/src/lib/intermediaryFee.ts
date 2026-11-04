// 중간 업체 수수료 — 원청 발주를 중간 업체(현대기계)가 받아 발주액의 20%를 가져가고 구매대행도 그 업체가 하는 계약 구조(11/4 사용자
// 설명, 내후년부터는 원청과 직접 계약 예정). 사용자는 대행구매 목록에 거래처 "현대기계"·카테고리 "현대"로 발주액의 20%를 한 줄 넣어
// 공제로 씀 — 프로젝트 보고서 대행구매 목록의 "+ 현대 수수료 20% 추가" 버튼이 그 줄을 만들어 줌(DB 변경 없음). 버튼의 이름(품목·거래처·
// 카테고리)과 비율은 사용자가 바꿀 수 있음(11/4 요청 "이름변경과 값변경") — 이 기기(브라우저)에 저장(FEE_SETTINGS_STORAGE_KEY).
// 검사: intermediaryFee.test.ts.
export type IntermediaryFeeSettings = {
  /** 품목 이름 앞부분 — 줄 품목은 "이름 비율%"(예: "현대 수수료 20%") */
  itemName: string;
  clientName: string;
  /** 카테고리 이름(없는 이름이면 미분류로 들어감) */
  categoryName: string;
  /** 발주액에 곱하는 비율(%) — 0 초과 100 이하 */
  pct: number;
};

export const DEFAULT_INTERMEDIARY_FEE: IntermediaryFeeSettings = {
  itemName: "현대 수수료",
  clientName: "현대기계",
  categoryName: "현대",
  pct: 20,
};

export const FEE_SETTINGS_STORAGE_KEY = "intermediary-fee-settings-v1";

/** 줄에 들어가는 품목 이름("현대 수수료 20%") — 비율은 소수 둘째 자리까지 */
export function feeItemLabel(s: IntermediaryFeeSettings) {
  return `${s.itemName} ${Number(s.pct.toFixed(2))}%`;
}

/** 비율이 쓸 수 있는 값인지(0 초과 100 이하) */
export function validFeePct(pct: number) {
  return Number.isFinite(pct) && pct > 0 && pct <= 100;
}

/** 비율을 소수 둘째 자리로(버튼 이름에 보이는 비율과 계산에 쓰는 비율이 같게) */
export function roundFeePct(pct: number) {
  return Math.round(pct * 100) / 100;
}

/** 저장된 설정 읽기 — 깨졌거나 빈 칸은 기본값으로(이름은 앞뒤 공백 제거, 비율은 0 초과 100 이하만).
 * 카테고리는 빈 글자로 저장했으면 미분류 그대로(칸이 없을 때만 기본값) */
export function parseFeeSettings(raw: string | null | undefined): IntermediaryFeeSettings {
  if (!raw) return { ...DEFAULT_INTERMEDIARY_FEE };
  let parsed: Partial<Record<keyof IntermediaryFeeSettings, unknown>>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_INTERMEDIARY_FEE };
  }
  if (!parsed || typeof parsed !== "object") return { ...DEFAULT_INTERMEDIARY_FEE };
  const text = (v: unknown, fallback: string) => (typeof v === "string" && v.trim() ? v.trim() : fallback);
  const pct = roundFeePct(Number(parsed.pct));
  return {
    itemName: text(parsed.itemName, DEFAULT_INTERMEDIARY_FEE.itemName),
    clientName: text(parsed.clientName, DEFAULT_INTERMEDIARY_FEE.clientName),
    categoryName: typeof parsed.categoryName === "string" ? parsed.categoryName.trim() : DEFAULT_INTERMEDIARY_FEE.categoryName,
    pct: validFeePct(pct) ? pct : DEFAULT_INTERMEDIARY_FEE.pct,
  };
}

/** 발주액의 수수료(원 단위 반올림) — 발주액이 없으면 0 */
export function intermediaryFeeAmount(quote: number | null | undefined, pct: number = DEFAULT_INTERMEDIARY_FEE.pct) {
  return Math.round(((Number(quote) || 0) * pct) / 100);
}

/** 이미 있는 수수료 줄 — 거래처가 설정의 거래처를 포함하고, 품목이 설정의 품목 이름으로 시작하거나 "수수료"가 들어간 대행구매 줄
 * (버튼으로 만든 줄 포함, 같은 거래처의 구매대행 자재 줄은 아님) */
export function intermediaryFeeRows<T extends { client_name: string | null; item_name: string | null }>(
  items: T[],
  settings: IntermediaryFeeSettings = DEFAULT_INTERMEDIARY_FEE
) {
  return items.filter((i) => {
    const client = i.client_name ?? "";
    const item = i.item_name ?? "";
    return client.includes(settings.clientName) && (item.startsWith(settings.itemName) || item.includes("수수료"));
  });
}

/** 수수료 줄 품목 이름에 적힌 비율(마지막 "N%", 예: "현대 수수료 20%" → 20) — 없거나 쓸 수 없는 값이면 null */
export function feeRowPct(itemName: string | null | undefined) {
  const found = [...(itemName ?? "").matchAll(/(\d+(?:\.\d+)?)\s*%/g)];
  if (found.length === 0) return null;
  const pct = Number(found[found.length - 1][1]);
  return validFeePct(pct) ? pct : null;
}

/** 수수료 줄이 지금 발주액과 맞는지 — 줄 품목 이름에 적힌 비율(없으면 설정 비율)로 계산한 금액과 비교. 비율을 바꾼 뒤에도 예전 비율로
 * 넣은 줄은 그 비율로 확인(예전 프로젝트에 알림이 뜨지 않게). 발주액이 없으면 확인하지 않음(null) */
export function feeRowCheck(row: { item_name: string | null; amount: number }, quote: number | null | undefined, settingsPct: number) {
  const pct = feeRowPct(row.item_name) ?? settingsPct;
  const expected = intermediaryFeeAmount(quote, pct);
  if (expected <= 0) return null;
  return { pct, expected, matches: Number(row.amount) === expected };
}
