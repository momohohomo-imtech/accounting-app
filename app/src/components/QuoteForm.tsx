"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ProjectPicker, type ProjectOption, type SiteOption } from "@/components/ProjectPicker";
import { createQuote, updateQuote, fetchProjectPurchaseItems, type QuoteInput, type QuoteItemInput } from "@/lib/actions/quotes";
import { QUOTE_STATUS_OPTIONS } from "@/lib/quoteStatus";
import { formatWon } from "@/lib/format";
import { isVisibleQuoteItem, quoteLineAmounts } from "@/lib/quoteCalc";
import { Button } from "@/components/ui/Button";
import { labelClass } from "@/components/ui/field";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { MoneyInput } from "@/components/ui/MoneyInput";
import type { CompanyProfileRow } from "@/lib/companyProfile";
import { movedIndex, moveListItem } from "@/lib/listMove";

const LIST_HREF = "/projects?tab=quotes";

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

// 품목 순번 칸 — 숫자를 고치고 Enter(또는 칸 밖을 누름)하면 그 품목이 그 자리로 옮겨감(사용자 요청). 입력하는 동안에는 안
// 움직임("12"를 치다가 1번 자리로 갔다가 12번으로 가지 않게). Esc는 취소.
function SeqInput({ index, count, onMove }: { index: number; count: number; onMove: (from: number, to: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelRef = useRef(false);

  function commit() {
    const value = draft;
    setDraft(null);
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    const n = Math.floor(Number(value));
    if (!value || !Number.isFinite(n)) return;
    const to = Math.min(Math.max(n, 1), count) - 1;
    if (to !== index) onMove(index, to);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={`${index + 1}번 품목 순번`}
      title="순번 — 숫자를 바꾸고 Enter를 누르면 그 자리로 옮겨요"
      value={draft ?? String(index + 1)}
      onFocus={(e) => {
        setDraft(String(index + 1));
        e.currentTarget.select();
      }}
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          // 폼 제출(견적서 저장)로 가지 않게 — 옮기기는 칸을 벗어날 때(onBlur) 한 번만
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          cancelRef.current = true;
          e.currentTarget.blur();
        }
      }}
      className="w-[4ch] shrink-0 rounded border border-slate-200 px-0.5 py-1 text-center text-xs tabular-nums text-slate-600 focus:border-slate-500 focus:outline-none"
    />
  );
}

export function QuoteForm({
  clients,
  sites,
  projects,
  initial,
  initialItems,
  quoteId,
  supplierProfiles = [],
  heading,
}: {
  /** 화면 제목(h1) — 오른쪽에 "목록으로" 버튼이 같이 붙음. */
  heading: ReactNode;
  clients: ClientOption[];
  sites: SiteOption[];
  projects: ProjectOption[];
  /** 새 견적서 작성 때만 — 공급자 목록(기본 공급자가 맨 앞). 수정 화면은 아래 인쇄 영역에서 고름. */
  supplierProfiles?: CompanyProfileRow[];
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
  const globalPending = useGlobalPending();
  const startValues = {
    title: initial?.title ?? "",
    client_id: initial?.client_id ?? "",
    client_name_raw: initial?.client_name_raw ?? "",
    project_id: initial?.project_id ?? "",
    status: initial?.status ?? "draft",
    valid_until: initial?.valid_until ?? "",
    memo: initial?.memo ?? "",
    target_amount: initial?.target_amount != null ? String(initial.target_amount) : "",
  };
  const startItems = initialItems?.length ? initialItems : [emptyItem()];
  const [values, setValues] = useState(startValues);
  const [items, setItems] = useState<QuoteItemInput[]>(startItems);
  // "목록으로"를 누를 때 저장 안 한 내용이 있는지 보려고 마지막으로 저장한(또는 처음) 상태를 기억.
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify([startValues, startItems]));
  const [savedNotice, setSavedNotice] = useState(false);
  useEffect(() => {
    if (!savedNotice) return;
    const t = setTimeout(() => setSavedNotice(false), 4000);
    return () => clearTimeout(t);
  }, [savedNotice]);
  const [supplierId, setSupplierId] = useState(
    () => (supplierProfiles.find((p) => p.is_default) ?? supplierProfiles[0])?.id ?? ""
  );
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

  // 순번 칸에서 고친 자리로 옮김 — 체크 표시(묶기용)도 그 품목을 따라감.
  function moveItem(from: number, to: number) {
    const length = items.length;
    setItems((prev) => moveListItem(prev, from, to));
    setSelected((prev) => new Set(Array.from(prev, (i) => movedIndex(i, from, to, length))));
  }

  // 들어오기 전 화면(견적서 목록)으로 — 브라우저 뒤로 가기와 같게 돌아가서 목록의 스크롤 위치도 그대로. 이 화면을 주소로
  // 바로 연 경우(돌아갈 곳 없음)만 목록을 새로 엶. 저장 안 한 내용이 있으면 먼저 물어봄.
  async function goBack() {
    if (
      JSON.stringify([values, items]) !== savedSnapshot &&
      !(await confirm("저장하지 않은 내용이 있습니다. 저장하지 않고 나가시겠습니까?"))
    ) {
      return;
    }
    if (window.history.length > 1) router.back();
    else router.push(LIST_HREF, { scroll: false });
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
    .reduce((s, it) => s + quoteLineAmounts(it).confirmed, 0);
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
    if (quoteId) {
      const result = await globalPending.run(() => updateQuote(quoteId, input));
      setPending(false);
      if (result?.error) {
        setError(result.error);
        return;
      }
      // 같은 화면에 그대로 있으면서 아래 인쇄 미리보기만 새로 고침. 예전엔 같은 주소로 한 번 더 이동해서 방문 기록이
      // 저장할 때마다 쌓였고, 뒤로 가기를 눌러도 같은 화면만 나와서 목록으로 못 돌아갔음(사용자 제보).
      setSavedSnapshot(JSON.stringify([values, items]));
      setSavedNotice(true);
      router.refresh();
      return;
    }
    const result = await globalPending.run(() => createQuote(input, supplierId || null));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    // 작성 화면을 수정 화면으로 "바꿔치기" — 뒤로 가기를 누르면 빈 작성 화면이 아니라 목록으로 돌아감.
    router.replace(result?.id ? `/quotes/${result.id}/edit` : LIST_HREF);
  }

  const inputClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
  const compactInputClass = "rounded-lg border border-slate-300 px-1.5 py-1.5 text-xs focus:border-slate-500 focus:outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
        <Button type="button" variant="secondary" size="sm" onClick={goBack}>
          ← 목록으로
        </Button>
      </div>
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
        {!quoteId && supplierProfiles.length > 0 && (
          <div className="flex flex-col gap-1">
            <label htmlFor="quote-supplier" className={labelClass}>
              공급자 (견적서에 찍히는 우리 회사)
            </label>
            <select
              id="quote-supplier"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className={inputClass}
            >
              {supplierProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.company_name}
                  {p.biz_reg_no ? ` (${p.biz_reg_no})` : ""}
                  {p.is_default ? " · 기본" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
          <label className={labelClass}>메모</label>
          <textarea value={values.memo} onChange={(e) => set("memo", e.target.value)} rows={2} className={inputClass} />
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>목표 견적금액 (내부용, 100원 단위)</label>
            <MoneyInput
              value={values.target_amount}
              onValueChange={(v) => set("target_amount", v)}
              onBlur={() => {
                if (!values.target_amount) return;
                const rounded = Math.round(Number(values.target_amount) / 100) * 100;
                set("target_amount", String(rounded));
              }}
              placeholder="목표 금액"
              className={`${inputClass} w-40`}
            />
            {targetAmountNum !== null && (
              <span className="tabular-nums text-xs text-slate-500">{formatWon(targetAmountNum)}</span>
            )}
          </div>
          <p className="text-sm text-slate-600">
            현재 견적액 <span className="tabular-nums font-semibold text-slate-900">{formatWon(total)}</span>
          </p>
          {diff !== null && (
            <p className="text-sm text-slate-600">
              차액{" "}
              <span className={`tabular-nums font-semibold ${diff >= 0 ? "text-brand" : "text-red-600"}`}>
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
              <MoneyInput
                allowDecimal
                value={groupUnitPrice}
                onValueChange={setGroupUnitPrice}
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
              <span className="tabular-nums font-semibold text-slate-900">
                {formatWon(
                  quoteLineAmounts({
                    amount: (Number(groupUnitPrice) || 0) * (Number(groupQuantity) || 1),
                    unit_price: Number(groupUnitPrice) || 0,
                    quantity: Number(groupQuantity) || 1,
                    handling_fee_pct: Number(groupFeePct) || 0,
                  }).confirmed
                )}
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
          {/* 칸 폭: 규격("SS400 t6"·"M12×100")이 5ch라 "SS4"처럼 잘리고 수량·fee%는 남아서 10/7/6ch로 나눔(아래 입력칸과 같이) */}
          <div className="hidden items-center gap-1.5 whitespace-nowrap px-1 text-[11px] font-medium text-slate-500 sm:flex">
            <span className="w-4" />
            <span className="w-[4ch] text-center">No</span>
            <span className="w-[20ch]">품명</span>
            <span className="w-[10ch]">규격</span>
            <span className="w-[6ch]">단위</span>
            <span className="w-[6ch] text-center">fee%</span>
            <span className="w-[7ch]">수량</span>
            <span className="w-[15ch]">단가</span>
            <span className="w-[20ch]">금액</span>
            <span className="w-[9ch] text-right">확정금액</span>
            <span className="flex-1">비고</span>
            <span className="w-8" />
          </div>
          {items.map((it, i) => {
            const { confirmed } = quoteLineAmounts(it);
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
                <SeqInput index={i} count={items.length} onMove={moveItem} />
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
                  className={`${compactInputClass} w-[10ch]`}
                />
                <input
                  value={it.unit}
                  onChange={(e) => updateItem(i, { unit: e.target.value })}
                  placeholder="단위"
                  className={`${compactInputClass} w-[6ch]`}
                />
                <input
                  type="number"
                  value={it.handling_fee_pct || ""}
                  onChange={(e) => updateItem(i, { handling_fee_pct: Number(e.target.value) || 0 })}
                  placeholder="0"
                  title="핸들링fee %"
                  className={`${compactInputClass} w-[6ch]`}
                />
                <input
                  type="number"
                  value={it.quantity ?? ""}
                  onChange={(e) => handleQuantity(i, e.target.value)}
                  placeholder="수량"
                  className={`${compactInputClass} w-[7ch]`}
                />
                <MoneyInput
                  allowDecimal
                  value={it.unit_price ?? ""}
                  onValueChange={(v) => handleUnitPrice(i, v)}
                  placeholder="단가"
                  className={`${compactInputClass} w-[15ch]`}
                />
                <MoneyInput
                  allowDecimal
                  value={it.amount || ""}
                  onValueChange={(v) => updateItem(i, { amount: Number(v) || 0 })}
                  placeholder="금액"
                  className={`${compactInputClass} w-[20ch]`}
                />
                <span className="w-[9ch] shrink-0 text-right tabular-nums text-xs text-slate-600">{formatWon(confirmed)}</span>
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
          No(순번) 숫자를 바꾸고 Enter를 누르면 그 품목이 그 자리로 옮겨가요(예: 5 → 1이면 맨 위로).
          fee%(핸들링fee)는 견적 작성 화면에서만 보이고 인쇄·엑셀·PDF에는 나타나지 않아요 — 확정금액에만 반영됩니다.
          체크박스로 여러 품목을 선택해 하나로 묶으면, 묶인 원본 항목은 이 화면에서만 참고용으로 보이고 인쇄·엑셀·PDF엔
          묶음 대표 행 하나만 나가요.
        </p>

        <p className="mt-3 text-right text-sm font-semibold text-slate-900">
          합계(확정금액) <span className="ml-1 tabular-nums text-base">{formatWon(total)}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {quoteId ? "수정 저장" : "견적서 등록"}
        </Button>
        <Button type="button" variant="secondary" onClick={goBack}>
          {quoteId ? "목록으로" : "취소"}
        </Button>
        {savedNotice && (
          <span role="status" className="text-sm text-emerald-700">
            저장했습니다.
          </span>
        )}
      </div>
    </form>
  );
}
