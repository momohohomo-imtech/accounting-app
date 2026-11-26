"use client";

import { useMemo, useState, type ReactNode } from "react";
import { bulkUpdateTransactionFields } from "@/lib/actions/transactions";
import {
  bulkChangesConfirmText,
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
import { cx } from "@/lib/cx";

// 고르는 칸의 특별한 값 — "그대로"(안 바꿈)·"비우기"(거래처)·"직접 입력한 이름"(거래처)
const KEEP = "__keep";
const CLEAR = "__clear";
const RAW = "__raw";

let datalistSeq = 0;

type PendingChange = { field: BulkField; label: string | null; apply: (fd: FormData) => void };

// 한 줄 — 왼쪽 칸 이름(바꿀 칸이면 진하게 + ✓), 오른쪽 고르는 칸(휴대폰에서 줄이 넘어가도 오른쪽 칸 안에서만)
function BulkRow({ label, changed, children }: { label: string; changed: boolean; children: ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-[4.75rem_minmax(0,1fr)] items-start gap-x-2">
      <span className={cx("pt-2 text-xs", changed ? "font-semibold text-brand" : "text-slate-500")}>
        {label}
        {changed && " ✓"}
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

// 거래 일괄 변경 칸(11/11 — 매입매출장에 있던 것을 떼어 보고서 내역 표에서도 씀): 체크한 거래의 프로젝트·거래처·카테고리·결제방식·
// 세금계산서·품목 중 바꿀 칸만 골라 한 번에(11/26 사용자 요청 "카테고리·거래처 이름·결제수단·세금계산서 발행을 같이 수정" — 예전엔 고르는
// 칸에서 한 항목씩이라 다른 칸이 있는 줄 몰랐음). 고르지 않은 칸("그대로")은 안 바뀜, 금액·날짜는 안 바뀜. options가 null이면 목록을
// 불러오는 중(보고서는 체크했을 때 불러옴 — ReportBulkEditBar). confirmEachChange면 바꾸기 전에 바꿀 칸을 한 줄씩 보여 주고 확인(보고서),
// beforeSubmit은 매입매출장의 묶음 확인. 계산은 lib/transactionBulkEdit.ts, 저장은 bulkUpdateTransactionFields 한 번.
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
  beforeSubmit?: (fields: BulkField[]) => Promise<boolean>;
  onDone: () => void;
  onClear: () => void;
  // 오른쪽에 붙는 버튼(매입매출장의 챙길 거래·한 결제로 묶기·묶음 풀기)
  children?: ReactNode;
}) {
  const pending = useGlobalPending();
  const confirm = useConfirm();
  const [year, setYear] = useState("");
  const [siteId, setSiteId] = useState("");
  const [projectChoice, setProjectChoice] = useState(KEEP); // KEEP · ""(일반경비) · 프로젝트 id
  const [clientChoice, setClientChoice] = useState(KEEP); // KEEP · CLEAR · RAW · 거래처 id
  const [clientText, setClientText] = useState("");
  const [categoryChoice, setCategoryChoice] = useState(KEEP); // KEEP · ""(선택 안함) · 카테고리 id
  const [paymentChoice, setPaymentChoice] = useState(KEEP); // KEEP · ""(선택 안함) · 결제수단 id
  const [invoiceChoice, setInvoiceChoice] = useState(KEEP); // KEEP · "1"(발행) · "0"(미발행)
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
    setProjectChoice(KEEP);
    setClientChoice(KEEP);
    setClientText("");
    setCategoryChoice(KEEP);
    setPaymentChoice(KEEP);
    setInvoiceChoice(KEEP);
    setItemName("");
  }

  // 지금 고른 바꿀 칸들 — 화면 글자(확인창)와 폼 값
  function pendingChanges(): PendingChange[] {
    if (!options) return [];
    const list: PendingChange[] = [];
    if (projectChoice !== KEEP) {
      const project = projectChoice;
      list.push({
        field: "project",
        label: project ? (options.projectNodes.find((p) => p.id === project)?.name ?? null) : null,
        apply: (fd) => fd.set("project_id", project),
      });
    }
    const text = clientText.trim();
    if (text) {
      const picked = resolveBulkClient(options.clients, clientChoice.startsWith("__") ? "" : clientChoice, text);
      list.push({
        field: "client",
        label: picked.label,
        apply: (fd) => {
          fd.set("client_id", picked.clientId);
          fd.set("client_name_raw", picked.clientNameRaw);
        },
      });
    } else if (clientChoice === CLEAR) {
      list.push({
        field: "client",
        label: null,
        apply: (fd) => {
          fd.set("client_id", "");
          fd.set("client_name_raw", "");
        },
      });
    }
    if (categoryChoice !== KEEP) {
      const category = categoryChoice;
      list.push({
        field: "category",
        label: category ? (options.categories.find((c) => c.id === category)?.name ?? null) : null,
        apply: (fd) => fd.set("category_id", category),
      });
    }
    if (paymentChoice !== KEEP) {
      const method = paymentChoice;
      list.push({
        field: "payment_method",
        label: method ? (options.paymentMethods.find((pm) => pm.id === method)?.name ?? null) : null,
        apply: (fd) => fd.set("payment_method_id", method),
      });
    }
    if (invoiceChoice !== KEEP) {
      const invoice = invoiceChoice;
      list.push({
        field: "tax_invoice",
        label: invoice === "1" ? "발행" : "미발행",
        apply: (fd) => fd.set("tax_invoice_issued", invoice),
      });
    }
    const item = itemName.trim();
    if (item) list.push({ field: "item_name", label: item, apply: (fd) => fd.set("item_name", item) });
    return list;
  }

  const changes = pendingChanges();
  const changing = new Set(changes.map((c) => c.field));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!options || selectedIds.length === 0) return;
    if (changes.length === 0) {
      setError("바꿀 칸을 하나 이상 고르세요(고르지 않은 칸은 그대로예요).");
      return;
    }
    setError(null);
    if (beforeSubmit && !(await beforeSubmit(changes.map((c) => c.field)))) return;
    if (
      confirmEachChange &&
      !(await confirm(bulkChangesConfirmText(selectedIds.length, changes), { confirmLabel: "바꾸기" }))
    ) {
      return;
    }
    const fd = new FormData();
    selectedIds.forEach((id) => fd.append("transaction_ids", id));
    changes.forEach((c) => c.apply(fd));
    const result = await pending.run(() => bulkUpdateTransactionFields(fd));
    if (result?.error) {
      setError(result.error);
      return;
    }
    resetValues();
    onDone();
  }

  const loading = !options && !optionsError;
  const keepOption = <option value={KEEP}>— 그대로 —</option>;

  return (
    <div className="space-y-1 print:hidden">
      <Card padding="none" className="border-slate-300 bg-slate-50 p-3">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-700">{selectedIds.length.toLocaleString("ko-KR")}건 선택됨</span>
            <span className="text-xs text-slate-500">바꿀 칸만 고르세요 — 고르지 않은 칸은 그대로(금액·날짜는 안 바뀜)</span>
            {loading && <span className="text-xs text-slate-500">목록 불러오는 중…</span>}
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              <Button type="submit" size="sm" disabled={!options || changes.length === 0}>
                {changes.length > 1 ? `${changes.length}칸 변경` : "변경"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetValues();
                  setError(null);
                  onClear();
                }}
              >
                선택 해제
              </Button>
              {children}
            </div>
          </div>

          {options && (
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 xl:grid-cols-2">
              <BulkRow label="프로젝트" changed={changing.has("project")}>
                <select
                  value={year}
                  onChange={(e) => {
                    setYear(e.target.value);
                    setSiteId("");
                    if (projectChoice !== KEEP && projectChoice !== "") setProjectChoice(KEEP);
                  }}
                  aria-label="프로젝트 연도"
                  className={inlineFieldClass}
                >
                  <option value="">연도</option>
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
                    if (projectChoice !== KEEP && projectChoice !== "") setProjectChoice(KEEP);
                  }}
                  aria-label="현장"
                  className={inlineFieldClass}
                  disabled={!year}
                >
                  <option value="">현장</option>
                  {sites.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  value={projectChoice}
                  onChange={(e) => setProjectChoice(e.target.value)}
                  aria-label="프로젝트"
                  className={inlineFieldClass}
                >
                  {keepOption}
                  <option value="">일반경비(프로젝트 없음)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </BulkRow>

              <BulkRow label="거래처" changed={changing.has("client")}>
                <select
                  value={clientChoice}
                  onChange={(e) => {
                    const v = e.target.value;
                    setClientChoice(v);
                    setClientText(v === KEEP || v === CLEAR ? "" : (options.clients.find((c) => c.id === v)?.name ?? ""));
                  }}
                  aria-label="등록 거래처"
                  className={inlineFieldClass}
                >
                  {keepOption}
                  <option value={CLEAR}>(거래처 비우기)</option>
                  {clientChoice === RAW && <option value={RAW}>직접 입력: {clientText.trim()}</option>}
                  {options.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  value={clientText}
                  onChange={(e) => {
                    const v = e.target.value;
                    setClientText(v);
                    if (!v.trim()) setClientChoice(KEEP);
                    else setClientChoice(options.clients.find((c) => c.name === v.trim())?.id ?? RAW);
                  }}
                  list={datalistId}
                  placeholder="또는 이름 직접 입력"
                  aria-label="거래처 이름"
                  className={`${inlineFieldClass} w-44`}
                />
                <datalist id={datalistId}>
                  {clientNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </BulkRow>

              <BulkRow label="카테고리" changed={changing.has("category")}>
                <select
                  value={categoryChoice}
                  onChange={(e) => setCategoryChoice(e.target.value)}
                  aria-label="카테고리"
                  className={inlineFieldClass}
                >
                  {keepOption}
                  <option value="">선택 안함(비우기)</option>
                  {options.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </BulkRow>

              <BulkRow label="결제방식" changed={changing.has("payment_method")}>
                <select
                  value={paymentChoice}
                  onChange={(e) => setPaymentChoice(e.target.value)}
                  aria-label="결제방식"
                  className={inlineFieldClass}
                >
                  {keepOption}
                  <option value="">선택 안함(비우기)</option>
                  {options.paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id} style={paymentMethodColorStyle(pm)}>
                      {pm.name}
                    </option>
                  ))}
                </select>
              </BulkRow>

              <BulkRow label="세금계산서" changed={changing.has("tax_invoice")}>
                <select
                  value={invoiceChoice}
                  onChange={(e) => setInvoiceChoice(e.target.value)}
                  aria-label="세금계산서"
                  className={inlineFieldClass}
                >
                  {keepOption}
                  <option value="1">발행</option>
                  <option value="0">미발행</option>
                </select>
              </BulkRow>

              <BulkRow label="품목" changed={changing.has("item_name")}>
                <input
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="바꿀 때만 새 품목명"
                  aria-label="새 품목명"
                  className={`${inlineFieldClass} w-60`}
                />
              </BulkRow>
            </div>
          )}
        </form>
      </Card>
      {optionsError && <p className="text-sm text-red-600">선택 목록을 불러오지 못했습니다: {optionsError}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
