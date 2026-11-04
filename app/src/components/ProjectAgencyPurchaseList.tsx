"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addAgencyPurchase, updateAgencyPurchase, deleteAgencyPurchase } from "@/lib/actions/projectAgencyPurchases";
import { formatWon } from "@/lib/format";
import { resolveCategoryColor } from "@/lib/categoryColor";
import { Button } from "@/components/ui/Button";
import { fieldClass, inlineFieldClass } from "@/components/ui/field";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { useConfirm } from "@/components/ConfirmProvider";
import {
  DEFAULT_INTERMEDIARY_FEE,
  FEE_SETTINGS_STORAGE_KEY,
  feeItemLabel,
  feeRowCheck,
  intermediaryFeeAmount,
  intermediaryFeeRows,
  parseFeeSettings,
  roundFeePct,
  validFeePct,
  type IntermediaryFeeSettings,
} from "@/lib/intermediaryFee";

type Category = { id: string; name: string; project_only: boolean; color: string | null };
type AgencyPurchase = {
  id: string;
  item_name: string | null;
  amount: number;
  category_id: string | null;
  category_name: string | null;
  category_color?: string;
  memo: string | null;
  client_name: string | null;
};

type SortKey = "client" | "item" | "category" | "amount";

function sortValue(r: AgencyPurchase, key: SortKey): string | number {
  switch (key) {
    case "client":
      return r.client_name ?? "";
    case "item":
      return r.item_name ?? "";
    case "category":
      return r.category_name ?? "";
    case "amount":
      return r.amount;
  }
}

function CategorySelect({
  value,
  onChange,
  categories,
  name,
}: {
  value: string;
  onChange: (v: string) => void;
  categories: Category[];
  name?: string;
}) {
  return (
    <select name={name} value={value} onChange={(e) => onChange(e.target.value)} className={`${inlineFieldClass} w-32`}>
      <option value="">미분류</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id} style={{ color: resolveCategoryColor(c) }}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function AgencyRow({
  item,
  categories,
  clientNames,
  onChanged,
}: {
  item: AgencyPurchase;
  categories: Category[];
  clientNames: string[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [itemName, setItemName] = useState(item.item_name ?? "");
  const [amount, setAmount] = useState(String(item.amount));
  const [categoryId, setCategoryId] = useState(item.category_id ?? "");
  const [memo, setMemo] = useState(item.memo ?? "");
  const [clientName, setClientName] = useState(item.client_name ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const globalPending = useGlobalPending();

  async function save() {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.append("id", item.id);
    fd.append("item_name", itemName);
    fd.append("amount", amount);
    fd.append("category_id", categoryId);
    fd.append("memo", memo);
    fd.append("client_name", clientName);
    const result = await globalPending.run(() => updateAgencyPurchase(fd));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    onChanged();
  }

  async function remove() {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.append("id", item.id);
    const result = await globalPending.run(() => deleteAgencyPurchase(fd));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onChanged();
  }

  if (editing) {
    return (
      <tr className="border-b border-slate-100 last:border-0 align-top">
        <td className="py-2 pr-4"></td>
        <td className="py-2 pr-4">
          <input
            list={`agency-client-names-${item.id}`}
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="매입처"
            className={`${fieldClass} w-full`}
          />
          <datalist id={`agency-client-names-${item.id}`}>
            {clientNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </td>
        <td className="py-2 pr-4">
          <input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="품목명" className={`${fieldClass} w-full`} />
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="메모 (무슨 물품/사항인지)"
            className={`${fieldClass} mt-1 w-full text-xs`}
          />
        </td>
        <td className="py-2 pr-4">
          <CategorySelect value={categoryId} onChange={setCategoryId} categories={categories} />
        </td>
        <td className="py-2 pr-4 text-right">
          <MoneyInput
            value={amount}
            onValueChange={setAmount}
            placeholder="금액"
            className={`${fieldClass} w-full text-right`}
          />
        </td>
        <td className="py-2 pl-2 text-right print:hidden">
          <div className="flex justify-end gap-1">
            <Button size="xs" type="button" disabled={pending} onClick={save}>
              저장
            </Button>
            <Button variant="secondary" size="xs" type="button" disabled={pending} onClick={() => setEditing(false)}>
              취소
            </Button>
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2 pr-4 text-slate-600 print:py-0.5"></td>
      <td className="sticky-col truncate py-2 pr-4 text-slate-700 print:py-0.5" title={item.client_name ?? undefined}>{item.client_name ?? "-"}</td>
      <td className="py-2 pr-4 text-slate-700 print:py-0.5">
        <div className="truncate">{item.item_name ?? "-"}</div>
        {item.memo && <div className="truncate text-xs text-slate-500 print:text-[9px]">{item.memo}</div>}
      </td>
      <td
        title={item.category_name ?? "미분류"}
        className={`truncate py-2 pr-4 print:py-0.5 ${item.category_name ? "" : "text-red-600"}`}
        style={item.category_name ? { color: item.category_color } : undefined}
      >
        {item.category_name ?? "미분류"}
      </td>
      <td className="py-2 pr-4 text-right tabular-nums text-slate-900 print:py-0.5">{formatWon(item.amount)}</td>
      <td className="py-2 pl-2 text-right print:hidden">
        {confirmDelete ? (
          <div className="flex justify-end gap-1">
            <Button variant="danger" size="xs" type="button" disabled={pending} onClick={remove}>
              확인
            </Button>
            <Button variant="secondary" size="xs" type="button" onClick={() => setConfirmDelete(false)}>
              취소
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-1">
            <Button variant="secondary" size="xs" type="button" onClick={() => setEditing(true)}>
              수정
            </Button>
            <Button variant="danger" size="xs" type="button" onClick={() => setConfirmDelete(true)}>
              삭제
            </Button>
          </div>
        )}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

export function ProjectAgencyPurchaseList({
  projectId,
  items,
  categories,
  clientNames,
  quoteAmount,
}: {
  projectId: string;
  items: AgencyPurchase[];
  categories: Category[];
  clientNames: string[];
  /** 이 프로젝트의 발주액 — "+ 현대 수수료 20% 추가" 버튼이 쓰는 금액 기준(없으면 버튼 비활성) */
  quoteAmount?: number | null;
}) {
  const router = useRouter();
  const globalPending = useGlobalPending();
  const confirm = useConfirm();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [pending, setPending] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  // 추가에 성공하면 입력칸을 비우려고 폼을 새로 그림(금액칸 MoneyInput은 자체 상태라 form.reset()으로는 안 비워짐)
  const [addFormKey, setAddFormKey] = useState(0);

  const total = items.reduce((s, i) => s + i.amount, 0);

  const sorted = useMemo(() => {
    if (!sortKey) return items;
    const copy = [...items];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [items, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  // 중간 업체 수수료(lib/intermediaryFee.ts) — 발주액 × 비율을 설정한 거래처·카테고리 줄로(기본 현대기계·현대·20%, 버튼 설정에서 바꿈 —
  // 이 기기에 저장). 이미 수수료 줄이 있으면 확인창에서 알리고, 지금 발주액 기준 금액과 다르면(발주액을 바꾼 뒤 줄을 안 고친 경우) 알림 —
  // 줄 이름에 적힌 비율로 확인(비율 설정을 바꿔도 예전 비율로 넣은 줄에는 알림이 안 뜸).
  const [feeSettings, setFeeSettings] = useState<IntermediaryFeeSettings>(DEFAULT_INTERMEDIARY_FEE);
  const [editingFee, setEditingFee] = useState(false);
  useEffect(() => {
    // 저장소를 못 쓰는 브라우저(사생활 보호 모드 등)면 기본값 그대로
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 후 localStorage에서 저장된 버튼 설정을 1회 불러옴(SSR 시엔 값이 없어 하이드레이션 불일치 없음, EntityTable과 같은 방식)
      setFeeSettings(parseFeeSettings(window.localStorage.getItem(FEE_SETTINGS_STORAGE_KEY)));
    } catch {
      /* 기본값 */
    }
  }, []);
  function saveFeeSettings(next: IntermediaryFeeSettings) {
    setFeeSettings(next);
    setEditingFee(false);
    try {
      window.localStorage.setItem(FEE_SETTINGS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* 저장 못 하면 이번 화면에서만 */
    }
  }
  const feeLabel = feeItemLabel(feeSettings);
  const fee = intermediaryFeeAmount(quoteAmount, feeSettings.pct);
  const feeRows = intermediaryFeeRows(items, feeSettings);
  const feeCategory = categories.find((c) => c.name === feeSettings.categoryName);
  const feeCheck = feeRows.length === 1 ? feeRowCheck(feeRows[0], quoteAmount, feeSettings.pct) : null;

  async function addIntermediaryFee() {
    if (fee <= 0) return;
    const notes = [
      feeRows.length > 0 && `이미 수수료 줄이 ${feeRows.length}개 있습니다(${feeRows.map((r) => formatWon(r.amount)).join(", ")}).`,
      !feeCategory && (feeSettings.categoryName ? `카테고리 "${feeSettings.categoryName}"가 없어 미분류로 들어갑니다.` : "미분류로 들어갑니다."),
    ].filter(Boolean);
    const ok = await confirm(
      `발주액 ${formatWon(quoteAmount ?? 0)}의 ${feeSettings.pct}%(${formatWon(fee)})를 거래처 "${feeSettings.clientName}"·품목 "${feeLabel}" 줄로 추가할까요?${
        notes.length ? `\n${notes.join("\n")}` : ""
      }`,
      { title: `${feeLabel} 추가`, confirmLabel: "추가" }
    );
    if (!ok) return;
    const fd = new FormData();
    fd.append("project_id", projectId);
    fd.append("client_name", feeSettings.clientName);
    fd.append("item_name", feeLabel);
    fd.append("category_id", feeCategory?.id ?? "");
    fd.append("amount", String(fee));
    fd.append("memo", `발주액 ${formatWon(quoteAmount ?? 0)} × ${feeSettings.pct}%`);
    setPending(true);
    setError(null);
    const result = await globalPending.run(() => addAgencyPurchase(fd));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  // onSubmit(form action 아님) — form action은 끝나면 입력칸을 비워서, 저장이 실패해도 적은 매입처·품목·금액이 사라졌음
  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const result = await globalPending.run(() => addAgencyPurchase(formData));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setNewCategoryId("");
    setAddFormKey((k) => k + 1);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 p-3 print:rounded-none print:border-0 print:p-0">
      <div className="mb-2 flex items-center justify-between print:mb-1">
        <p className="text-sm font-semibold text-slate-900 print:text-[10px]">대행구매액 (원청이 대신 구매해 공제한 품목)</p>
        <span className="tabular-nums text-sm text-slate-700 print:text-[10px]">합계 {formatWon(total)}</span>
      </div>

      {items.length > 0 ? (
        <div className="mb-2 overflow-x-auto">
          {/* 휴대폰에서는 거래처·카테고리 칸을 넓혀 덜 잘리게(표 전체를 옆으로 넘김), 인쇄는 원래 폭 그대로 */}
          <table className="sticky-col-table w-full min-w-[600px] table-fixed text-sm max-md:min-w-[720px] print:min-w-[600px] print:text-[10px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="w-[88px] pb-2 pr-4 print:pb-1">날짜</th>
                <th className="sticky-col w-[100px] pb-2 pr-4 max-md:w-[140px] print:w-[100px] print:pb-1">{headerButton("client", "거래처")}</th>
                <th className="pb-2 pr-4 print:pb-1">{headerButton("item", "품목")}</th>
                <th className="w-[90px] pb-2 pr-4 max-md:w-[120px] print:w-[90px] print:pb-1">{headerButton("category", "카테고리")}</th>
                <th className="w-[110px] pb-2 pr-4 text-right print:pb-1">{headerButton("amount", "금액")}</th>
                <th className="w-[110px] pb-2 text-right print:hidden">관리</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((it) => (
                <AgencyRow key={it.id} item={it} categories={categories} clientNames={clientNames} onChanged={() => router.refresh()} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mb-2 hidden text-sm text-slate-400 print:block">대행구매 내역이 없습니다.</p>
      )}

      {((feeCheck && !feeCheck.matches) || feeRows.length > 1) && (
        <p className="mb-2 text-xs text-amber-600 print:hidden">
          {feeCheck && !feeCheck.matches
            ? `수수료 줄 ${formatWon(feeRows[0].amount)} — 지금 발주액의 ${feeCheck.pct}%는 ${formatWon(feeCheck.expected)}입니다. 발주액을 바꿨으면 수수료 줄도 고쳐 주세요.`
            : `수수료 줄이 ${feeRows.length}개 있습니다 — 두 번 들어간 것이 아닌지 확인해 주세요.`}
        </p>
      )}

      {editingFee ? (
        <FeeSettingsEditor
          settings={feeSettings}
          categories={categories}
          clientNames={clientNames}
          onSave={saveFeeSettings}
          onCancel={() => setEditingFee(false)}
        />
      ) : (
        <div className="mb-2 flex flex-wrap justify-end gap-1 print:hidden">
          <Button
            type="button"
            variant="secondary"
            size="xs"
            disabled={pending || fee <= 0}
            title={fee <= 0 ? "발주액을 먼저 입력해 주세요" : undefined}
            onClick={addIntermediaryFee}
          >
            + {feeLabel} 추가
          </Button>
          <Button type="button" variant="secondary" size="xs" onClick={() => setEditingFee(true)} title="버튼 이름·비율 바꾸기">
            ✎ 버튼 설정
          </Button>
        </div>
      )}

      <form key={addFormKey} onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 print:hidden">
        <input type="hidden" name="project_id" value={projectId} />
        <input list="agency-client-names-new" name="client_name" placeholder="매입처 (자유 입력)" className={`${inlineFieldClass} w-36`} />
        <datalist id="agency-client-names-new">
          {clientNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <input name="item_name" placeholder="품목명" className={`${inlineFieldClass} w-40`} />
        <CategorySelect name="category_id" value={newCategoryId} onChange={setNewCategoryId} categories={categories} />
        <MoneyInput name="amount" placeholder="금액 (비워두면 0원)" className={`${inlineFieldClass} w-36`} />
        <input name="memo" placeholder="메모 (무슨 물품/사항인지)" className={`${fieldClass} w-full min-w-[12rem] flex-1`} />
        <Button type="submit" size="xs" disabled={pending}>
          + 추가
        </Button>
        {error && <span className="w-full text-xs text-red-600">{error}</span>}
      </form>
    </div>
  );
}

// "+ 현대 수수료 20% 추가" 버튼 설정(사용자 요청 11/4 "이름변경과 값변경") — 품목 이름·거래처·카테고리·비율. 이 기기(브라우저)에 저장.
function FeeSettingsEditor({
  settings,
  categories,
  clientNames,
  onSave,
  onCancel,
}: {
  settings: IntermediaryFeeSettings;
  categories: Category[];
  clientNames: string[];
  onSave: (s: IntermediaryFeeSettings) => void;
  onCancel: () => void;
}) {
  const [itemName, setItemName] = useState(settings.itemName);
  const [clientName, setClientName] = useState(settings.clientName);
  const [categoryName, setCategoryName] = useState(settings.categoryName);
  const [pct, setPct] = useState(String(settings.pct));
  const [error, setError] = useState<string | null>(null);

  function save() {
    const pctValue = roundFeePct(Number(pct));
    if (!itemName.trim() || !clientName.trim()) {
      setError("품목 이름과 거래처를 적어 주세요.");
      return;
    }
    if (!validFeePct(pctValue)) {
      setError("비율은 0보다 크고 100 이하로 적어 주세요.");
      return;
    }
    onSave({ itemName: itemName.trim(), clientName: clientName.trim(), categoryName: categoryName.trim(), pct: pctValue });
  }

  function reset() {
    setItemName(DEFAULT_INTERMEDIARY_FEE.itemName);
    setClientName(DEFAULT_INTERMEDIARY_FEE.clientName);
    setCategoryName(DEFAULT_INTERMEDIARY_FEE.categoryName);
    setPct(String(DEFAULT_INTERMEDIARY_FEE.pct));
    setError(null);
  }

  return (
    <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2 print:hidden">
      <p className="mb-1.5 text-xs font-semibold text-slate-700">수수료 버튼 설정</p>
      <div className="flex flex-wrap items-end gap-2 max-md:flex-col max-md:items-stretch">
        <label className="text-[11px] text-slate-500">
          품목 이름
          <input value={itemName} onChange={(e) => setItemName(e.target.value)} className={`${inlineFieldClass} mt-0.5 block w-40 max-md:w-full`} />
        </label>
        <label className="text-[11px] text-slate-500">
          거래처
          <input
            list="fee-settings-client-names"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className={`${inlineFieldClass} mt-0.5 block w-36 max-md:w-full`}
          />
          <datalist id="fee-settings-client-names">
            {clientNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        <label className="text-[11px] text-slate-500">
          카테고리
          <select
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            className={`${inlineFieldClass} mt-0.5 block w-32 max-md:w-full`}
          >
            <option value="">미분류</option>
            {categoryName && !categories.some((c) => c.name === categoryName) && (
              <option value={categoryName}>{categoryName} (없음 — 미분류로 들어감)</option>
            )}
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-slate-500">
          비율(%)
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="any"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            className={`${inlineFieldClass} mt-0.5 block w-24 text-right max-md:w-full`}
          />
        </label>
        <div className="flex gap-1">
          <Button type="button" size="xs" onClick={save}>
            저장
          </Button>
          <Button type="button" size="xs" variant="secondary" onClick={reset}>
            기본값
          </Button>
          <Button type="button" size="xs" variant="secondary" onClick={onCancel}>
            취소
          </Button>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        버튼은 &quot;{feeItemLabel({ itemName: itemName.trim() || "이름", clientName, categoryName, pct: Number(pct) || 0 })}&quot;로 보입니다 · 이
        기기(브라우저)에만 저장됨 — 휴대폰·PC에서 각각 한 번씩 맞춰 주세요 · 이미 추가한 줄은 그대로(줄의 &quot;수정&quot;으로 고침)
      </p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
