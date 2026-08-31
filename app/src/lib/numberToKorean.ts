const DIGITS = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const SMALL_UNITS = ["", "십", "백", "천"];
const BIG_UNITS = ["", "만", "억", "조", "경"];

function convertGroup(n: number): string {
  let result = "";
  let unitIndex = 0;
  while (n > 0) {
    const digit = n % 10;
    if (digit > 0) {
      result = (digit === 1 && unitIndex > 0 ? "" : DIGITS[digit]) + SMALL_UNITS[unitIndex] + result;
    }
    n = Math.floor(n / 10);
    unitIndex++;
  }
  return result;
}

/** 정수를 한글 숫자 표기로 변환 (예: 4180000 -> "사백십팔만"). */
export function numberToKorean(amount: number): string {
  const num = Math.round(Math.abs(amount));
  if (num === 0) return "영";

  let result = "";
  let groupIndex = 0;
  let n = num;
  while (n > 0) {
    const group = n % 10000;
    if (group > 0) {
      result = convertGroup(group) + BIG_UNITS[groupIndex] + result;
    }
    n = Math.floor(n / 10000);
    groupIndex++;
  }
  return result;
}

/** 견적서 등 인쇄물에 쓰는 "일금 ...원정" 형식. */
export function numberToKoreanAmount(amount: number): string {
  return `일금 ${numberToKorean(amount)}원정`;
}
