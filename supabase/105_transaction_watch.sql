-- 105: 매입매출 "챙길 거래" 창(11/11 사용자 요청 "매입장 메모 옆이나 아래에 작은 창 — 매입장에서 체크하면 바로 올라가 보이고,
-- 필요 없으면 쉽게 지우게, 창 크기는 내용에 맞춰", 사용자 결정 "모든 기기 공용" + "줄마다 짧은 메모 칸").
--
-- 기존 거래·금액은 하나도 바꾸지 않음 — 새 표 하나:
--   transaction_watch — 챙길 거래 한 줄 = 거래 하나(같은 거래는 한 번만), 짧은 메모(100자까지), 올린 시각.
--   창에서 지우면 이 표의 줄만 지워지고 거래는 그대로. 거래를 지우면 이 줄도 같이 지워짐(창에만 쓰는 표시라).
-- 권한: 매입매출 메모장과 같게 — 관리자·직원은 전부, 조회 전용 계정은 읽기만(084), 세무사 계정은 없음.
-- 백업 복원 표 목록에 추가(restore_allowed_tables 다시 만들기 — 104 목록 + 1).
-- 실행 전엔 앱이 창과 📌 칸을 숨김(나머지는 그대로). 두 번 실행해도 문제없음.

create table if not exists public.transaction_watch (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null unique references public.transactions(id) on delete cascade,
  memo            text check (memo is null or char_length(memo) <= 100),
  created_at      timestamptz not null default now()
);

alter table public.transaction_watch enable row level security;
drop policy if exists "admin_staff all transaction_watch" on public.transaction_watch;
create policy "admin_staff all transaction_watch" on public.transaction_watch
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));
drop policy if exists "viewer read transaction_watch" on public.transaction_watch;
create policy "viewer read transaction_watch" on public.transaction_watch
  for select using (public.current_user_role() = 'viewer');

-- 백업 복원 표 목록 — 104 목록 + 챙길 거래 ----------------------------------------------------------------------------------
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
    'transaction_watch'
  ]::text[]
$$;

-- PostgREST(Supabase API 레이어)가 새 표를 바로 알도록 스키마를 다시 읽게 함.
notify pgrst, 'reload schema';
