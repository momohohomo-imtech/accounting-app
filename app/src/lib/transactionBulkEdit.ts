// 거래 일괄 변경 칸(매입매출장·보고서 내역 표 — 11/11 사용자 요청 "보고서에서 보는 내역들을 선택 후 카테고리·품목·프로젝트·거래처
// 등 일괄 수정")의 계산 — 선택 목록·거래처 고르기·확인 문구. 화면은 components/TransactionBulkEditBar.tsx, 저장은
// lib/actions/transactions.ts의 bulkUpdateTransactionFields(금액·날짜는 안 바뀜). 검사: transactionBulkEdit.test.ts
// 11/26 사용자 요청 "프로젝트처럼 카테고리·거래처 이름·결제수단·세금계산서 발행을 같이 수정" — 예전엔 한 번에 한 칸(고르는 칸에서 바꿀
// 항목을 골라야 해서 다른 칸이 있는 줄 몰랐음) → 바꿀 칸만 골라 한 번에(안 고른 칸은 그대로), 세금계산서 발행·미발행 추가.
import type { ProjectTreeNode } from "@/components/ProjectTreeFilter";
import { isVatExemptCategory } from "@/lib/vatBasis";

export type TransactionBulkOptions = {
  clients: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  paymentMethods: { id: string; name: string; text_color?: string | null; background_color?: string | null }[];
  projectNodes: ProjectTreeNode[];
  // 직접 입력한 거래처 이름(자동완성용)
  rawClientNames: string[];
};

export type BulkField = "project" | "client" | "category" | "payment_method" | "tax_invoice" | "item_name";

export const BULK_FIELDS: { value: BulkField; label: string }[] = [
  { value: "project", label: "프로젝트" },
  { value: "client", label: "거래처" },
  { value: "category", label: "카테고리" },
  { value: "payment_method", label: "결제방식" },
  { value: "tax_invoice", label: "세금계산서" },
  { value: "item_name", label: "품목" },
];

const FIELD_LABEL = Object.fromEntries(BULK_FIELDS.map((f) => [f.value, f.label])) as Record<BulkField, string>;

/** 프로젝트 고르기 1단계 — 프로젝트가 있는 연도(최근이 위) */
export function bulkProjectYears(nodes: ProjectTreeNode[]): number[] {
  return Array.from(new Set(nodes.map((p) => p.year))).sort((a, b) => b - a);
}

/** 2단계 — 그 해 프로젝트가 있는 현장([id, "거래처 · 현장"]) */
export function bulkProjectSites(nodes: ProjectTreeNode[], year: string): [string, string][] {
  if (!year) return [];
  const map = new Map<string, string>();
  for (const p of nodes) {
    if (String(p.year) !== year) continue;
    map.set(p.siteId, p.clientName ? `${p.clientName} · ${p.siteName}` : p.siteName);
  }
  return Array.from(map.entries());
}

/** 3단계 — 그 해·그 현장 프로젝트 */
export function bulkProjects(nodes: ProjectTreeNode[], year: string, siteId: string): ProjectTreeNode[] {
  if (!year || !siteId) return [];
  return nodes.filter((p) => String(p.year) === year && p.siteId === siteId);
}

/** 거래처 이름 자동완성 — 등록 거래처 + 직접 입력 이름(같은 이름은 한 번, 가나다) */
export function bulkClientNameOptions(clients: { name: string }[], rawNames: (string | null | undefined)[]): string[] {
  return Array.from(
    new Set([...clients.map((c) => c.name), ...rawNames.filter((n): n is string => Boolean(n))])
  ).sort((a, b) => a.localeCompare(b, "ko"));
}

/**
 * 거래처 칸 값 — 드롭다운에서 고른 거래처가 있고 이름칸이 그 이름 그대로면 그 거래처(같은 이름 거래처가 여럿이어도 고른 쪽),
 * 아니면 이름칸 글자가 등록 거래처 이름과 같을 때 그 거래처, 그것도 아니면 직접 입력 이름. 둘 다 비면 거래처 비움.
 */
export function resolveBulkClient(
  clients: { id: string; name: string }[],
  pickedId: string,
  text: string
): { clientId: string; clientNameRaw: string; label: string } {
  const name = text.trim();
  const picked = clients.find((c) => c.id === pickedId);
  const matched = picked && picked.name === name ? picked : clients.find((c) => c.name === name);
  if (matched) return { clientId: matched.id, clientNameRaw: "", label: matched.name };
  return { clientId: "", clientNameRaw: name, label: name };
}

/** 바꿀 칸 하나(확인창 글자용) — label은 바꿀 값의 이름(비우면 null) */
export type BulkChange = { field: BulkField; label: string | null };

function changeValueText({ field, label }: BulkChange): string {
  const value = (label ?? "").trim();
  if (field === "tax_invoice") return value || "미발행";
  if (field === "project" && !value) return '"일반경비"(프로젝트 없음)';
  if (!value) return "비움";
  return `"${value}"`;
}

/** 바꾸기 전 확인 문구 — 바꿀 칸마다 한 줄(값이 비면 "비움", 프로젝트가 비면 일반경비) */
export function bulkChangesConfirmText(count: number, changes: BulkChange[]): string {
  return [
    `선택한 ${count.toLocaleString("ko-KR")}건을 이렇게 바꿀까요?`,
    ...changes.map((c) => `· ${FIELD_LABEL[c.field]} → ${changeValueText(c)}`),
    "금액·날짜는 그대로예요.",
  ].join("\n");
}

/** 서버에서 바꿀 칸(transactions 표 칸 이름) — 주소 값에 그 칸이 있을 때만 바꿈 */
export type BulkPatch = {
  project_id?: string | null;
  needs_classification?: boolean;
  client_id?: string | null;
  client_name_raw?: string | null;
  category_id?: string | null;
  payment_method_id?: string | null;
  tax_invoice_issued?: boolean;
  item_name?: string;
};

/**
 * 폼 값 → 바꿀 칸. get(이름)은 그 칸이 없으면 null(= 그대로), 있으면 글자(빈 글자 = 비움 — 프로젝트는 일반경비).
 * 프로젝트를 고르면 "분류 대기"도 풂(예전 프로젝트 일괄 변경과 같음), 거래처는 등록 거래처 또는 직접 입력 이름 하나만, 품목은 빈 글자면 그대로.
 */
export function bulkPatchFromForm(get: (key: string) => string | null): { patch: BulkPatch; fields: BulkField[] } {
  const patch: BulkPatch = {};
  const fields: BulkField[] = [];
  const project = get("project_id");
  if (project !== null) {
    patch.project_id = project || null;
    patch.needs_classification = false;
    fields.push("project");
  }
  const clientId = get("client_id");
  const clientRaw = get("client_name_raw");
  if (clientId !== null || clientRaw !== null) {
    patch.client_id = clientId || null;
    patch.client_name_raw = clientId ? null : (clientRaw ?? "").trim() || null;
    fields.push("client");
  }
  const category = get("category_id");
  if (category !== null) {
    patch.category_id = category || null;
    fields.push("category");
  }
  const method = get("payment_method_id");
  if (method !== null) {
    patch.payment_method_id = method || null;
    fields.push("payment_method");
  }
  const invoice = get("tax_invoice_issued");
  if (invoice !== null) {
    patch.tax_invoice_issued = invoice === "1";
    fields.push("tax_invoice");
  }
  const item = (get("item_name") ?? "").trim();
  if (item) {
    patch.item_name = item;
    fields.push("item_name");
  }
  return { patch, fields };
}

export type InvoiceCheckRow = {
  id: string;
  trans_date: string;
  item_name: string | null;
  category_id: string | null;
  tax_invoice_issued: boolean | null;
};
type CategoryLite = { id: string; name: string; vat_exempt?: boolean | null };

/** 바꾸면 "비과세 카테고리 + 세금계산서 발행"이 되는 거래가 생길 수 있는 변경인지(그때만 거래를 읽어 확인) */
export function needsExemptInvoiceCheck(patch: BulkPatch): boolean {
  if (patch.tax_invoice_issued === false) return false;
  return patch.tax_invoice_issued === true || Boolean(patch.category_id);
}

/**
 * 바꾼 뒤 비과세 카테고리인데 세금계산서 발행인 거래 — 거래 등록 화면과 같은 규칙(비과세 카테고리는 세금계산서 칸을 못 켬). 그런 거래가
 * 있으면 일괄 변경을 막음(일부만 바꾸지 않음 — 무엇이 바뀌었는지 헷갈리지 않게).
 */
export function exemptInvoiceConflicts(rows: InvoiceCheckRow[], categories: CategoryLite[], patch: BulkPatch): InvoiceCheckRow[] {
  if (!needsExemptInvoiceCheck(patch)) return [];
  const byId = new Map(categories.map((c) => [c.id, c]));
  return rows.filter((r) => {
    const categoryId = "category_id" in patch ? patch.category_id : r.category_id;
    const invoice = patch.tax_invoice_issued ?? Boolean(r.tax_invoice_issued);
    return invoice && Boolean(categoryId) && isVatExemptCategory(byId.get(categoryId as string));
  });
}

export function exemptInvoiceMessage(conflicts: InvoiceCheckRow[], patch: BulkPatch): string {
  const sample = conflicts
    .slice(0, 3)
    .map((r) => `${r.trans_date.slice(5)} ${r.item_name?.trim() || "(품목 없음)"}`)
    .join(", ");
  const more = conflicts.length > 3 ? ` 외 ${(conflicts.length - 3).toLocaleString("ko-KR")}건` : "";
  const n = conflicts.length.toLocaleString("ko-KR");
  return patch.tax_invoice_issued === true
    ? `비과세 카테고리 거래 ${n}건은 세금계산서 발행으로 바꿀 수 없습니다(비과세는 세금계산서 없음) — ${sample}${more}. 그 거래를 빼고 다시 바꿔 주세요.`
    : `세금계산서 발행인 거래 ${n}건은 비과세 카테고리로 바꿀 수 없습니다 — ${sample}${more}. 세금계산서를 "미발행"으로 같이 바꾸거나 그 거래를 빼고 다시 바꿔 주세요.`;
}
