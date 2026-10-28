import { transactionTotal } from "@/lib/credit";

// 매입매출 "장부 점검" 탭(사용자 요청) — 중복 의심 거래와 카테고리가 빈 세금·금융 매입을 찾는다. 찾기만 하고 저장된 값은
// 바꾸지 않음(고치는 건 사용자가 수정·삭제·카테고리 지정으로).

export type LedgerCheckRow = {
  id: string;
  trans_date: string;
  type: string;
  client_id: string | null;
  client_name_raw: string | null;
  clients?: { name: string } | null;
  item_name: string | null;
  note1?: string | null;
  category_id: string | null;
  payment_group_id?: string | null;
  sales_amount: number;
  sales_vat: number;
  purchase_amount: number;
  purchase_vat: number;
};

export const clientLabel = (t: Pick<LedgerCheckRow, "clients" | "client_name_raw">) =>
  t.clients?.name ?? t.client_name_raw ?? "";

const normalize = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, "").toLowerCase();

// 중복 의심 — 같은 날·같은 구분(매입/매출)·같은 거래처·같은 품목·같은 금액(부가세 포함 총액) 거래가 2건 이상. 한 결제로 묶은
// 줄끼리(같은 묶음 번호)는 일부러 나눈 것이라 한 건으로 셈. 0원은 뺌. 날짜 최근 순.
export function findDuplicateCandidates<T extends LedgerCheckRow>(rows: T[]) {
  const byKey = new Map<string, T[]>();
  for (const t of rows) {
    const total = transactionTotal(t);
    if (total === 0) continue;
    const client = t.client_id ?? normalize(t.client_name_raw);
    const key = [t.trans_date, t.type, client, normalize(t.item_name), total].join("|");
    byKey.set(key, [...(byKey.get(key) ?? []), t]);
  }
  return Array.from(byKey.values())
    .filter((list) => new Set(list.map((t) => t.payment_group_id ?? t.id)).size > 1)
    .map((list) => ({
      key: list.map((t) => t.id).join(","),
      date: list[0].trans_date,
      type: list[0].type,
      client: clientLabel(list[0]),
      item: list[0].item_name ?? "",
      total: transactionTotal(list[0]),
      rows: list,
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.client.localeCompare(b.client, "ko"));
}

// 카테고리가 빈 매입은 부가세 포함 금액으로 보고 ÷1.1로 매입세액 공제를 잡아서, 세금·보험료·금융비용처럼 부가세가 없는
// 지출이면 공제가 부풀고(부가세 예상이 낮게) 이익도 틀어짐 → 품목·거래처·비고 글자로 세금·보험·금융으로 보이는 것을 표시.
const KIND_WORDS: { kind: "세금" | "보험" | "금융"; words: string[] }[] = [
  {
    kind: "세금",
    words: ["국세", "지방세", "소득세", "법인세", "부가세", "부가가치세", "원천세", "주민세", "재산세", "자동차세", "취득세",
      "등록면허세", "가산세", "과태료", "세무서", "세금"],
  },
  { kind: "보험", words: ["국민연금", "건강보험", "고용보험", "산재보험", "4대보험", "사회보험", "장기요양"] },
  { kind: "금융", words: ["어음", "할인료", "이자", "대출", "이체수수료", "송금수수료"] },
];
// "세금계산서"·"부가세 포함" 같은 말은 세금 지출이 아니라서 먼저 지움.
const NOT_TAX = /세금계산서|부가세(포함|별도|제외)|부가가치세(포함|별도|제외)|vat(포함|별도|제외)/g;

export function taxFinanceKind(t: Pick<LedgerCheckRow, "item_name" | "client_name_raw" | "clients" | "note1">) {
  const text = normalize([t.item_name, clientLabel(t), t.note1].filter(Boolean).join(" ")).replace(NOT_TAX, "");
  return KIND_WORDS.find((k) => k.words.some((w) => text.includes(normalize(w))))?.kind ?? null;
}

// 카테고리가 빈 매입 — 세금·보험·금융으로 보이는 것(kind)을 앞에, 그다음 날짜 최근 순.
export function uncategorizedPurchases<T extends LedgerCheckRow>(rows: T[]) {
  return rows
    .filter((t) => t.type === "매입" && !t.category_id)
    .map((t) => ({ ...t, kind: taxFinanceKind(t) }))
    .sort((a, b) => Number(Boolean(b.kind)) - Number(Boolean(a.kind)) || b.trans_date.localeCompare(a.trans_date));
}
