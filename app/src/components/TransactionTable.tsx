"use client";

import { useMemo, useState } from "react";
import {
  deleteTransactionRecord,
  bulkUpdateProjectId,
  bulkUpdateClientId,
  bulkUpdateCategoryId,
  bulkUpdatePaymentMethodId,
  bulkUpdateItemName,
} from "@/lib/actions/transactions";
import { formatWon, formatDate } from "@/lib/format";
import { transactionTotal } from "@/lib/credit";
import { resolveCategoryColor } from "@/lib/categoryColor";
import { paymentMethodColorStyle } from "@/lib/paymentMethodColors";
import { Badge } from "@/components/ui/Badge";
import { LinkButton, Button } from "@/components/ui/Button";
import { Table, THead, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { Card } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/field";
import { cx } from "@/lib/cx";
import type { Transaction } from "@/lib/types";
import type { ProjectTreeNode } from "@/components/ProjectTreeFilter";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

const CLIENT_NAMES_DATALIST_ID = "bulk-client-names";

type SortKey =
  | "trans_date"
  | "type"
  | "client"
  | "project"
  | "category"
  | "item_name"
  | "payment_method"
  | "tax_invoice"
  | "amount";

const ALL_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "trans_date", label: "날짜" },
  { key: "type", label: "구분" },
  { key: "client", label: "거래처" },
  { key: "project", label: "프로젝트" },
  { key: "category", label: "카테고리" },
  { key: "item_name", label: "품목" },
  { key: "payment_method", label: "결제방식" },
  { key: "tax_invoice", label: "세금계산서" },
  { key: "amount", label: "금액" },
];

function sortValue(t: Transaction, key: SortKey): string | number {
  switch (key) {
    case "trans_date":
      return t.trans_date;
    case "type":
      return t.type;
    case "client":
      return t.clients?.name ?? t.client_name_raw ?? "";
    case "project":
      return t.projects?.name ?? "";
    case "category":
      return t.expense_categories?.name ?? "";
    case "item_name":
      return t.item_name ?? "";
    case "payment_method":
      return t.payment_methods?.name ?? "";
    case "tax_invoice":
      return t.tax_invoice_issued ? 1 : 0;
    case "amount":
      return transactionTotal(t);
  }
}

type BulkField = "project" | "client" | "category" | "payment_method" | "item_name";

export function TransactionTable({
  transactions,
  projectNodes,
  clients,
  categories,
  paymentMethods,
  listParams,
  showProject = true,
  showCategory = true,
  showItem = true,
}: {
  transactions: Transaction[];
  projectNodes: ProjectTreeNode[];
  clients: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  paymentMethods: { id: string; name: string; text_color?: string | null; background_color?: string | null }[];
  listParams: { year: number; month: string; type: string; project_id: string };
  showProject?: boolean;
  showCategory?: boolean;
  showItem?: boolean;
}) {
  const COLUMNS = ALL_COLUMNS.filter(
    (c) =>
      (c.key !== "project" || showProject) &&
      (c.key !== "category" || showCategory) &&
      (c.key !== "item_name" || showItem)
  );
  function editHrefFor(id: string) {
    const p = new URLSearchParams({
      year: String(listParams.year),
      month: listParams.month,
      type: listParams.type,
      project_id: listParams.project_id,
      editTx: id,
    });
    return `/transactions?${p.toString()}`;
  }

  const [sortKey, setSortKey] = useState<SortKey>("trans_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const pending = useGlobalPending();
  const [bulkField, setBulkField] = useState<BulkField>("project");
  const [bulkYear, setBulkYear] = useState("");
  const [bulkSiteId, setBulkSiteId] = useState("");
  const [bulkProjectId, setBulkProjectId] = useState("");
  const [bulkClientId, setBulkClientId] = useState("");
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkPaymentMethodId, setBulkPaymentMethodId] = useState("");
  const [bulkItemName, setBulkItemName] = useState("");
  const [bulkClientText, setBulkClientText] = useState("");
  const [bulkError, setBulkError] = useState<string | null>(null);

  // 거래처 자동완성 — 등록된 거래처 + 지금 목록에 있는 수기 입력 거래처 이름.
  const clientNameOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...clients.map((c) => c.name),
          ...transactions.map((t) => t.client_name_raw).filter((n): n is string => Boolean(n)),
        ])
      ).sort((a, b) => a.localeCompare(b, "ko")),
    [clients, transactions]
  );

  function resetBulkFields() {
    setBulkField("project");
    setBulkYear("");
    setBulkSiteId("");
    setBulkProjectId("");
    setBulkClientId("");
    setBulkCategoryId("");
    setBulkPaymentMethodId("");
    setBulkItemName("");
    setBulkClientText("");
  }

  type BulkResult = { error?: string } | undefined;
  const bulkAction: (fd: FormData) => Promise<BulkResult> =
    bulkField === "project"
      ? bulkUpdateProjectId
      : bulkField === "client"
        ? bulkUpdateClientId
        : bulkField === "category"
          ? bulkUpdateCategoryId
          : bulkField === "payment_method"
            ? bulkUpdatePaymentMethodId
            : bulkUpdateItemName;

  async function handleBulkSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBulkError(null);

    if (bulkField === "client") {
      const text = bulkClientText.trim();
      // 드롭다운에서 고른 거래처가 있으면 그 id를 그대로 씀 — 같은 이름의 거래처가 여럿이어도
      // 고른 쪽으로 저장되게. 직접 입력한 이름만 있을 때만 이름으로 찾는다.
      const picked = clients.find((c) => c.id === bulkClientId);
      const matched = picked && picked.name === text ? picked : clients.find((c) => c.name === text);
      fd.set("client_id", matched?.id ?? "");
      fd.set("client_name_raw", matched ? "" : text);
    }

    const result = await pending.run(() => bulkAction(fd));
    if (result?.error) {
      setBulkError(result.error);
      return;
    }
    setSelected(new Set());
    resetBulkFields();
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    const copy = [...transactions];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [transactions, sortKey, sortDir]);

  const bulkYears = useMemo(
    () => Array.from(new Set(projectNodes.map((p) => p.year))).sort((a, b) => b - a),
    [projectNodes]
  );
  const bulkSites = useMemo(() => {
    if (!bulkYear) return [];
    const map = new Map<string, string>();
    for (const p of projectNodes) {
      if (String(p.year) !== bulkYear) continue;
      map.set(p.siteId, p.clientName ? `${p.clientName} · ${p.siteName}` : p.siteName);
    }
    return Array.from(map.entries());
  }, [projectNodes, bulkYear]);
  const bulkProjects = useMemo(
    () =>
      !bulkYear || !bulkSiteId
        ? []
        : projectNodes.filter((p) => String(p.year) === bulkYear && p.siteId === bulkSiteId),
    [projectNodes, bulkYear, bulkSiteId]
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === sorted.length ? new Set() : new Set(sorted.map((t) => t.id))));
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <Card padding="none" className="flex flex-wrap items-center gap-2 border-slate-300 bg-slate-50 p-3 print:hidden">
          <form onSubmit={handleBulkSubmit} className="flex flex-wrap items-center gap-2">
            {Array.from(selected).map((id) => (
              <input key={id} type="hidden" name="transaction_ids" value={id} />
            ))}
            <span className="text-sm text-slate-600">{selected.size}건 선택됨 · 항목 변경:</span>
            <select
              value={bulkField}
              onChange={(e) => {
                setBulkField(e.target.value as BulkField);
                setBulkYear("");
                setBulkSiteId("");
                setBulkProjectId("");
                setBulkClientId("");
                setBulkCategoryId("");
                setBulkPaymentMethodId("");
                setBulkItemName("");
                setBulkClientText("");
              }}
              className={fieldClass}
            >
              <option value="project">프로젝트</option>
              <option value="client">거래처</option>
              <option value="category">카테고리</option>
              <option value="payment_method">결제방식</option>
              <option value="item_name">품목</option>
            </select>

            {bulkField === "project" && (
              <>
                <input type="hidden" name="project_id" value={bulkProjectId} />
                <select
                  value={bulkYear}
                  onChange={(e) => {
                    setBulkYear(e.target.value);
                    setBulkSiteId("");
                    setBulkProjectId("");
                  }}
                  className={fieldClass}
                >
                  <option value="">연도 선택</option>
                  {bulkYears.map((y) => (
                    <option key={y} value={y}>
                      {y}년
                    </option>
                  ))}
                </select>
                <select
                  value={bulkSiteId}
                  onChange={(e) => {
                    setBulkSiteId(e.target.value);
                    setBulkProjectId("");
                  }}
                  className={fieldClass}
                  disabled={!bulkYear}
                >
                  <option value="">현장 선택</option>
                  {bulkSites.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
                <select value={bulkProjectId} onChange={(e) => setBulkProjectId(e.target.value)} className={fieldClass}>
                  <option value="">일반경비</option>
                  {bulkProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            {bulkField === "client" && (
              <>
                <select
                  value={bulkClientId}
                  onChange={(e) => {
                    setBulkClientId(e.target.value);
                    setBulkClientText(clients.find((c) => c.id === e.target.value)?.name ?? "");
                  }}
                  className={fieldClass}
                >
                  <option value="">등록 거래처 선택</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  value={bulkClientText}
                  onChange={(e) => {
                    setBulkClientText(e.target.value);
                    setBulkClientId(clients.find((c) => c.name === e.target.value.trim())?.id ?? "");
                  }}
                  list={CLIENT_NAMES_DATALIST_ID}
                  placeholder="또는 거래처 이름 직접 입력"
                  className={fieldClass}
                />
                <datalist id={CLIENT_NAMES_DATALIST_ID}>
                  {clientNameOptions.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </>
            )}

            {bulkField === "category" && (
              <select
                name="category_id"
                value={bulkCategoryId}
                onChange={(e) => setBulkCategoryId(e.target.value)}
                className={fieldClass}
              >
                <option value="">선택 안함</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            {bulkField === "payment_method" && (
              <select
                name="payment_method_id"
                value={bulkPaymentMethodId}
                onChange={(e) => setBulkPaymentMethodId(e.target.value)}
                className={fieldClass}
              >
                <option value="">선택 안함</option>
                {paymentMethods.map((pm) => (
                  <option key={pm.id} value={pm.id} style={paymentMethodColorStyle(pm)}>
                    {pm.name}
                  </option>
                ))}
              </select>
            )}

            {bulkField === "item_name" && (
              <input
                name="item_name"
                value={bulkItemName}
                onChange={(e) => setBulkItemName(e.target.value)}
                placeholder="새 품목명 입력"
                className={fieldClass}
              />
            )}

            <Button type="submit" size="sm">
              변경
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelected(new Set());
                resetBulkFields();
              }}
            >
              선택 해제
            </Button>
          </form>
        </Card>
      )}
      {bulkError && <p className="text-sm text-red-600 print:hidden">{bulkError}</p>}

      <Table className="min-w-[1020px]">
        <THead>
          <th className="w-8 pb-2 pr-2">
            <input
              type="checkbox"
              checked={selected.size > 0 && selected.size === sorted.length}
              onChange={toggleAll}
              className="h-4 w-4 accent-slate-900"
            />
          </th>
          {COLUMNS.map((c) => (
            <th key={c.key} className={cx("whitespace-nowrap pb-2 pr-4 font-medium", c.key === "amount" && "text-right")}>
              <button
                type="button"
                onClick={() => handleSort(c.key)}
                className="inline-flex items-center gap-1 transition-colors hover:text-slate-800"
              >
                {c.label}
                {sortKey === c.key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
              </button>
            </th>
          ))}
          <th className="pb-2 text-right font-medium">관리</th>
        </THead>
        <tbody>
          {sorted.map((t) => (
            <Tr
              key={t.id}
              className={selected.has(t.id) ? "bg-blue-50/60" : undefined}
            >
              <Td className="pr-2">
                <input
                  type="checkbox"
                  checked={selected.has(t.id)}
                  onChange={() => toggle(t.id)}
                  className="h-4 w-4 accent-slate-900"
                />
              </Td>
              <Td className="pr-4">{formatDate(t.trans_date)}</Td>
              <Td className="pr-4">
                <Badge variant={t.type === "매출" ? "blue" : "orange"}>{t.type}</Badge>
              </Td>
              <Td className="pr-4">{t.clients?.name ?? t.client_name_raw ?? "-"}</Td>
              {showProject && (
                <Td className="pr-4">
                  {t.needs_classification ? (
                    <Badge variant="green">분류 대기 중</Badge>
                  ) : (
                    (t.projects?.name ?? <span className="font-medium text-red-600">일반경비</span>)
                  )}
                </Td>
              )}
              {showCategory && (
                <Td className="pr-4">
                  <span
                    className={t.expense_categories?.project_only ? "font-medium" : undefined}
                    style={{ color: resolveCategoryColor(t.expense_categories) }}
                  >
                    {t.expense_categories?.name ?? "-"}
                  </span>
                </Td>
              )}
              {showItem && <Td className="pr-4">{t.item_name ?? "-"}</Td>}
              <Td className="pr-4">
                {t.payment_methods ? (
                  <span
                    className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                    style={paymentMethodColorStyle(t.payment_methods)}
                  >
                    {t.payment_methods.name}
                  </span>
                ) : (
                  "-"
                )}
              </Td>
              <Td className="pr-4">
                {t.tax_invoice_issued ? <Badge variant="emerald">발행</Badge> : <span className="text-slate-300">-</span>}
              </Td>
              <Td className="pr-4 text-right font-medium text-slate-900">{formatWon(transactionTotal(t))}</Td>
              <Td className="text-right">
                <div className="flex justify-end gap-2">
                  <LinkButton href={editHrefFor(t.id)} variant="secondary" size="xs">
                    수정
                  </LinkButton>
                  {confirmDeleteId === t.id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium text-red-600">정말 삭제?</span>
                      <Button
                        variant="danger"
                        size="xs"
                        type="button"
                        onClick={async () => {
                          const fd = new FormData();
                          fd.append("id", t.id);
                          const result = await pending.run(() => deleteTransactionRecord(fd));
                          if (result?.error) {
                            setDeleteError(result.error);
                            return;
                          }
                          setDeleteError(null);
                          setConfirmDeleteId(null);
                        }}
                      >
                        확인
                      </Button>
                      <Button
                        variant="secondary"
                        size="xs"
                        type="button"
                        onClick={() => {
                          setConfirmDeleteId(null);
                          setDeleteError(null);
                        }}
                      >
                        취소
                      </Button>
                    </div>
                  ) : (
                    <Button variant="danger" size="xs" type="button" onClick={() => setConfirmDeleteId(t.id)}>
                      삭제
                    </Button>
                  )}
                </div>
                {confirmDeleteId === t.id && deleteError && (
                  <p className="mt-1 text-right text-xs text-red-600">{deleteError}</p>
                )}
              </Td>
            </Tr>
          ))}
          {sorted.length === 0 && <EmptyRow colSpan={COLUMNS.length + 2}>거래 내역이 없습니다.</EmptyRow>}
        </tbody>
      </Table>
    </div>
  );
}
