"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import {
  deleteTransactionRecord,
  deleteTransactionRecords,
  bulkUpdateProjectId,
  bulkUpdateClientId,
  bulkUpdateCategoryId,
  bulkUpdatePaymentMethodId,
  bulkUpdateItemName,
  groupTransactions,
  ungroupTransactions,
} from "@/lib/actions/transactions";
import { formatWon, formatDate } from "@/lib/format";
import { transactionTotal } from "@/lib/credit";
import { dateSpan, groupKindLabel, groupLedgerRows, sameCommonFields, sortGroupLines, summaryLabel } from "@/lib/paymentGroup";
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
import { useConfirm } from "@/components/ConfirmProvider";

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

// 한 결제로 묶인 거래(092)의 매입장 한 줄 — 금액은 합계, 이름은 "A 외 1곳"처럼(같은 이름은 한 번만), 날짜는 마지막 계산서
// 날짜(외상 정산 묶음은 날짜가 여럿 — 정렬용, 화면엔 범위로), 나머지는 첫 줄(한 결제라 구분·결제방식이 같음).
function groupHead(lines: Transaction[]): Transaction {
  const first = lines[0];
  const total = (key: "sales_amount" | "sales_vat" | "purchase_amount" | "purchase_vat") =>
    lines.reduce((s, l) => s + Number(l[key]), 0);
  const firstCategory = lines.find((l) => l.expense_categories)?.expense_categories;
  return {
    ...first,
    trans_date: dateSpan(lines).last,
    sales_amount: total("sales_amount"),
    sales_vat: total("sales_vat"),
    purchase_amount: total("purchase_amount"),
    purchase_vat: total("purchase_vat"),
    tax_invoice_issued: lines.some((l) => l.tax_invoice_issued),
    needs_classification: lines.every((l) => l.needs_classification),
    item_name: summaryLabel(lines.map((l) => l.item_name ?? "-"), "건"),
    clients: {
      ...first.clients,
      name: summaryLabel(lines.map((l) => l.clients?.name ?? l.client_name_raw ?? "-"), "곳"),
    } as Transaction["clients"],
    projects: lines.some((l) => l.projects)
      ? ({ name: summaryLabel(lines.map((l) => l.projects?.name ?? "일반경비"), "곳") } as Transaction["projects"])
      : undefined,
    expense_categories: firstCategory && {
      ...firstCategory,
      name: summaryLabel(lines.map((l) => l.expense_categories?.name ?? "-"), "개"),
    },
  };
}

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
  groupingReady = false,
  paidDateById = {},
  readOnly = false,
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
  // 092 SQL 실행 후에만 "한 결제로 묶기·묶음 풀기" 버튼을 보여 줌.
  groupingReady?: boolean;
  // 외상 거래의 정산일(마지막 정산 이력) — 외상 정산 묶음 줄에 "MM-DD 정산"으로.
  paidDateById?: Record<string, string>;
  // 세무사 계정(읽기 전용) — 체크칸·일괄 변경·수정·삭제 칸 없이 장부만.
  readOnly?: boolean;
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
  // 펼친 묶음(payment_group_id).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // 삭제 확인 중인 줄 — 거래 id, 묶음 전체면 "group:묶음 번호".
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const pending = useGlobalPending();
  const confirm = useConfirm();
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
    setBulkError(null);
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

    // 한 결제 묶음에서 줄마다 다르던 프로젝트·품목명을 한 값으로 덮으면 나눠 둔 게 사라짐 — 묶음 줄을 체크하면 그 묶음의
    // 줄이 모두 선택되므로, 바꾸기 전에 한 번 확인.
    if (bulkField === "project" || bulkField === "item_name") {
      const field = bulkField === "project" ? "project_id" : "item_name";
      const valuesByGroup = new Map<string, Set<string>>();
      for (const t of transactions) {
        if (!t.payment_group_id || !selected.has(t.id)) continue;
        const values = valuesByGroup.get(t.payment_group_id) ?? new Set<string>();
        values.add(t[field] ?? "");
        valuesByGroup.set(t.payment_group_id, values);
      }
      const splitGroups = Array.from(valuesByGroup.values()).filter((v) => v.size > 1).length;
      if (
        splitGroups > 0 &&
        !(await confirm(
          bulkField === "project"
            ? `프로젝트별로 나눠 둔 묶음(한 결제) ${splitGroups}개가 선택돼 있어요. 줄마다 다르던 프로젝트가 모두 같은 프로젝트로 바뀝니다. 그래도 바꿀까요?`
            : `품목명이 줄마다 다른 묶음(한 결제) ${splitGroups}개가 선택돼 있어요. 모든 줄의 품목명이 같은 이름으로 바뀝니다. 그래도 바꿀까요?`,
          { confirmLabel: "모두 바꾸기" }
        ))
      ) {
        return;
      }
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

  // 한 결제로 묶인 거래는 한 줄로(정렬은 묶음 합계·대표값 기준), 펼치면 줄마다.
  const items = useMemo(
    () =>
      groupLedgerRows(transactions).map((it) => {
        if (!it.groupId) return { ...it, head: it.lines[0] };
        const lines = sortGroupLines(it.lines);
        return { ...it, lines, head: groupHead(lines) };
      }),
    [transactions]
  );

  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      const va = sortValue(a.head, sortKey);
      const vb = sortValue(b.head, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [items, sortKey, sortDir]);

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

  // 거래 여러 건을 한 번에 선택/해제 — 묶음 한 줄의 체크는 묶음의 모든 줄.
  function toggleLines(ids: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = ids.every((id) => next.has(id));
      for (const id of ids) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === transactions.length ? new Set() : new Set(transactions.map((t) => t.id))));
  }

  function toggleExpand(groupId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  const selectedHasGroup = transactions.some((t) => selected.has(t.id) && t.payment_group_id);

  async function runGroupAction(groupAction: (fd: FormData) => Promise<BulkResult>) {
    const fd = new FormData();
    selected.forEach((id) => fd.append("transaction_ids", id));
    setBulkError(null);
    const result = await pending.run(() => groupAction(fd));
    if (result?.error) {
      setBulkError(result.error);
      return;
    }
    setSelected(new Set());
    resetBulkFields();
  }

  function deleteFormData(ids: string[]) {
    const fd = new FormData();
    if (ids.length === 1) fd.append("id", ids[0]);
    else ids.forEach((id) => fd.append("transaction_ids", id));
    return fd;
  }

  function checkboxCell(ids: string[]) {
    if (readOnly) return null;
    return (
      <Td className="pr-2">
        <input
          type="checkbox"
          checked={ids.every((id) => selected.has(id))}
          onChange={() => toggleLines(ids)}
          className="h-4 w-4 accent-slate-900"
        />
      </Td>
    );
  }

  // 수정·삭제 칸 — 묶음 줄(묶음 전체·펼친 줄)의 수정은 공통 칸(날짜·카테고리 등)이 같으면 묶음 전체 수정 화면, 다르면 그
  // 줄만 수정 화면이 열림. ids가 여러 개면 묶음 전체 삭제. edit: 수정 버튼 대신 넣을 것(null이면 수정 버튼 없음).
  function actionsCell(editId: string, confirmKey: string, ids: string[], edit?: ReactNode) {
    if (readOnly) return null;
    return (
      <Td className="text-right">
        <div className="flex justify-end gap-2">
          {edit === undefined ? (
            <LinkButton href={editHrefFor(editId)} variant="secondary" size="xs">
              수정
            </LinkButton>
          ) : (
            edit
          )}
          {confirmDeleteId === confirmKey ? (
            <div className="flex items-center gap-1">
              <span className="whitespace-nowrap text-xs font-medium text-red-600">
                {ids.length > 1 ? `${ids.length}건 모두 삭제?` : "정말 삭제?"}
              </span>
              <Button
                variant="danger"
                size="xs"
                type="button"
                onClick={async () => {
                  const fd = deleteFormData(ids);
                  const result = await pending.run(() =>
                    ids.length > 1 ? deleteTransactionRecords(fd) : deleteTransactionRecord(fd)
                  );
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
            <Button variant="danger" size="xs" type="button" onClick={() => setConfirmDeleteId(confirmKey)}>
              삭제
            </Button>
          )}
        </div>
        {confirmDeleteId === confirmKey && deleteError && (
          <p className="mt-1 text-right text-xs text-red-600">{deleteError}</p>
        )}
      </Td>
    );
  }

  function projectCell(t: Transaction) {
    return (
      <Td className="pr-4 max-md:max-w-[10rem] max-md:truncate print:max-w-none print:overflow-visible print:whitespace-normal" title={t.projects?.name ?? undefined}>
        {t.needs_classification ? (
          <Badge variant="green">분류 대기 중</Badge>
        ) : (
          (t.projects?.name ?? <span className="font-medium text-red-600">일반경비</span>)
        )}
      </Td>
    );
  }

  function categoryCell(t: Transaction) {
    return (
      <Td className="whitespace-nowrap pr-4">
        <span
          className={t.expense_categories?.project_only ? "font-medium" : undefined}
          style={{ color: resolveCategoryColor(t.expense_categories) }}
        >
          {t.expense_categories?.name ?? "-"}
        </span>
      </Td>
    );
  }

  function itemCell(t: Transaction) {
    return (
      <Td className="pr-4 max-md:max-w-[10rem] max-md:truncate print:max-w-none print:overflow-visible print:whitespace-normal" title={t.item_name ?? undefined}>
        {t.item_name ?? "-"}
      </Td>
    );
  }

  // 거래 한 줄(묶음 한 줄 포함)의 날짜~금액 칸. 묶음 줄은 lead(펼치기 버튼)·firstDate(날짜가 여럿이면 처음 날짜 — "처음~마지막"
  // 으로 표시)·typeExtra("N건 묶음")·methodExtra("MM-DD 정산")를 넘김.
  function mainCells(
    t: Transaction,
    {
      lead,
      firstDate,
      typeExtra,
      methodExtra,
    }: { lead?: React.ReactNode; firstDate?: string; typeExtra?: React.ReactNode; methodExtra?: React.ReactNode } = {}
  ) {
    const range = firstDate && firstDate !== t.trans_date;
    return (
      <>
        <Td
          className="whitespace-nowrap pr-4"
          title={range ? `${formatDate(firstDate)} ~ ${formatDate(t.trans_date)}` : formatDate(t.trans_date)}
        >
          {lead}
          {/* 화면은 연도 필터로 이미 한 해만 보이므로 월-일만, 인쇄는 전체 날짜 */}
          <span className="print:hidden">
            {range && `${formatDate(firstDate).slice(5)}~`}
            {formatDate(t.trans_date).slice(5)}
          </span>
          <span className="hidden print:inline">
            {range && `${formatDate(firstDate)}~`}
            {formatDate(t.trans_date)}
          </span>
        </Td>
        <Td className="whitespace-nowrap pr-4">
          <Badge variant={t.type === "매출" ? "blue" : "orange"}>{t.type}</Badge>
          {typeExtra}
        </Td>
        <Td
          className="sticky-col pr-4 max-md:max-w-[8.5rem] max-md:truncate print:max-w-none print:overflow-visible print:whitespace-normal"
          title={t.clients?.name ?? t.client_name_raw ?? undefined}
        >
          {t.clients?.name ?? t.client_name_raw ?? "-"}
        </Td>
        {showProject && projectCell(t)}
        {showCategory && categoryCell(t)}
        {showItem && itemCell(t)}
        <Td className="whitespace-nowrap pr-4">
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
          {methodExtra}
        </Td>
        <Td className="whitespace-nowrap pr-4">
          {t.tax_invoice_issued ? <Badge variant="emerald">발행</Badge> : <span className="text-slate-300">-</span>}
        </Td>
        <Td className="whitespace-nowrap pr-4 text-right font-medium text-slate-900">{formatWon(transactionTotal(t))}</Td>
      </>
    );
  }

  // 묶음을 펼친 줄 — 프로젝트·카테고리·품목·금액만(날짜·거래처·결제방식은 묶음 줄과 같음).
  function lineRow(t: Transaction) {
    return (
      <Tr key={t.id} className={selected.has(t.id) ? "bg-brand-soft" : "bg-slate-50/70"}>
        {checkboxCell([t.id])}
        <Td className="whitespace-nowrap pr-4 pl-3 text-xs text-slate-400">
          └ <span className="print:hidden">{formatDate(t.trans_date).slice(5)}</span>
          <span className="hidden print:inline">{formatDate(t.trans_date)}</span>
        </Td>
        <Td className="pr-4" />
        <Td className="sticky-col pr-4" />
        {showProject && projectCell(t)}
        {showCategory && categoryCell(t)}
        {showItem && itemCell(t)}
        <Td className="pr-4" />
        <Td className="pr-4" />
        <Td className="whitespace-nowrap pr-4 text-right text-slate-700">{formatWon(transactionTotal(t))}</Td>
        {actionsCell(t.id, t.id, [t.id])}
      </Tr>
    );
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
          {groupingReady && (selected.size > 1 || selectedHasGroup) && (
            <div className="flex flex-wrap items-center gap-2 border-slate-300 sm:border-l sm:pl-2">
              {selected.size > 1 && (
                <Button type="button" variant="secondary" size="sm" onClick={() => runGroupAction(groupTransactions)}>
                  한 결제로 묶기
                </Button>
              )}
              {selectedHasGroup && (
                <Button type="button" variant="secondary" size="sm" onClick={() => runGroupAction(ungroupTransactions)}>
                  묶음 풀기
                </Button>
              )}
            </div>
          )}
        </Card>
      )}
      {bulkError && <p className="text-sm text-red-600 print:hidden">{bulkError}</p>}

      {/* xl:min-w-0 — 휴대폰·좁은 화면은 칸을 안 우겨넣고 옆으로 넘기지만(1020px), 가로 1280 노트북에선 상자(약 930px)보다
          조금 넓어서 맨 오른쪽 수정·삭제가 가려졌음 → 1280부터는 상자 폭에 맞춰 긴 글자를 줄바꿈 */}
      <Table stickyHeader className="sticky-col-table min-w-[1020px] xl:min-w-0">
        <THead>
          {!readOnly && (
            <th className="w-8 pb-2 pr-2">
              <input
                type="checkbox"
                checked={selected.size > 0 && selected.size === transactions.length}
                onChange={toggleAll}
                className="h-4 w-4 accent-slate-900"
              />
            </th>
          )}
          {COLUMNS.map((c) => (
            <th
              key={c.key}
              className={cx(
                "whitespace-nowrap pb-2 pr-4 font-medium",
                c.key === "amount" && "text-right",
                c.key === "client" && "sticky-col"
              )}
            >
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
          {!readOnly && <th className="pb-2 text-right font-medium">관리</th>}
        </THead>
        <tbody>
          {sorted.map((item) => {
            const t = item.head;
            if (!item.groupId) {
              return (
                <Tr key={item.key} className={selected.has(t.id) ? "bg-brand-soft" : undefined}>
                  {checkboxCell([t.id])}
                  {mainCells(t)}
                  {actionsCell(t.id, t.id, [t.id])}
                </Tr>
              );
            }
            const groupId = item.groupId;
            const ids = item.lines.map((l) => l.id);
            const open = expanded.has(groupId);
            // 외상 정산 묶음 — 정산일(줄마다 같음, 다르면 마지막 날).
            const paidDate = item.lines.map((l) => paidDateById[l.id] ?? "").sort().at(-1);
            // 공통 칸(계산서 날짜 등)이 줄마다 다른 묶음(외상 정산 등)은 묶음 전체 수정이 안 돼서, 한 줄 수정 화면 대신 펼쳐서
            // 줄마다 수정하게 함(펼치면 펼친 줄의 수정 버튼만).
            const lineByLineEdit = !sameCommonFields(item.lines);
            return (
              <Fragment key={item.key}>
                <Tr className={ids.every((id) => selected.has(id)) ? "bg-brand-soft" : undefined}>
                  {checkboxCell(ids)}
                  {mainCells(t, {
                    lead: (
                      <button
                        type="button"
                        onClick={() => toggleExpand(groupId)}
                        aria-expanded={open}
                        aria-label={open ? "묶음 접기" : "묶음 펼치기"}
                        className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded text-[10px] text-slate-500 hover:bg-slate-200 print:hidden"
                      >
                        {open ? "▼" : "▶"}
                      </button>
                    ),
                    firstDate: dateSpan(item.lines).first,
                    // 배지 아래 줄에 — 옆에 붙이면 칸이 넓어져 PC(1280)에서 프로젝트·품목 칸이 좁아지고 글자가 여러 줄로 꺾였음.
                    typeExtra: <span className="mt-0.5 block text-[11px] text-slate-500">{groupKindLabel(item.lines)}</span>,
                    methodExtra: paidDate ? (
                      <span className="mt-0.5 block text-[11px] text-slate-500">{formatDate(paidDate).slice(5)} 정산</span>
                    ) : undefined,
                  })}
                  {actionsCell(
                    item.lines[0].id,
                    `group:${groupId}`,
                    ids,
                    !lineByLineEdit ? undefined : open ? null : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={() => toggleExpand(groupId)}
                        title="줄마다 날짜 등이 달라 펼친 줄에서 하나씩 수정"
                      >
                        수정
                      </Button>
                    )
                  )}
                </Tr>
                {open && item.lines.map((l) => lineRow(l))}
              </Fragment>
            );
          })}
          {sorted.length === 0 && <EmptyRow colSpan={COLUMNS.length + (readOnly ? 0 : 2)}>거래 내역이 없습니다.</EmptyRow>}
        </tbody>
      </Table>
    </div>
  );
}
