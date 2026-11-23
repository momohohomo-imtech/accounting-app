import { createClient } from "@/lib/supabase/server";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import type { FieldConfig } from "@/components/crud/types";
import { RecurringPostNowButton } from "@/components/RecurringPostNowButton";
import { createRecurringExpense, deleteRecurringExpense, updateRecurringExpense } from "@/lib/actions/recurringExpenses";
import { fetchAllData } from "@/lib/supabaseFetchAll";
import { getCurrentRole } from "@/lib/currentRole";
import { nowKstParts } from "@/lib/kstDate";
import { loadRecurring, postedMonthsByItem } from "@/lib/recurringExpensePost";
import { currentStatus, missedOlderCount, nextScheduled, postTotal, statusLabel } from "@/lib/recurringExpense";

// 매입매출 "고정지출" 탭(사용자 요청 11/23 "매달 고정 지출 작성 항 → 결제일에 자동으로 매입장에, 분류대기 상태로", 108 SQL) — 항목
// 추가·수정·삭제, 이번 달 상태, "지금 올리기". 자동으로 올리는 일은 매일 아침 서버(/api/cron/recurring-expenses).

const shortDate = (date: string | null) => (date ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : "-");

export async function RecurringExpensesSection() {
  const supabase = await createClient();
  const today = nowKstParts().date;
  const [loaded, { data: clients }, { data: paymentMethods }, { data: categories }, role] = await Promise.all([
    loadRecurring(supabase),
    fetchAllData<{ id: string; name: string }>((from, to) =>
      supabase.from("clients").select("id, name").order("name").order("id").range(from, to)
    ),
    supabase.from("payment_methods").select("id, name").order("sort_order"),
    supabase.from("expense_categories").select("id, name").order("sort_order"),
    getCurrentRole(),
  ]);
  if (loaded.missing) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        고정지출 자동 등록은 Supabase SQL Editor에서 <code>108_recurring_expenses.sql</code>을 실행한 뒤에 쓸 수 있습니다.
      </div>
    );
  }
  const canEdit = role === "admin" || role === "staff";
  const postedByItem = postedMonthsByItem(loaded.posts);
  const lastPostedByItem = new Map<string, string>();
  for (const p of loaded.posts) {
    const month = String(p.month).slice(0, 7);
    if ((lastPostedByItem.get(p.recurring_expense_id) ?? "") < month) lastPostedByItem.set(p.recurring_expense_id, month);
  }

  const postedOf = (id: string) => postedByItem.get(id) ?? new Set<string>();
  const dueCount = loaded.items.filter((r) => currentStatus(r, today, postedOf(r.id)).kind === "due").length;
  const missedOlder = loaded.items.reduce((sum, r) => sum + missedOlderCount(r, today, postedOf(r.id)), 0);
  const rows = loaded.items.map((r) => {
    const status = currentStatus(r, today, postedOf(r.id));
    const last = lastPostedByItem.get(r.id);
    return {
      ...r,
      status_label: statusLabel(status),
      is_due: status.kind === "due",
      is_posted: status.kind === "posted",
      is_off: status.kind === "paused" || status.kind === "ended",
      pay_label: `${r.pay_day}일`,
      total_label: `${postTotal(r).toLocaleString("ko-KR")}원`,
      next_label: shortDate(nextScheduled(r, today)),
      last_label: last ? `${Number(last.slice(0, 4))}년 ${Number(last.slice(5, 7))}월분` : "-",
    };
  });

  const none = { value: "", label: "-" };
  // 표는 한눈에 볼 칸만(1280 화면에 다 들어가게) — 금액·부가세 별도·세금계산서·시작일 등은 "표시 항목"으로 켜서 봄, 수정 화면엔 다 있음.
  const fields: FieldConfig[] = [
    { name: "name", label: "이름", required: true, placeholder: "예: 사무실 인터넷, 차량 리스료", width: "17%" },
    { name: "pay_day", label: "결제일(매달 ○일)", tableLabel: "결제일", type: "number", required: true, placeholder: "1~31 (없는 날은 말일)", hideInTable: true },
    { name: "pay_label", label: "결제일", readOnly: true, hideInCreate: true, width: "7%" },
    { name: "client_id", label: "거래처", type: "select", options: [none, ...(clients ?? []).map((c) => ({ value: c.id, label: c.name }))], width: "13%" },
    { name: "client_name_raw", label: "거래처(목록에 없으면 직접 입력)", tableLabel: "직접 입력", placeholder: "예: ○○통신", toggleable: true, defaultVisible: false },
    { name: "item_name", label: "품목(비우면 이름으로)", tableLabel: "품목", placeholder: "예: 인터넷 요금", toggleable: true, defaultVisible: false },
    { name: "amount", label: "금액(매달 다르면 예상 금액)", tableLabel: "금액", type: "number", format: "won", required: true, toggleable: true, defaultVisible: false },
    { name: "add_vat", label: "부가세 별도(10% 더해서 올림)", tableLabel: "부가세 별도", type: "checkbox", toggleable: true, defaultVisible: false },
    { name: "total_label", label: "올릴 합계", readOnly: true, hideInCreate: true, width: "11%" },
    { name: "tax_invoice_issued", label: "세금계산서 받음", tableLabel: "세금계산서", type: "checkbox", toggleable: true, defaultVisible: false },
    { name: "payment_method_id", label: "결제수단", type: "select", options: [none, ...(paymentMethods ?? []).map((p) => ({ value: p.id, label: p.name }))], width: "10%" },
    { name: "category_id", label: "카테고리(비워도 됨)", tableLabel: "카테고리", type: "select", options: [none, ...(categories ?? []).map((c) => ({ value: c.id, label: c.name }))], width: "10%" },
    { name: "start_date", label: "시작일(비우면 오늘부터 — 이미 지난 결제일은 안 올림)", tableLabel: "시작일", type: "date", toggleable: true, defaultVisible: false },
    { name: "end_date", label: "끝나는 날(비우면 계속)", tableLabel: "끝나는 날", type: "date", toggleable: true, defaultVisible: false },
    { name: "paused", label: "일시 중지(체크하면 안 올림)", tableLabel: "중지", type: "checkbox", hideInTable: true },
    { name: "memo", label: "메모(매입장 메모2로 같이 올라감)", tableLabel: "메모", type: "textarea", toggleable: true, defaultVisible: false },
    {
      name: "status_label",
      label: "이번 달",
      readOnly: true,
      hideInCreate: true,
      tertiaryColorField: "is_due",
      secondaryColorField: "is_posted",
      width: "14%",
    },
    { name: "next_label", label: "다음 결제일", readOnly: true, hideInCreate: true, width: "9%" },
    { name: "last_label", label: "마지막 등록", readOnly: true, hideInCreate: true, toggleable: true, defaultVisible: false },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">고정지출 자동 등록</h2>
        {canEdit && <CreatePanel title="고정지출" fields={fields} createAction={createRecurringExpense} idempotent />}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        <p>
          매달 결제일에 매입장으로 자동으로 올라갑니다(매일 아침 5시 확인). 상태는 <b>분류 대기</b>로 올라가니 매입장에서 분류해 주세요.
        </p>
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-slate-500">자세히</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            <li>금액이 달마다 다르면 예상 금액을 적어 두고, 분류할 때 실제 금액으로 고치면 됩니다.</li>
            <li>그 달에 결제일이 없으면 말일로 올라가고, 주말·공휴일이어도 그날 날짜로 올라갑니다.</li>
            <li>같은 달은 한 번만 올라갑니다. 시작일(비우면 추가한 날) 전에 지난 결제일은 올리지 않습니다.</li>
            <li>은행 거래내역에서 같은 출금을 또 &quot;등록&quot;하면 두 번 들어가니, 같은 날·같은 금액이면 등록할 때 한 번 더 묻습니다.</li>
            <li>항목을 지워도 이미 올라간 매입 줄은 매입장에 그대로 있습니다.</li>
          </ul>
        </details>
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <RecurringPostNowButton dueCount={dueCount} />
          {missedOlder > 0 && (
            <span className="text-sm text-amber-700">
              지난달보다 앞선 결제일 {missedOlder}건은 자동으로 올리지 않았습니다 — 필요하면 매입장에 직접 등록해 주세요.
            </span>
          )}
        </div>
      )}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">등록한 고정지출이 없습니다. 오른쪽 위 &quot;+ 고정지출 추가&quot;로 적어 두세요.</p>
        ) : (
          <EntityTable fields={fields} rows={rows} updateAction={updateRecurringExpense} deleteAction={deleteRecurringExpense} editPopup />
        )}
      </div>
    </div>
  );
}
