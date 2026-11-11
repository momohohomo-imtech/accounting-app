// 거래 일괄 변경 칸(매입매출장·보고서 내역 표 — 11/11 사용자 요청 "보고서에서 보는 내역들을 선택 후 카테고리·품목·프로젝트·거래처
// 등 일괄 수정")의 계산 — 선택 목록·거래처 고르기·확인 문구. 화면은 components/TransactionBulkEditBar.tsx, 저장은
// lib/actions/transactions.ts의 bulkUpdate*(금액·날짜는 안 바뀜). 검사: transactionBulkEdit.test.ts
import type { ProjectTreeNode } from "@/components/ProjectTreeFilter";

export type TransactionBulkOptions = {
  clients: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  paymentMethods: { id: string; name: string; text_color?: string | null; background_color?: string | null }[];
  projectNodes: ProjectTreeNode[];
  // 직접 입력한 거래처 이름(자동완성용)
  rawClientNames: string[];
};

export type BulkField = "project" | "client" | "category" | "payment_method" | "item_name";

export const BULK_FIELDS: { value: BulkField; label: string }[] = [
  { value: "project", label: "프로젝트" },
  { value: "client", label: "거래처" },
  { value: "category", label: "카테고리" },
  { value: "payment_method", label: "결제방식" },
  { value: "item_name", label: "품목" },
];

// 확인 문구의 "○○를/을"
const FIELD_OBJECT: Record<BulkField, string> = {
  project: "프로젝트를",
  client: "거래처를",
  category: "카테고리를",
  payment_method: "결제방식을",
  item_name: "품목을",
};

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

/** 바꾸기 전 확인 문구 — 값이 비면 "비울까요", 프로젝트가 비면 일반경비 */
export function bulkChangeConfirmText(count: number, field: BulkField, valueLabel: string | null | undefined): string {
  const value = (valueLabel ?? "").trim();
  const target = `선택한 ${count.toLocaleString("ko-KR")}건의 ${FIELD_OBJECT[field]}`;
  if (field === "project" && !value) return `${target} "일반경비"(프로젝트 없음)로 바꿀까요? 금액·날짜는 그대로예요.`;
  if (!value) return `${target} 비울까요? 금액·날짜는 그대로예요.`;
  return `${target} "${value}"(으)로 바꿀까요? 금액·날짜는 그대로예요.`;
}
