-- 108: 고정지출 자동 등록(사용자 요청 11/23 "매달 고정 지출 작성 항을 만들어서 자동으로 결제일에 매입장에 올리게, 올릴 때는 분류대기
-- 상태로", 사용자 결정 "추천대로" — 매달 금액이 다른 항목은 예상 금액으로 올리고 분류할 때 고침, 결제일이 주말·공휴일이어도 그날 날짜).
--
-- 새 표 2개 + 함수 1개. 기존 표·자료는 바꾸지 않음(거래 표에 칸을 더하지 않음 — 자동으로 올린 줄은 "올린 기록" 표가 가리킴).
--  1) recurring_expenses      — 고정지출 항목(매입매출 "고정지출" 탭에서 추가·수정·삭제)
--  2) recurring_expense_posts — 항목마다 달마다 올린 기록(항목 + 달 하나에 한 줄 → 같은 달 두 번 안 올라감)
--  3) post_recurring_expense() — 올린 기록 + 매입 한 줄(분류 대기)을 한 번에(하나라도 실패하면 둘 다 취소)
-- 매일 아침 서버(크론 /api/cron/recurring-expenses)와 탭의 "지금 올리기"가 결제일이 된 항목을 이 함수로 올림.
-- 실행 전엔 매입매출 "고정지출" 탭이 안 보임. 두 번 실행해도 문제없음.

create table if not exists public.recurring_expenses (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(btrim(name)) > 0),
  -- 매달 결제일(1~31) — 그 달에 그 날짜가 없으면 말일(예: 31일 → 2월은 28·29일)
  pay_day             smallint not null check (pay_day between 1 and 31),
  client_id           uuid references public.clients(id) on delete set null,
  client_name_raw     text,
  item_name           text,
  -- 금액(예상) — 부가세 별도면 add_vat(10% 더해서 올림, 거래 등록 화면의 "부가세 별도"와 같음)
  amount              numeric not null check (amount <> 0),
  add_vat             boolean not null default false,
  tax_invoice_issued  boolean not null default false,
  payment_method_id   uuid references public.payment_methods(id) on delete set null,
  category_id         uuid references public.expense_categories(id) on delete set null,
  -- 이 날짜부터의 결제일만 올림(비우면 항목을 만든 날부터 — 만들기 전에 지난 결제일은 안 올림), 끝나는 날(비우면 계속)
  start_date          date,
  end_date            date,
  paused              boolean not null default false,
  memo                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references public.users(id) on delete set null,
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.recurring_expense_posts (
  id                    uuid primary key default gen_random_uuid(),
  recurring_expense_id  uuid not null references public.recurring_expenses(id) on delete cascade,
  -- 그 달 1일(달 하나에 한 줄)
  month                 date not null check (extract(day from month) = 1),
  -- 올린 매입 줄 — 장부에서 그 줄을 지워도 기록은 남아 그 달은 다시 안 올림
  transaction_id        uuid references public.transactions(id) on delete set null,
  posted_at             timestamptz not null default now(),
  unique (recurring_expense_id, month)
);
create index if not exists idx_recurring_expense_posts_transaction on public.recurring_expense_posts(transaction_id);

alter table public.recurring_expenses enable row level security;
drop policy if exists "admin_staff all recurring_expenses" on public.recurring_expenses;
create policy "admin_staff all recurring_expenses" on public.recurring_expenses
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));
drop policy if exists "viewer read recurring_expenses" on public.recurring_expenses;
create policy "viewer read recurring_expenses" on public.recurring_expenses
  for select using (public.current_user_role() = 'viewer');

alter table public.recurring_expense_posts enable row level security;
drop policy if exists "admin_staff all recurring_expense_posts" on public.recurring_expense_posts;
create policy "admin_staff all recurring_expense_posts" on public.recurring_expense_posts
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));
drop policy if exists "viewer read recurring_expense_posts" on public.recurring_expense_posts;
create policy "viewer read recurring_expense_posts" on public.recurring_expense_posts
  for select using (public.current_user_role() = 'viewer');

-- 한 항목의 한 달 몫을 올림: 올린 기록을 먼저 넣고(이미 있으면 아무것도 안 하고 null — 크론과 "지금 올리기"가 겹쳐도 한 번만),
-- 매입 한 줄을 분류 대기로 넣음. 금액·부가세 나누기는 앱(lib/recurringExpense.ts)이 계산해서 넘김(거래 등록과 같은 계산).
-- 부르는 사람 권한 그대로(security invoker) — 관리자·직원만 올릴 수 있고(표 권한), 크론은 서버 열쇠로 부름.
-- 신고 끝난 해(097 잠금)의 날짜면 거래 표 트리거가 막아서 둘 다 취소됨.
create or replace function public.post_recurring_expense(
  p_recurring_id      uuid,
  p_month             date,
  p_trans_date        date,
  p_purchase_amount   numeric,
  p_purchase_vat      numeric,
  p_vat_included      boolean,
  p_note1             text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  r public.recurring_expenses%rowtype;
  v_tx uuid;
begin
  select * into r from public.recurring_expenses where id = p_recurring_id;
  if not found or r.paused then
    return null;
  end if;
  if p_trans_date < p_month or p_trans_date >= (p_month + interval '1 month') then
    raise exception '결제일(%)이 그 달(%)이 아님', p_trans_date, p_month;
  end if;

  insert into public.recurring_expense_posts (recurring_expense_id, month)
  values (p_recurring_id, p_month)
  on conflict (recurring_expense_id, month) do nothing;
  if not found then
    return null;
  end if;

  insert into public.transactions (
    trans_date, type, client_id, client_name_raw, item_name, category_id, payment_method_id,
    tax_invoice_issued, vat_included, purchase_amount, purchase_vat, sales_amount, sales_vat,
    payment_type, needs_classification, note1, note2, created_by
  ) values (
    p_trans_date, '매입', r.client_id, r.client_name_raw, coalesce(nullif(btrim(r.item_name), ''), r.name), r.category_id,
    r.payment_method_id, r.tax_invoice_issued, p_vat_included, p_purchase_amount, p_purchase_vat, 0, 0,
    'immediate', true, p_note1, r.memo, auth.uid()
  )
  returning id into v_tx;

  update public.recurring_expense_posts set transaction_id = v_tx
   where recurring_expense_id = p_recurring_id and month = p_month;
  return v_tx;
end;
$$;

revoke all on function public.post_recurring_expense(uuid, date, date, numeric, numeric, boolean, text) from public, anon;
grant execute on function public.post_recurring_expense(uuid, date, date, numeric, numeric, boolean, text) to authenticated, service_role;

-- 백업 복원 표 목록 — 106 목록 + 고정지출 자동 등록 2개 ------------------------------------------------------------------------
create or replace function public.restore_allowed_tables()
returns text[]
language sql
immutable
as $$
  select array[
    'clients', 'sites', 'projects', 'payment_methods', 'expense_categories', 'transactions', 'credit_payments',
    'work_logs', 'employees', 'payroll', 'daily_worker_offices', 'daily_workers', 'daily_worker_usage_logs',
    'access_lists', 'access_list_workers', 'bank_accounts', 'bank_transactions', 'memos', 'business_trip_logs',
    'project_agency_purchases', 'attachments', 'quotes', 'quote_items', 'trip_logs', 'trip_log_days',
    'construction_memos', 'construction_stages', 'quality_checklist_items', 'tools', 'tool_checklists',
    'tool_checklist_items', 'purchase_orders', 'purchase_order_items', 'know_how_notes', 'vat_prepayment_notices',
    'half_year_settlements', 'work_log_summary_checks', 'dashboard_page_memo', 'transactions_page_memo',
    'projects_page_memo', 'bank_balance_checks', 'work_sequences', 'work_sequence_steps', 'memo_categories',
    'transaction_watch', 'duplicate_dismissals', 'recurring_expenses', 'recurring_expense_posts'
  ]::text[]
$$;

-- PostgREST(Supabase API 레이어)가 새 표·함수를 바로 알도록 스키마를 다시 읽게 함.
notify pgrst, 'reload schema';
