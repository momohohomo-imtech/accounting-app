// 금액 입력칸의 천 단위 쉼표 — 화면에는 "1,234,567"로 보이고, 저장·계산에는 쉼표 없는 숫자 문자열을 쓴다.

/** 쉼표 없는 숫자 문자열 → 천 단위 쉼표 표시 ("-1234.5" → "-1,234.5"). */
export function formatThousands(raw: string) {
  if (!raw) return "";
  const [intPart, decPart] = raw.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
}

/**
 * 입력칸에 친 글자 → 쉼표 없는 숫자 문자열. 숫자·소수점 외 글자(쉼표 등)는 버리고,
 * 소수점은 첫 번째 하나만 남긴다. allowNegative면 맨 앞 "-"만 살린다.
 */
export function parseNumericInput(display: string, { allowNegative = false, allowDecimal = true } = {}) {
  const negative = allowNegative && display.trim().startsWith("-");
  const cleaned = display.replace(allowDecimal ? /[^\d.]/g : /\D/g, "");
  const firstDot = cleaned.indexOf(".");
  const body = firstDot === -1 ? cleaned : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  return negative ? `-${body}` : body;
}
