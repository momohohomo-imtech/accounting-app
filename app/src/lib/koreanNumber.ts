// 반입반출증 등 공문서에 숫자를 위변조하기 어렵게 적을 때 쓰는 고유어(순우리말) 수사 변환.
const ONES = ["", "하나", "둘", "셋", "넷", "다섯", "여섯", "일곱", "여덟", "아홉"];
const TENS = ["", "열", "스물", "서른", "마흔", "쉰", "예순", "일흔", "여든", "아흔"];

export function koreanNativeNumber(n: number): string {
  if (!Number.isInteger(n) || n <= 0 || n >= 100) return String(n);
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${TENS[tens]}${ONES[ones]}` || String(n);
}

// "# 둘 #" 처럼 숫자를 고유어로 바꾸고 앞뒤에 #을 붙임(위변조 방지 표기).
// 숫자로 못 바꾸는 값(빈칸, 100 이상, 텍스트 등)은 원문 그대로 #으로 감싸고,
// 아예 빈칸이면 아무것도 표시하지 않음.
export function formatPermitQuantity(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const n = Number(trimmed);
  const word = Number.isInteger(n) && n > 0 && n < 100 ? koreanNativeNumber(n) : trimmed;
  return `# ${word} #`;
}
