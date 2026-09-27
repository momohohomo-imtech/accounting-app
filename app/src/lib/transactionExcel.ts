// 엑셀 거래 일괄 등록 — 표(행 × 칸 글자)를 거래 행으로 바꾼다. 예전엔 제미나이가 표를 읽었지만 사용자 요청으로
// 제미나이는 영수증·급여대장 인식에만 남기고, 여기서는 첫 줄 머리글 이름으로 칸을 찾는다. 머리글이 없으면 정해진
// 양식 순서(TEMPLATE_ORDER)로 읽는다. 결과 모양은 예전 AI 응답과 같아서 화면 쪽은 그대로 쓴다.

export type ExcelTransactionRow = {
  trans_date: string;
  type: "매입" | "매출";
  client_name: string;
  project_name: string;
  item_name: string;
  category_name: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
  payment_method_name: string;
  payment_type: "immediate" | "credit";
  tax_invoice_issued: boolean;
  note1: string;
  note2: string;
};

type Field = keyof ExcelTransactionRow;

// 정해진 양식의 칸 순서 — 머리글 줄이 없을 때만 씀.
export const TEMPLATE_ORDER: Field[] = [
  "trans_date",
  "type",
  "client_name",
  "project_name",
  "item_name",
  "category_name",
  "quantity",
  "unit_price",
  "amount",
  "payment_method_name",
  "payment_type",
  "tax_invoice_issued",
  "note1",
  "note2",
];

// 머리글 이름(띄어쓰기·괄호 설명은 빼고 비교) → 칸. 한 칸에 해당하는 머리글이 여럿이면 목록 앞쪽 이름을 우선
// (예: "금액"(공급가)과 "합계"가 둘 다 있으면 총금액인 "합계").
const HEADER_ALIASES: [Field, string[]][] = [
  ["trans_date", ["날짜", "일자", "거래일", "거래일자", "작성일자", "발행일"]],
  ["type", ["구분", "매입매출", "매입/매출", "거래구분"]],
  ["client_name", ["거래처명", "거래처", "상호", "업체명", "업체"]],
  ["project_name", ["프로젝트명", "프로젝트", "현장", "현장명", "공사명"]],
  ["item_name", ["품목", "품명", "품목명", "내용", "적요"]],
  ["category_name", ["종류구분", "카테고리", "분류", "종류"]],
  ["quantity", ["수량"]],
  ["unit_price", ["단가"]],
  ["amount", ["총금액", "합계금액", "합계", "총액", "금액"]],
  ["payment_method_name", ["결제수단", "결제방법"]],
  ["payment_type", ["결제시점", "결제구분", "결제방식"]],
  ["tax_invoice_issued", ["세금계산서발행", "세금계산서", "계산서발행", "계산서"]],
  ["note1", ["메모1", "메모", "비고1", "비고"]],
  ["note2", ["메모2", "비고2"]],
];

function normalizeHeader(text: string) {
  return text.replace(/\(.*?\)/g, "").replace(/\s+/g, "");
}

const ALIAS_RANK = new Map<string, { field: Field; rank: number }>();
for (const [field, names] of HEADER_ALIASES) {
  names.forEach((name, rank) => ALIAS_RANK.set(normalizeHeader(name), { field, rank }));
}

// 머리글 줄이면 필드 → 칸 번호, 아니면 null. 알아보는 머리글이 3개 이상이어야 머리글 줄로 봄.
function headerMap(row: string[]): Map<Field, number> | null {
  const best = new Map<Field, { col: number; rank: number }>();
  row.forEach((cell, col) => {
    const hit = ALIAS_RANK.get(normalizeHeader(cell));
    if (!hit) return;
    const prev = best.get(hit.field);
    if (!prev || hit.rank < prev.rank) best.set(hit.field, { col, rank: hit.rank });
  });
  if (best.size < 3) return null;
  return new Map([...best].map(([field, { col }]) => [field, col]));
}

// "1,234,000원", "₩ 5,000", "(1,000)", "-300" → 숫자. 숫자가 아니면 null.
export function parseExcelNumber(text: string): number | null {
  const t = text.replace(/[,\s원₩]/g, "");
  if (!t) return null;
  const negative = /^\(.*\)$/.test(t);
  const n = Number(negative ? t.slice(1, -1) : t);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

function isoDate(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// "2026-09-03", "2026.9.3", "2026/09/03", "2026. 9. 3.", "20260903", "26.9.3", "9/3"(올해), 엑셀 날짜 숫자 → YYYY-MM-DD.
export function parseExcelDate(text: string, defaultYear: number): string | null {
  const t = text.trim().replace(/\.$/, "");
  if (!t) return null;
  let m = t.match(/^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?$/);
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = t.match(/^(\d{2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})$/);
  if (m) return isoDate(2000 + Number(m[1]), Number(m[2]), Number(m[3]));
  m = t.match(/^(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?$/);
  if (m) return isoDate(defaultYear, Number(m[1]), Number(m[2]));
  // 날짜 서식이 빠진 엑셀 날짜(1900-01-01부터 센 일수)
  if (/^\d{5}$/.test(t)) {
    const serial = Number(t);
    if (serial > 30000 && serial < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400_000);
      return isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
  }
  return null;
}

function parseTaxInvoice(text: string) {
  const t = text.replace(/\s+/g, "").toLowerCase();
  if (!t || t.includes("미") || t === "n" || t === "no" || t === "x" || t === "아니오" || t === "false" || t === "0") {
    return false;
  }
  return ["y", "yes", "o", "○", "v", "예", "발행", "true", "1", "유"].includes(t);
}

// 안내·예시 줄("예)", "예시", "※ 작성 방법")과 합계·소계 줄은 건너뜀.
function isGuideOrTotalRow(row: string[]) {
  const first = row.find((c) => c.trim() !== "")?.trim() ?? "";
  return /^(예\)|예시|※|\*|작성\s*방법|안내)/.test(first) || /^(합\s*계|소\s*계|총\s*계)$/.test(first);
}

export function parseTransactionSheet(table: string[][], defaultYear: number): ExcelTransactionRow[] {
  const rows = table.map((r) => r.map((c) => (c ?? "").toString().trim()));
  const headerIndex = rows.slice(0, 10).findIndex((r) => headerMap(r) !== null);
  const columns =
    headerIndex >= 0
      ? headerMap(rows[headerIndex])!
      : new Map<Field, number>(TEMPLATE_ORDER.map((field, i) => [field, i]));
  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows;

  const result: ExcelTransactionRow[] = [];
  for (const row of dataRows) {
    if (row.every((c) => c === "") || isGuideOrTotalRow(row)) continue;
    const get = (field: Field) => {
      const col = columns.get(field);
      return col == null ? "" : (row[col] ?? "");
    };
    const quantity = parseExcelNumber(get("quantity"));
    const unitPrice = parseExcelNumber(get("unit_price"));
    let amount = parseExcelNumber(get("amount"));
    if (amount == null && quantity != null && unitPrice != null) amount = quantity * unitPrice;
    const item = get("item_name");
    const client = get("client_name");
    const date = parseExcelDate(get("trans_date"), defaultYear);
    // 금액이 없거나, 날짜·품목·거래처가 전부 없는 줄(합계 줄 등)은 거래가 아님.
    if (amount == null || (!date && !item && !client)) continue;
    result.push({
      trans_date: date ?? "",
      type: get("type").includes("매출") ? "매출" : "매입",
      client_name: client,
      project_name: get("project_name"),
      item_name: item,
      category_name: get("category_name"),
      quantity,
      unit_price: unitPrice,
      amount,
      payment_method_name: get("payment_method_name"),
      payment_type: /외상|credit|후불|나중/i.test(get("payment_type")) ? "credit" : "immediate",
      tax_invoice_issued: parseTaxInvoice(get("tax_invoice_issued")),
      note1: get("note1"),
      note2: get("note2"),
    });
  }
  return result;
}
