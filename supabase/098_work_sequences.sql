-- 098: 공사 작업 순서(11/2 사용자 요청 "공사 관리에 공사 작업 순서 항") — 새 표 2개만 추가, 기존 표·자료는 하나도 바꾸지 않음.
-- 두 번 실행해도 문제없음.
--
-- ① work_sequences — 순서표 한 장: 프로젝트·제목·기간 단위(일 또는 시간)·시작일·시작 시각(시간 단위일 때)
-- ② work_sequence_steps — 순서표의 단계(한 줄): 순번·작업 내용·세부 설명·주의사항·기간·앞 작업과 겹침·완료 체크·완료일
--    단계의 시작·끝 날짜는 저장하지 않고 앱이 계산(시작일 + 앞 단계 기간 − 겹침, 토·일 포함 달력 그대로 — lib/workSequence.ts)
--    — 순번을 바꾸거나 기간·겹침을 고치면 날짜가 저절로 다시 맞춰지게(사용자 결정 11/2 "기간+겹침 → 날짜 자동").
-- ③ 백업 복원 표 목록(restore_allowed_tables)에 두 표 추가(앱의 lib/backup.ts BACKUP_TABLES와 같게, restore.test.ts가 비교).

-- ① 순서표 ---------------------------------------------------------------------------------------------------------------

create table if not exists public.work_sequences (
  id          uuid primary key default gen_random_uuid(),
  -- 프로젝트를 지우면 같이 지워짐 — 앱은 순서표가 있으면 프로젝트 삭제를 막고 몇 개인지 알려 줌(lib/deleteGuard.ts PROJECT_LINKS).
  project_id  uuid not null references public.projects(id) on delete cascade,
  title       text not null,
  -- 'day' = 일(날짜), 'hour' = 시간 — 순서표마다 하나(사용자 결정 11/2)
  unit        text not null default 'day' check (unit in ('day', 'hour')),
  start_date  date,
  start_time  time,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_work_sequences_project on public.work_sequences(project_id);

-- ② 단계 -----------------------------------------------------------------------------------------------------------------

create table if not exists public.work_sequence_steps (
  id           uuid primary key default gen_random_uuid(),
  -- 순서표를 지우면 단계도 같이 지워짐
  sequence_id  uuid not null references public.work_sequences(id) on delete cascade,
  sort_order   integer not null,
  content      text not null,
  detail       text,
  -- 기간·겹침은 순서표 단위(일 또는 시간)로. 겹침 = 앞 단계가 끝나기 전에 이 단계가 시작되는 만큼(0이면 앞 단계가 끝난 뒤 시작)
  duration     numeric not null default 1 check (duration > 0),
  overlap      numeric not null default 0 check (overlap >= 0),
  done         boolean not null default false,
  done_date    date,
  created_at   timestamptz not null default now()
);
create index if not exists idx_work_sequence_steps_sequence on public.work_sequence_steps(sequence_id, sort_order);

-- 019·084와 같은 방식: 관리자·직원은 전체, 조회 전용 계정은 읽기만(공사 메모와 같게).
alter table public.work_sequences enable row level security;
drop policy if exists "admin_staff all work_sequences" on public.work_sequences;
create policy "admin_staff all work_sequences" on public.work_sequences
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));
drop policy if exists "viewer read work_sequences" on public.work_sequences;
create policy "viewer read work_sequences" on public.work_sequences
  for select using (public.current_user_role() = 'viewer');

alter table public.work_sequence_steps enable row level security;
drop policy if exists "admin_staff all work_sequence_steps" on public.work_sequence_steps;
create policy "admin_staff all work_sequence_steps" on public.work_sequence_steps
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));
drop policy if exists "viewer read work_sequence_steps" on public.work_sequence_steps;
create policy "viewer read work_sequence_steps" on public.work_sequence_steps
  for select using (public.current_user_role() = 'viewer');

-- ③ 백업 복원 표 목록 — 097 목록 + 공사 작업 순서 두 표 --------------------------------------------------------------------

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
    'projects_page_memo', 'bank_balance_checks', 'work_sequences', 'work_sequence_steps'
  ]::text[]
$$;

-- PostgREST(Supabase API 레이어)가 새 표를 바로 알도록 스키마를 다시 읽게 함.
notify pgrst, 'reload schema';
