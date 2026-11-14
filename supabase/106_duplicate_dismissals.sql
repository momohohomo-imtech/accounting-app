-- 106: 장부 점검 "중복 의심 거래"에서 확인한 묶음 숨기기(11/14 사용자 요청 "중복 의심 내역에서 실제 중복인(실제로 두 번 산 게
-- 맞는) 경우 표에서 보이지 않게").
--
-- 기존 거래·금액은 하나도 바꾸지 않음 — 새 표 하나:
--   duplicate_dismissals — 숨긴 묶음 한 줄 = 그 묶음의 거래 id들(정렬해서 쉼표로 이은 글자, dup_key).
--   같은 거래들로 다시 묶이면 계속 숨김, 같은 날·같은 금액 거래가 하나 더 들어와 묶음이 바뀌면 다시 보임(새로 확인할 것이 생긴 것).
--   "다시 보이기"를 누르면 이 표의 줄만 지워짐. 거래를 지워도 거래는 이 표와 연결이 없어 아무 일 없음(남은 줄은 다시 쓰이지 않음).
-- 권한: 매입매출 메모장·챙길 거래와 같게 — 관리자·직원은 전부, 조회 전용 계정은 읽기만(084), 세무사 계정은 없음.
-- 백업 복원 표 목록에 추가(restore_allowed_tables 다시 만들기 — 105 목록 + 1).
-- 실행 전엔 앱이 "숨기기" 버튼을 감춤(중복 의심 표는 예전처럼 다 보임). 두 번 실행해도 문제없음.

create table if not exists public.duplicate_dismissals (
  id          uuid primary key default gen_random_uuid(),
  dup_key     text not null unique check (char_length(dup_key) > 0),
  created_at  timestamptz not null default now()
);

alter table public.duplicate_dismissals enable row level security;
drop policy if exists "admin_staff all duplicate_dismissals" on public.duplicate_dismissals;
create policy "admin_staff all duplicate_dismissals" on public.duplicate_dismissals
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));
drop policy if exists "viewer read duplicate_dismissals" on public.duplicate_dismissals;
create policy "viewer read duplicate_dismissals" on public.duplicate_dismissals
  for select using (public.current_user_role() = 'viewer');

-- 백업 복원 표 목록 — 105 목록 + 중복 의심 숨김 ---------------------------------------------------------------------------
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
    'transaction_watch', 'duplicate_dismissals'
  ]::text[]
$$;

-- PostgREST(Supabase API 레이어)가 새 표를 바로 알도록 스키마를 다시 읽게 함.
notify pgrst, 'reload schema';
