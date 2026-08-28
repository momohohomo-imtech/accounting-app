"use client";

import { useMemo, useState } from "react";
import { deleteTransactionRecord, bulkUpdateProjectId } from "@/lib/actions/transactions";
import { formatWon, formatDate } from "@/lib/format";
import { transactionTotal } from "@/lib/credit";
import { Badge } from "@/components/ui/Badge";
import { LinkButton, Button } from "@/components/ui/Button";
import { Table, THead, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { Card } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/field";
import { cx } from "@/lib/cx";
import type { Transaction } from "@/lib/types";
import type { ProjectTreeNode } from "@/components/ProjectTreeFilter";

type SortKey = "trans_date" | "type" | "client" | "project" | "item_name" | "payment_method" | "tax_invoice" | "amount";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "trans_date", label: "날짜" },
  { key: "type", label: "구분" },
  { key: "client", label: "거래처" },
  { key: "project", label: "프로젝트" },
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

export function TransactionTable({
  transactions,
  projectNodes,
  listParams,
}: {
  transactions: Transaction[];
  projectNodes: ProjectTreeNode[];
  listParams: { year: number; month: string; type: string; project_id: string };
}) {
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
  const [bulkYear, setBulkYear] = useState("");
  const [bulkSiteId, setBulkSiteId] = useState("");
  const [bulkProjectId, setBulkProjectId] = useState("");

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
          <form
            action={bulkUpdateProjectId}
            onSubmit={() => {
              setSelected(new Set());
              setBulkYear("");
              setBulkSiteId("");
              setBulkProjectId("");
            }}
            className="flex flex-wrap items-center gap-2"
          >
            {Array.from(selected).map((id) => (
              <input key={id} type="hidden" name="transaction_ids" value={id} />
            ))}
            <input type="hidden" name="project_id" value={bulkProjectId} />
            <span className="text-sm text-slate-600">{selected.size}건 선택됨 · 프로젝트 변경:</span>
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
            <Button type="submit" size="sm">
              변경
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelected(new Set());
                setBulkYear("");
                setBulkSiteId("");
                setBulkProjectId("");
              }}
            >
              선택 해제
            </Button>
          </form>
        </Card>
      )}

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
            <Tr key={t.id} className={selected.has(t.id) ? "bg-blue-50/60" : undefined}>
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
              <Td className="pr-4">
                {t.needs_classification ? (
                  <Badge className="bg-green-600 text-white">분류 대기 중</Badge>
                ) : (
                  (t.projects?.name ?? <span className="font-medium text-red-600">일반경비</span>)
                )}
              </Td>
              <Td className="pr-4">{t.item_name ?? "-"}</Td>
              <Td className="pr-4">{t.payment_methods?.name ?? "-"}</Td>
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
                    <form action={deleteTransactionRecord} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={t.id} />
                      <span className="text-xs font-medium text-red-600">정말 삭제?</span>
                      <Button
                        variant="danger"
                        size="xs"
                        type="submit"
                        onClick={(e) => {
                          if (!confirm("정말로 이 내역을 삭제하시겠습니까? 삭제하면 복구할 수 없습니다.")) e.preventDefault();
                        }}
                      >
                        확인
                      </Button>
                      <Button variant="secondary" size="xs" type="button" onClick={() => setConfirmDeleteId(null)}>
                        취소
                      </Button>
                    </form>
                  ) : (
                    <Button variant="danger" size="xs" type="button" onClick={() => setConfirmDeleteId(t.id)}>
                      삭제
                    </Button>
                  )}
                </div>
              </Td>
            </Tr>
          ))}
          {sorted.length === 0 && <EmptyRow colSpan={COLUMNS.length + 2}>거래 내역이 없습니다.</EmptyRow>}
        </tbody>
      </Table>
    </div>
  );
}
