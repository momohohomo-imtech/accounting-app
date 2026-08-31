"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectPicker, type ProjectOption, type SiteOption } from "@/components/ProjectPicker";
import { createQuote, updateQuote, fetchProjectPurchaseItems, type QuoteInput, type QuoteItemInput } from "@/lib/actions/quotes";
import { QUOTE_STATUS_OPTIONS } from "@/lib/quoteStatus";
import { formatWon } from "@/lib/format";
import { computeConfirmedAmount, isVisibleQuoteItem } from "@/lib/quoteCalc";
import { Button } from "@/components/ui/Button";
import { labelClass } from "@/components/ui/field";
import { useConfirm } from "@/components/ConfirmProvider";

type ClientOption = { id: string; name: string };

function emptyItem(): QuoteItemInput {
  return {
    item_name: "",
    spec: "",
    quantity: null,
    unit_price: null,
    amount: 0,
    handling_fee_pct: 0,
    note: "",
    unit: "",
    group_label: null,
    is_group_summary: false,
  };
}

function newGroupId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `group-${Date.now()}-${Math.random()}`;
}

export function QuoteForm({
  clients,
  sites,
  projects,
  initial,
  initialItems,
  quoteId,
}: {
  clients: ClientOption[];
  sites: SiteOption[];
  projects: ProjectOption[];
  initial?: {
    title: string;
    client_id: string | null;
    client_name_raw: string | null;
    project_id: string | null;
    status: string;
    valid_until: string | null;
    memo: string | null;
    target_amount: number | null;
  };
  initialItems?: QuoteItemInput[];
  quoteId?: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [values, setValues] = useState({
    title: initial?.title ?? "",
    client_id: initial?.client_id ?? "",
    client_name_raw: initial?.client_name_raw ?? "",
    project_id: initial?.project_id ?? "",
    status: initial?.status ?? "draft",
    valid_until: initial?.valid_until ?? "",
    memo: initial?.memo ?? "",
    target_amount: initial?.target_amount != null ? String(initial.target_amount) : "",
  });
  const [items, setItems] = useState<QuoteItemInput[]>(initialItems?.length ? initialItems : [emptyItem()]);
  const [pending, setPending] = useState(false);
  const [loadingFromProject, setLoadingFromProject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [grouping, setGrouping] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupUnit, setGroupUnit] = useState("");
  const [groupFeePct, setGroupFeePct] = useState("0");
  const [groupUnitPrice, setGroupUnitPrice] = useState("");
  const [groupQuantity, setGroupQuantity] = useState("1");

  function set<K extends keyof typeof values>(key: K, v: (typeof values)[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function updateItem(i: number, patch: Partial<QuoteItemInput>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function handleQuantity(i: number, v: string) {
    const quantity = v ? Number(v) : null;
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== i) return it;
        const next = { ...it, quantity };
        if (quantity && it.unit_price) next.amount = quantity * it.unit_price;
        return next;
      })
    );
  }

  function handleUnitPrice(i: number, v: string) {
    const unit_price = v ? Number(v) : null;
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== i) return it;
        const next = { ...it, unit_price };
        if (it.quantity && unit_price) next.amount = it.quantity * unit_price;
        return next;
      })
    );
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(i);
      return next;
    });
  }

  function toggleSelect(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function startGrouping() {
    const sum = Array.from(selected).reduce((s, i) => s + (items[i]?.amount || 0), 0);
    setGroupName("");
    setGroupUnit("");
    setGroupFeePct("0");
    setGroupUnitPrice(String(sum));
    setGroupQuantity("1");
    setGrouping(true);
  }

  function cancelGrouping() {
    setGrouping(false);
    setSelected(new Set());
  }

  function confirmGrouping() {
    if (!groupName.trim() || selected.size < 2) return;
    const groupId = newGroupId();
    const unitPriceNum = Number(groupUnitPrice) || 0;
    const quantityNum = Number(groupQuantity) || 1;
    setItems((prev) => {
      const next = prev.map((it, idx) => (selected.has(idx) ? { ...it, group_label: groupId } : it));
      next.push({
        item_name: groupName,
        spec: "",
        quantity: quantityNum,
        unit_price: unitPriceNum,
        amount: unitPriceNum * quantityNum,
        handling_fee_pct: Number(groupFeePct) || 0,
        note: "",
        unit: groupUnit,
        group_label: groupId,
        is_group_summary: true,
      });
      return next;
    });
    setGrouping(false);
    setSelected(new Set());
  }

  function ungroup(groupLabel: string) {
    setItems((prev) =>
      prev
        .filter((it) => !(it.group_label === groupLabel && it.is_group_summary))
        .map((it) => (it.group_label === groupLabel ? { ...it, group_label: null } : it))
    );
  }

  async function loadFromProject() {
    if (!values.project_id) return;
    if (items.some((it) => it.item_name || it.amount) && !(await confirm("지금 입력된 품목을 지우고 이 프로젝트의 매입/대행구매 내역으로 채우시겠습니까?"))) return;
    setLoadingFromProject(true);
    const loaded = await fetchProjectPurchaseItems(values.project_id);
    setLoadingFromProject(false);
    if (loaded.length === 0) {
      setError("이 프로젝트에 매입/대행구매 내역이 없습니다.");
      return;
    }
    setItems(loaded);
    setSelected(new Set());
  }

  const total = items
    .filter(isVisibleQuoteItem)
    .reduce((s, it) => s + computeConfirmedAmount(it.amount || 0, it.handling_fee_pct || 0), 0);
  const targetAmountNum = values.target_amount ? Number(values.target_amount) : null;
  const diff = targetAmountNum !== null ? targetAmountNum - total : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    if (!(await confirm(quoteId ? "수정 내용을 저장하시겠습니까?" : "견적서를 등록하시겠습니까?"))) return;

    setError(null);
    setPending(true);
    const input: QuoteInput = {
      title: values.title,
      client_id: values.client_id || null,
      client_name_raw: values.client_name_raw || null,
      project_id: values.project_id || null,
      status: values.status,
      valid_until: values.valid_until || null,
      memo: values.memo || null,
      target_amount: values.target_amount ? Number(values.target_amount) : null,
      items,
    };
    let targetId = quoteId;
    if (quoteId) {
      const result = await updateQuote(quoteId, input);
      setPending(false);
      if (result?.error) {
        setError(result.error);
        return;
      }
    } else {
      const result = await createQuote(input);
      setPending(false);
      if (result?.error) {
        setError(result.error);
        return;
      }
      targetId = result?.id;
    }
    router.push(targetId ? `/quotes/${targetId}/edit` : "/projects?tab=quotes");
    router.refresh();
  }

  const inputClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
  const compactInputClass = "rounded-lg border border-slate-300 px-1.5 py-1.5 text-xs focus:border-slate-500 focus:outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1 lg:col-span-2">
          <label className={labelClass}>제목 *</label>
          <input
            required
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="예: 컨베이어 구동부 교체 견적"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>상태</label>
          <select value={values.status} onChange={(e) => set("status", e.target.value)} className={inputClass}>
            {QUOTE_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>거래처 (등록됨)</label>
          <select value={values.client_id} onChange={(e) => set("client_id", e.target.value)} className={inputClass}>
            <option value="">선택 안함</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>거래처 (자유 입력)</label>
          <input
            value={values.client_name_raw}
            onChange={(e) => set("client_name_raw", e.target.value)}
            placeholder="등록 안 된 거래처면 직접 입력"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>유효기한</label>
          <input type="date" value={values.valid_until} onChange={(e) => set("valid_until", e.target.value)} className={inputClass} />
        </div>
        <ProjectPicker
          sites={sites}
          projects={projects}
          value={values.project_id}
          onChange={(v) => set("project_id", v)}
          label="연결 프로젝트 (선택)"
          emptyLabel="연결 프로젝트 없음"
        />
        <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
          <label className={labelClass}>메모</label>
          <textarea value={values.memo} onChange={(e) => set("memo", e.target.value)} rows={2} className={inputClass} />
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>목표 견적금액 (내부용, 100원 단위)</label>
            <input
              type="number"
              step={100}
              value={values.target_amount}
              onChange={(e) => set("target_amount", e.target.value)}
              onBlur={(e) => {
                if (!e.target.value) return;
                const rounded = Math.round(Number(e.target.value) / 100) * 100;
                set("target_amount", String(rounded));
              }}
              placeholder="목표 금액"
              className={`${inputClass} w-40`}
            />
            {targetAmountNum !== null && (
              <span className="font-mono text-xs text-slate-500">{formatWon(targetAmountNum)}</span>
            )}
          </div>
          <p className="text-sm text-slate-600">
            현재 견적액 <span className="font-mono font-semibold text-slate-900">{formatWon(total)}</span>
          </p>
          {diff !== null && (
            <p className="text-sm text-slate-600">
              차액{" "}
              <span className={`font-mono font-semibold ${diff >= 0 ? "text-blue-600" : "text-red-600"}`}>
                {diff >= 0 ? "+" : ""}
                {formatWon(diff)}
              </span>
            </p>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-400">이 영역은 작성 화면 참고용이라 인쇄·엑셀·PDF에는 안 보여요.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">품목</h2>
          <div className="flex items-center gap-2">
            {selected.size >= 2 && (
              <Button type="button" size="sm" onClick={startGrouping}>
                선택 {selected.size}개 묶기
              </Button>
            )}
            {values.project_id && (
              <Button type="button" variant="secondary" size="sm" disabled={loadingFromProject} onClick={loadFromProject}>
                {loadingFromProject ? "불러오는 중..." : "이 프로젝트 매입/대행구매 내역 불러오기"}
              </Button>
            )}
            <button
              type="button"
              onClick={addItem}
              className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
            >
              + 품목 추가
            </button>
          </div>
        </div>

        {grouping && (
          <div className="mb-3 space-y-2 rounded-lg border border-dashed border-brand bg-brand-soft p-3">
            <p className="text-xs font-semibold text-slate-700">선택한 {selected.size}개 품목을 하나로 묶기</p>
            <div className="flex flex-wrap gap-2">
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="그룹 품명 (예: 자재비용)"
                className={`${inputClass} w-48`}
              />
              <input value={groupUnit} onChange={(e) => setGroupUnit(e.target.value)} placeholder="단위 (예: lot)" className={`${inputClass} w-28`} />
              <input
                type="number"
                value={groupQuantity}
                onChange={(e) => setGroupQuantity(e.target.value)}
                placeholder="수량"
                className={`${inputClass} w-24`}
              />
              <input
                type="number"
                value={groupUnitPrice}
                onChange={(e) => setGroupUnitPrice(e.target.value)}
                placeholder="단가 (기본: 선택 항목 금액 합)"
                className={`${inputClass} w-40`}
              />
              <input
                type="number"
                value={groupFeePct}
                onChange={(e) => setGroupFeePct(e.target.value)}
                placeholder="fee%"
                className={`${inputClass} w-20`}
              />
            </div>
            <p className="text-xs text-slate-500">
              확정금액 미리보기{" "}
              <span className="font-mono font-semibold text-slate-900">
                {formatWon(computeConfirmedAmount((Number(groupUnitPrice) || 0) * (Number(groupQuantity) || 1), Number(groupFeePct) || 0))}
              </span>
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={!groupName.trim()} onClick={confirmGrouping}>
                묶기 확정
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={cancelGrouping}>
                취소
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-1.5 overflow-x-auto">
          <div className="hidden items-center gap-1.5 whitespace-nowrap px-1 text-[11px] font-medium text-slate-500 sm:flex">
            <span className="w-4" />
            <span className="w-[3ch] text-center">No</span>
            <span className="w-[20ch]">품명</span>
            <span className="w-[5ch]">규격</span>
            <span className="w-[10ch] text-center">fee%</span>
            <span className="w-[10ch]">수량</span>
            <span className="w-[15ch]">단가</span>
            <span className="w-[20ch]">금액</span>
            <span className="w-[9ch] text-right">확정금액</span>
            <span className="flex-1">비고</span>
            <span className="w-8" />
          </div>
          {items.map((it, i) => {
            const confirmed = computeConfirmedAmount(it.amount || 0, it.handling_fee_pct || 0);
            const isHiddenMember = Boolean(it.group_label) && !it.is_group_summary;
            return (
              <div
                key={i}
                className={`flex flex-wrap items-center gap-1.5 ${isHiddenMember ? "opacity-50" : ""} ${
                  it.is_group_summary ? "rounded-lg bg-brand-soft p-1" : ""
                }`}
              >
                <span className="w-4 shrink-0">
                  {!it.group_label && (
                    <input type="checkbox" checked={selected.has(i)} onChange={() => toggleSelect(i)} className="h-3.5 w-3.5" />
                  )}
                </span>
                <span className="w-[3ch] shrink-0 text-center text-xs text-slate-400">{i + 1}</span>
                <input
                  value={it.item_name}
                  onChange={(e) => updateItem(i, { item_name: e.target.value })}
                  placeholder="품명"
                  className={`${compactInputClass} w-[20ch]`}
                />
                <input
                  value={it.spec}
                  onChange={(e) => updateItem(i, { spec: e.target.value })}
                  placeholder="규격"
                  className={`${compactInputClass} w-[5ch]`}
                />
                <input
                  type="number"
                  value={it.handling_fee_pct || ""}
                  onChange={(e) => updateItem(i, { handling_fee_pct: Number(e.target.value) || 0 })}
                  placeholder="0"
                  title="핸들링fee %"
                  className={`${compactInputClass} w-[10ch]`}
                />
                <input
                  type="number"
                  value={it.quantity ?? ""}
                  onChange={(e) => handleQuantity(i, e.target.value)}
                  placeholder="수량"
                  className={`${compactInputClass} w-[10ch]`}
                />
                <input
                  type="number"
                  value={it.unit_price ?? ""}
                  onChange={(e) => handleUnitPrice(i, e.target.value)}
                  placeholder="단가"
                  className={`${compactInputClass} w-[15ch]`}
                />
                <input
                  type="number"
                  value={it.amount || ""}
                  onChange={(e) => updateItem(i, { amount: Number(e.target.value) || 0 })}
                  placeholder="금액"
                  className={`${compactInputClass} w-[20ch]`}
                />
                <span className="w-[9ch] shrink-0 text-right font-mono text-xs text-slate-600">{formatWon(confirmed)}</span>
                <input
                  value={it.note}
                  onChange={(e) => updateItem(i, { note: e.target.value })}
                  placeholder="비고"
                  className={`${compactInputClass} min-w-[10ch] flex-1`}
                />
                {isHiddenMember && <span className="shrink-0 text-[10px] text-slate-400">묶임</span>}
                {it.is_group_summary && it.group_label && (
                  <button
                    type="button"
                    onClick={() => ungroup(it.group_label as string)}
                    className="shrink-0 text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                  >
                    묶음 해제
                  </button>
                )}
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="shrink-0 text-xs text-red-500 hover:text-red-700">
                    삭제
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-slate-400">
          fee%(핸들링fee)는 견적 작성 화면에서만 보이고 인쇄·엑셀·PDF에는 나타나지 않아요 — 확정금액에만 반영됩니다.
          체크박스로 여러 품목을 선택해 하나로 묶으면, 묶인 원본 항목은 이 화면에서만 참고용으로 보이고 인쇄·엑셀·PDF엔
          묶음 대표 행 하나만 나가요.
        </p>

        <p className="mt-3 text-right text-sm font-semibold text-slate-900">
          합계(확정금액) <span className="ml-1 font-mono text-base">{formatWon(total)}</span>
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {quoteId ? "수정 저장" : "견적서 등록"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/projects?tab=quotes")}>
          취소
        </Button>
      </div>
    </form>
  );
}
