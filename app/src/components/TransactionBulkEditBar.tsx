"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  bulkUpdateCategoryId,
  bulkUpdateClientId,
  bulkUpdateItemName,
  bulkUpdatePaymentMethodId,
  bulkUpdateProjectId,
} from "@/lib/actions/transactions";
import {
  BULK_FIELDS,
  bulkChangeConfirmText,
  bulkClientNameOptions,
  bulkProjectSites,
  bulkProjectYears,
  bulkProjects,
  resolveBulkClient,
  type BulkField,
  type TransactionBulkOptions,
} from "@/lib/transactionBulkEdit";
import { paymentMethodColorStyle } from "@/lib/paymentMethodColors";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { inlineFieldClass } from "@/components/ui/field";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

type BulkResult = { error?: string } | undefined;

const ACTIONS: Record<BulkField, (fd: FormData) => Promise<BulkResult>> = {
  project: bulkUpdateProjectId,
  client: bulkUpdateClientId,
  category: bulkUpdateCategoryId,
  payment_method: bulkUpdatePaymentMethodId,
  item_name: bulkUpdateItemName,
};

let datalistSeq = 0;

// 거래 일괄 변경 칸(11/11 — 매입매출장에 있던 것을 떼어 보고서 내역 표에서도 씀): 체크한 거래의 프로젝트·거래처·카테고리·
// 결제방식·품목 중 한 칸을 같은 값으로. 금액·날짜는 안 바뀜. options가 null이면 목록을 불러오는 중(보고서는 체크했을 때 불러옴 —
// ReportBulkEditBar). confirmEachChange면 바꾸기 전에 "선택한 N건의 ○○를 …로 바꿀까요?"(보고서), beforeSubmit은 매입매출장의
// 묶음 확인. 계산은 lib/transactionBulkEdit.ts.
export function TransactionBulkEditBar({
  selectedIds,
  options,
  optionsError,
  confirmEachChange = false,
  beforeSubmit,
  onDone,
  onClear,
  children,
}: {
  selectedIds: string[];
  options: TransactionBulkOptions | null;
  optionsError?: string | null;
  confirmEachChange?: boolean;
  beforeSubmit?: (field: BulkField) => Promise<boolean>;
  onDone: () => void;
  onClear: () => void;
  // 오른쪽에 붙는 버튼(매입매출장의 한 결제로 묶기·묶음 풀기)
  children?: ReactNode;
}) {
  const pending = useGlobalPending();
  const confirm = useConfirm();
  const [field, setField] = useState<BulkField>("project");
  const [year, setYear] = useState("");
  const [siteId, setSiteId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientText, setClientText] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [itemName, setItemName] = useState("");
  const [error, setError] = useState<string | null>(null);
  // 한 화면에 칸이 둘 이상이어도(보고서 팝업 + 아래 표) 자동완성 목록 id가 겹치지 않게
  const [datalistId] = useState(() => `bulk-client-names-${++datalistSeq}`);

  const nodes = useMemo(() => options?.projectNodes ?? [], [options]);
  const years = useMemo(() => bulkProjectYears(nodes), [nodes]);
  const sites = useMemo(() => bulkProjectSites(nodes, year), [nodes, year]);
  const projects = useMemo(() => bulkProjects(nodes, year, siteId), [nodes, year, siteId]);
  const clientNames = useMemo(
    () => (options ? bulkClientNameOptions(options.clients, options.rawClientNames) : []),
    [options]
  );

  function resetValues() {
    setYear("");
    setSiteId("");
    setProjectId("");
    setClientId("");
    setClientText("");
    setCategoryId("");
    setPaymentMethodId("");
    setItemName("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!options || selectedIds.length === 0) return;
    setError(null);
    const fd = new FormData();
    selectedIds.forEach((id) => fd.append("transaction_ids", id));
    let valueLabel: string | null = null;
    if (field === "project") {
      fd.set("project_id", projectId);
      valueLabel = options.projectNodes.find((p) => p.id === projectId)?.name ?? null;
    } else if (field === "client") {
      const picked = resolveBulkClient(options.clients, clientId, clientText);
      fd.set("client_id", picked.clientId);
      fd.set("client_name_raw", picked.clientNameRaw);
      valueLabel = picked.label;
    } else if (field === "category") {
      fd.set("category_id", categoryId);
      valueLabel = options.categories.find((c) => c.id === categoryId)?.name ?? null;
    } else if (field === "payment_method") {
      fd.set("payment_method_id", paymentMethodId);
      valueLabel = options.paymentMethods.find((pm) => pm.id === paymentMethodId)?.name ?? null;
    } else {
      fd.set("item_name", itemName);
      valueLabel = itemName;
    }

    if (beforeSubmit && !(await beforeSubmit(field))) return;
    if (
      confirmEachChange &&
      !(await confirm(bulkChangeConfirmText(selectedIds.length, field, valueLabel), { confirmLabel: "바꾸기" }))
    ) {
      return;
    }
    const result = await pending.run(() => ACTIONS[field](fd));
    if (result?.error) {
      setError(result.error);
      return;
    }
    resetValues();
    setField("project");
    onDone();
  }

  const loading = !options && !optionsError;

  return (
    <div className="space-y-1 print:hidden">
      <Card padding="none" className="flex flex-wrap items-center gap-2 border-slate-300 bg-slate-50 p-3">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600">{selectedIds.length.toLocaleString("ko-KR")}건 선택됨 · 항목 변경:</span>
          <select
            value={field}
            onChange={(e) => {
              setField(e.target.value as BulkField);
              resetValues();
            }}
            aria-label="바꿀 항목"
            className={inlineFieldClass}
          >
            {BULK_FIELDS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          {loading && <span className="text-xs text-slate-500">목록 불러오는 중…</span>}

          {options && field === "project" && (
            <>
              <select
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  setSiteId("");
                  setProjectId("");
                }}
                aria-label="프로젝트 연도"
                className={inlineFieldClass}
              >
                <option value="">연도 선택</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
              <select
                value={siteId}
                onChange={(e) => {
                  setSiteId(e.target.value);
                  setProjectId("");
                }}
                aria-label="현장"
                className={inlineFieldClass}
                disabled={!year}
              >
                <option value="">현장 선택</option>
                {sites.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                aria-label="프로젝트"
                className={inlineFieldClass}
              >
                <option value="">일반경비</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </>
          )}

          {options && field === "client" && (
            <>
              <select
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setClientText(options.clients.find((c) => c.id === e.target.value)?.name ?? "");
                }}
                aria-label="등록 거래처"
                className={inlineFieldClass}
              >
                <option value="">등록 거래처 선택</option>
                {options.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                value={clientText}
                onChange={(e) => {
                  setClientText(e.target.value);
                  setClientId(options.clients.find((c) => c.name === e.target.value.trim())?.id ?? "");
                }}
                list={datalistId}
                placeholder="또는 거래처 이름 직접 입력"
                aria-label="거래처 이름"
                className={`${inlineFieldClass} w-60`}
              />
              <datalist id={datalistId}>
                {clientNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </>
          )}

          {options && field === "category" && (
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              aria-label="카테고리"
              className={inlineFieldClass}
            >
              <option value="">선택 안함</option>
              {options.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {options && field === "payment_method" && (
            <select
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              aria-label="결제방식"
              className={inlineFieldClass}
            >
              <option value="">선택 안함</option>
              {options.paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id} style={paymentMethodColorStyle(pm)}>
                  {pm.name}
                </option>
              ))}
            </select>
          )}

          {options && field === "item_name" && (
            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="새 품목명 입력"
              aria-label="새 품목명"
              className={`${inlineFieldClass} w-60`}
            />
          )}

          <Button type="submit" size="sm" disabled={!options}>
            변경
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              resetValues();
              setField("project");
              setError(null);
              onClear();
            }}
          >
            선택 해제
          </Button>
        </form>
        {children}
      </Card>
      {optionsError && <p className="text-sm text-red-600">선택 목록을 불러오지 못했습니다: {optionsError}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
