import { formatWon } from "@/lib/format";
import { formatThousands } from "@/lib/numberInput";

// 거래 수정 이력(094 SQL의 transaction_history) — 바뀌기 전·후 거래(jsonb)를 사람이 읽는 "칸: 전 → 후"로 바꿈.
// 이름(거래처·프로젝트·카테고리·결제수단)은 id로 저장돼 있어서 화면에서 받은 이름표로 바꿔 보여 줌.

export type HistoryTx = {
  trans_date?: string | null;
  type?: string | null;
  client_id?: string | null;
  client_name_raw?: string | null;
  project_id?: string | null;
  category_id?: string | null;
  payment_method_id?: string | null;
  payment_type?: string | null;
  item_name?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  sales_amount?: number | null;
  sales_vat?: number | null;
  purchase_amount?: number | null;
  purchase_vat?: number | null;
  tax_invoice_issued?: boolean | null;
  vat_included?: boolean | null;
  needs_classification?: boolean | null;
  note1?: string | null;
  note2?: string | null;
  payment_group_id?: string | null;
};

export type HistoryNames = {
  clients: Map<string, string>;
  projects: Map<string, string>;
  categories: Map<string, string>;
  paymentMethods: Map<string, string>;
};

const won = (n: number) => formatWon(n);
const num = (v: number | null | undefined) => (v == null ? "-" : formatThousands(String(v)));
const text = (v: string | null | undefined) => (v && v.trim() ? v.trim() : "-");
const yesNo = (v: boolean | null | undefined, yes: string, no: string) => (v ? yes : no);

export function historyTotal(t: HistoryTx) {
  return t.type === "매출"
    ? Number(t.sales_amount ?? 0) + Number(t.sales_vat ?? 0)
    : Number(t.purchase_amount ?? 0) + Number(t.purchase_vat ?? 0);
}

export function historyClient(t: HistoryTx, names: HistoryNames) {
  return (t.client_id && names.clients.get(t.client_id)) || t.client_name_raw || "-";
}

// 이력 한 줄에 보여 줄 거래 요약(삭제된 거래는 지우기 전 값으로).
export function summarizeHistoryTx(t: HistoryTx, names: HistoryNames) {
  return {
    date: t.trans_date ?? "",
    type: t.type ?? "",
    client: historyClient(t, names),
    item: t.item_name ?? "",
    total: historyTotal(t),
  };
}

// 칸마다 사람이 읽는 값 — 같은 글자면 안 바뀐 것으로 봄(예: 거래처 id가 바뀌어도 이름이 같으면 표시 안 함).
const FIELDS: { label: string; show: (t: HistoryTx, n: HistoryNames) => string }[] = [
  { label: "날짜", show: (t) => text(t.trans_date) },
  { label: "구분", show: (t) => text(t.type) },
  { label: "거래처", show: (t, n) => historyClient(t, n) },
  { label: "프로젝트", show: (t, n) => (t.project_id ? n.projects.get(t.project_id) ?? "(지워진 프로젝트)" : "일반경비") },
  { label: "카테고리", show: (t, n) => (t.category_id ? n.categories.get(t.category_id) ?? "(지워진 카테고리)" : "없음") },
  { label: "품목", show: (t) => text(t.item_name) },
  { label: "수량", show: (t) => num(t.quantity) },
  { label: "단가", show: (t) => num(t.unit_price) },
  { label: "금액(합계)", show: (t) => won(historyTotal(t)) },
  {
    label: "공급가·부가세",
    show: (t) =>
      t.type === "매출"
        ? `${won(Number(t.sales_amount ?? 0))} + ${won(Number(t.sales_vat ?? 0))}`
        : `${won(Number(t.purchase_amount ?? 0))} + ${won(Number(t.purchase_vat ?? 0))}`,
  },
  { label: "결제방식", show: (t) => (t.payment_type === "credit" ? "외상" : "즉시결제") },
  { label: "결제수단", show: (t, n) => (t.payment_method_id ? n.paymentMethods.get(t.payment_method_id) ?? "(지워진 결제수단)" : "없음") },
  { label: "세금계산서", show: (t) => yesNo(t.tax_invoice_issued, "발행", "미발행") },
  { label: "10% VAT 추가", show: (t) => yesNo(t.vat_included, "체크", "해제") },
  { label: "분류 대기", show: (t) => yesNo(t.needs_classification, "예", "아니오") },
  { label: "비고1", show: (t) => text(t.note1) },
  { label: "비고2", show: (t) => text(t.note2) },
  { label: "한 결제 묶음", show: (t) => (t.payment_group_id ? "묶음" : "없음") },
];

// 수정 이력 한 건의 바뀐 칸들. 금액 합계가 바뀌면 공급가·부가세 줄은 생략(같은 이야기라).
export function describeChanges(oldRow: HistoryTx, newRow: HistoryTx, names: HistoryNames) {
  const changes = FIELDS.map((f) => ({ label: f.label, before: f.show(oldRow, names), after: f.show(newRow, names) })).filter(
    (c) => c.before !== c.after
  );
  const totalChanged = changes.some((c) => c.label === "금액(합계)");
  return totalChanged ? changes.filter((c) => c.label !== "공급가·부가세") : changes;
}
