-- 097: 장기 점검 후속(10/31 사용자 결정 "셋 다 진행") — 저장된 거래·금액·번호는 하나도 바꾸지 않음. 두 번 실행해도 문제없음.
--
-- ① 번호 매기기(프로젝트 번호 2026-001 · 견적번호 Q2026-010 · 발주번호 PO2026-010) — 이미 매긴 번호는 그대로, 새로 만드는 것만:
--    - 연도를 한국 시각으로: 예전엔 서버 시각(UTC)이라 1월 1일 0~9시에 만든 프로젝트·견적이 전년도 번호를 받았음
--    - 1,000번째부터는 4자리: 예전엔 lpad(…, 3)가 1000을 "100"으로 잘라 이미 있는 번호와 겹쳐 저장이 실패했음
--    - 두 사람이 동시에 만들어도 번호가 겹치지 않게, 그 해 번호 매기기는 하나씩 차례로
-- ② 통장 잔액 확인 기록(bank_balance_checks) — 날짜별로 은행 앱의 실제 잔액을 적어 두고 앱이 계산한 잔액과 비교(통장 화면).
-- ③ 신고 끝난 해 잠금(locked_years + 거래 표 트리거) — 관리자가 잠근 해의 거래는
--    추가·삭제할 수 없고, 신고에 들어간 칸(날짜·구분·거래처·카테고리·금액·부가세·세금계산서·외상 여부)은 바꿀 수 없음.
--    프로젝트·결제수단·품목·메모·한 결제 묶기는 그대로 바꿀 수 있고, 작년 외상을 올해 정산하는 것도 그대로 됨
--    (정산은 정산 이력 표 + 결제수단·메모·묶음만 바꿈). 백업 복원(restore_commit)·Supabase SQL 편집기 작업에는 적용되지 않음.
-- ④ 백업 복원 표 목록(restore_allowed_tables)에 통장 잔액 확인 기록 추가. 잠금 표(locked_years)는 백업에는 담고 복원은 안 함
--    — 잠그기 전 백업으로 복원해도 잠금이 풀리지 않게(앱의 lib/restore.ts RESTORE_TABLES와 같게, restore.test.ts가 비교).

-- ① 번호 매기기 ---------------------------------------------------------------------------------------------------------

create or replace function public.set_project_code()
returns trigger as $$
declare
  yr text;
  next_seq int;
begin
  if new.project_code is not null then
    return new;
  end if;
  yr := to_char(coalesce(new.created_at, now()) at time zone 'Asia/Seoul', 'YYYY');
  perform pg_advisory_xact_lock(hashtext('public.set_project_code:' || yr));
  select coalesce(max(substring(project_code from '-(\d+)$')::int), 0) + 1
    into next_seq
    from public.projects
    where project_code like yr || '-%';
  new.project_code := yr || '-' || lpad(next_seq::text, greatest(3, length(next_seq::text)), '0');
  return new;
end;
$$ language plpgsql;

create or replace function public.set_quote_number()
returns trigger as $$
declare
  yr text;
  next_seq int;
begin
  if new.quote_number is not null then
    return new;
  end if;
  yr := to_char(coalesce(new.created_at, now()) at time zone 'Asia/Seoul', 'YYYY');
  perform pg_advisory_xact_lock(hashtext('public.set_quote_number:' || yr));
  select greatest(coalesce(max(substring(quote_number from '-(\d+)$')::int), 0) + 1, 10)
    into next_seq
    from public.quotes
    where quote_number like 'Q' || yr || '-%';
  new.quote_number := 'Q' || yr || '-' || lpad(next_seq::text, greatest(3, length(next_seq::text)), '0');
  return new;
end;
$$ language plpgsql;

create or replace function public.set_po_number()
returns trigger as $$
declare
  yr text;
  next_seq int;
begin
  if new.po_number is not null then
    return new;
  end if;
  yr := to_char(coalesce(new.created_at, now()) at time zone 'Asia/Seoul', 'YYYY');
  perform pg_advisory_xact_lock(hashtext('public.set_po_number:' || yr));
  select greatest(coalesce(max(substring(po_number from '-(\d+)$')::int), 0) + 1, 10)
    into next_seq
    from public.purchase_orders
    where po_number like 'PO' || yr || '-%';
  new.po_number := 'PO' || yr || '-' || lpad(next_seq::text, greatest(3, length(next_seq::text)), '0');
  return new;
end;
$$ language plpgsql;

-- ② 통장 잔액 확인 기록 --------------------------------------------------------------------------------------------------

create table if not exists public.bank_balance_checks (
  id               uuid primary key default gen_random_uuid(),
  -- 계좌를 지우면 같이 지워짐 — 앱은 기록이 있으면 계좌 삭제를 막고 몇 건인지 알려 줌(lib/deleteGuard.ts BANK_ACCOUNT_LINKS).
  bank_account_id  uuid not null references public.bank_accounts(id) on delete cascade,
  check_date       date not null,
  actual_balance   numeric not null,
  memo             text,
  created_at       timestamptz not null default now(),
  -- 한 계좌에 하루 한 번(같은 날 다시 적으면 고쳐 씀)
  unique (bank_account_id, check_date)
);

alter table public.bank_balance_checks enable row level security;
-- 019·084와 같은 방식: 관리자·직원은 전체, 조회 전용 계정은 읽기만(통장 거래와 같게).
drop policy if exists "admin_staff all bank_balance_checks" on public.bank_balance_checks;
create policy "admin_staff all bank_balance_checks" on public.bank_balance_checks
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));
drop policy if exists "viewer read bank_balance_checks" on public.bank_balance_checks;
create policy "viewer read bank_balance_checks" on public.bank_balance_checks
  for select using (public.current_user_role() = 'viewer');

-- ③ 신고 끝난 해 잠금 ----------------------------------------------------------------------------------------------------

create table if not exists public.locked_years (
  year       int primary key check (year between 2000 and 2100),
  locked_at  timestamptz not null default now(),
  memo       text
);

alter table public.locked_years enable row level security;
-- 잠긴 해는 로그인한 누구나 볼 수 있고(매입매출장에 "잠김" 표시 — 세무사 계정 포함), 잠그기·풀기는 관리자만.
drop policy if exists "authenticated read locked_years" on public.locked_years;
create policy "authenticated read locked_years" on public.locked_years
  for select to authenticated using (true);
drop policy if exists "admin write locked_years" on public.locked_years;
create policy "admin write locked_years" on public.locked_years
  for all using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- 잠긴 해인지 — 읽기 권한과 상관없이 정확히 보도록(트리거가 씀).
create or replace function public.is_year_locked(p_year int)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.locked_years where year = p_year)
$$;
revoke all on function public.is_year_locked(int) from public, anon;
grant execute on function public.is_year_locked(int) to authenticated;

create or replace function public.guard_locked_year_transactions()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_year int;
  v_hint constant text := '관리자가 매입매출 → 장부 점검에서 잠금을 풀 수 있습니다.';
begin
  -- 앱 사용자 요청(로그인 계정)만 막음 — 백업 복원 함수(소유자 권한으로 실행)·SQL 편집기·서비스 키 작업은 그대로.
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    v_year := extract(year from new.trans_date)::int;
    if public.is_year_locked(v_year) then
      raise exception '%년은 신고가 끝나 잠긴 해라 거래를 추가할 수 없습니다. %', v_year, v_hint;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_year := extract(year from old.trans_date)::int;
    if public.is_year_locked(v_year) then
      raise exception '%년은 신고가 끝나 잠긴 해라 거래를 삭제할 수 없습니다. %', v_year, v_hint;
    end if;
    return old;
  end if;

  -- 수정: 신고에 들어간 칸이 바뀔 때만 막음(옮기는 앞 해·뒤 해 둘 중 하나라도 잠겼으면).
  if (new.trans_date, new.type, new.client_id, new.client_name_raw, new.category, new.category_id, new.vat_included,
      new.purchase_amount, new.purchase_vat, new.sales_amount, new.sales_vat, new.tax_invoice_issued, new.payment_type)
     is distinct from
     (old.trans_date, old.type, old.client_id, old.client_name_raw, old.category, old.category_id, old.vat_included,
      old.purchase_amount, old.purchase_vat, old.sales_amount, old.sales_vat, old.tax_invoice_issued, old.payment_type)
  then
    v_year := extract(year from old.trans_date)::int;
    if not public.is_year_locked(v_year) then
      v_year := extract(year from new.trans_date)::int;
    end if;
    if public.is_year_locked(v_year) then
      raise exception '%년은 신고가 끝나 잠긴 해라 날짜·금액·거래처·카테고리·세금계산서·외상 여부는 바꿀 수 없습니다(프로젝트·결제수단·품목·메모는 바꿀 수 있음). %',
        v_year, v_hint;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_locked_year on public.transactions;
create trigger trg_guard_locked_year
  before insert or update or delete on public.transactions
  for each row execute function public.guard_locked_year_transactions();

-- ④ 백업 복원 표 목록 — 096 목록 + 통장 잔액 확인 기록 ------------------------------------------------------------------

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
    'projects_page_memo', 'bank_balance_checks'
  ]::text[]
$$;

-- PostgREST(Supabase API 레이어)가 새 표·함수를 바로 알도록 스키마를 다시 읽게 함.
notify pgrst, 'reload schema';
