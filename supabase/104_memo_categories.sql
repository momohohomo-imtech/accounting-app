-- 104: 메모장 구분 추가·수정(11/8 사용자 요청 "메모장에 구분을 추가 수정할 수 있게", 사용자 결정 "구분 관리 칸" + "메모가 남은 구분은
-- 삭제 막기"). 085 SQL은 메모 구분을 회사·프로젝트·제작·현장·기타 5개로만 묶어 두어서 새 구분을 넣을 수 없었음.
--
-- 기존 메모·구분 값은 하나도 바꾸지 않음:
--   ① memo_categories — 구분 목록(이름·색·순서). 표가 비어 있을 때만 지금 5개를 같은 순서·색으로 넣음(두 번 실행해도 사용자가 바꾼
--      목록을 되돌리지 않음).
--   ② 메모 구분을 5개로만 묶던 제약(memos_category_check)을 풂 — 메모에는 지금처럼 구분 이름(글자)이 저장됨.
--   ③ rename_memo_category — 구분 이름을 바꾸면 그 구분의 메모도 한 번에(하나라도 실패하면 둘 다 그대로). 부르는 사람 권한으로
--      실행(관리자·직원만 바뀜 — 조회 전용 계정은 "바꾸지 못함" 오류).
--   ④ 백업 복원 표 목록에 memo_categories 추가(restore_allowed_tables 다시 만들기 — 098 목록 + 1).
-- 실행 전엔 앱이 예전처럼 고정 5개로 동작(구분 관리 칸은 안 보임). 085를 실행하지 않았어도 이것만으로 됨. 두 번 실행해도 문제없음.

-- ① 구분 목록 -----------------------------------------------------------------------------------------------------------------
alter table public.memos add column if not exists category text;

create table if not exists public.memo_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (btrim(name) <> '' and char_length(name) <= 20),
  color       text not null default 'gray',
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.memo_categories enable row level security;
-- 메모장과 같은 권한: 관리자·직원은 전부, 조회 전용 계정은 읽기만(084), 세무사 계정은 없음.
drop policy if exists "admin_staff all memo_categories" on public.memo_categories;
create policy "admin_staff all memo_categories" on public.memo_categories
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));
drop policy if exists "viewer read memo_categories" on public.memo_categories;
create policy "viewer read memo_categories" on public.memo_categories
  for select using (public.current_user_role() = 'viewer');

insert into public.memo_categories (name, color, sort_order)
select v.name, v.color, v.sort_order
from (values ('회사', 'blue', 0), ('프로젝트', 'indigo', 1), ('제작', 'amber', 2), ('현장', 'green', 3), ('기타', 'gray', 4))
  as v(name, color, sort_order)
where not exists (select 1 from public.memo_categories);

-- ② 5개 제약 풀기 ---------------------------------------------------------------------------------------------------------------
alter table public.memos drop constraint if exists memos_category_check;

-- ③ 이름 바꾸기(구분 + 그 구분의 메모를 한 번에) ---------------------------------------------------------------------------------
create or replace function public.rename_memo_category(p_id uuid, p_name text)
returns void
language plpgsql
as $$
declare
  v_old text;
  v_new text := btrim(coalesce(p_name, ''));
begin
  if v_new = '' then
    raise exception '구분 이름을 입력해주세요.';
  end if;
  select name into v_old from public.memo_categories where id = p_id;
  if v_old is null then
    raise exception '구분을 찾지 못했습니다.';
  end if;
  update public.memo_categories set name = v_new where id = p_id;
  if not found then
    raise exception '구분을 바꾸지 못했습니다(권한을 확인해 주세요).';
  end if;
  if v_old <> v_new then
    update public.memos set category = v_new where category = v_old;
  end if;
end;
$$;

revoke all on function public.rename_memo_category(uuid, text) from public, anon;
grant execute on function public.rename_memo_category(uuid, text) to authenticated;

-- ④ 백업 복원 표 목록 — 098 목록 + 메모장 구분 목록 ----------------------------------------------------------------------------
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
    'projects_page_memo', 'bank_balance_checks', 'work_sequences', 'work_sequence_steps', 'memo_categories'
  ]::text[]
$$;

-- PostgREST(Supabase API 레이어)가 새 표·함수를 바로 알도록 스키마를 다시 읽게 함.
notify pgrst, 'reload schema';
