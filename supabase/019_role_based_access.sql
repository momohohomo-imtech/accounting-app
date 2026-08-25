-- 역할 기반 접근 제어.
-- admin/staff: 기존과 동일하게 전 테이블 전체 권한.
-- tax_agent(세무사 사무실): 매입매출·외상 관련 테이블만 읽기 전용, 그 외(직원/급여/일용직/
-- 작업일지/프로젝트/현장/은행/백업 등)는 접근 불가.
-- 신규 가입 계정의 기본 role도 'admin'에서 'staff'로 낮춤(초대 후 필요 시 수동으로 admin/tax_agent 지정).

alter table public.users alter column role set default 'staff';

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

-- 기존 블랭킷 정책(인증만 되면 전체 권한) 제거.
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'clients','sites','projects','transactions','credit_payments','work_logs',
      'employees','payroll','daily_worker_offices','daily_workers',
      'access_lists','access_list_workers','bank_accounts','bank_transactions','backups',
      'payment_methods','expense_categories'
    ])
  loop
    execute format('drop policy if exists "authenticated all %1$s" on public.%1$s;', t);
  end loop;
end $$;

-- admin/staff: 전 테이블 전체 권한(기존과 동일한 범위).
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'clients','sites','projects','transactions','credit_payments','work_logs',
      'employees','payroll','daily_worker_offices','daily_workers',
      'access_lists','access_list_workers','bank_accounts','bank_transactions','backups',
      'payment_methods','expense_categories'
    ])
  loop
    execute format(
      'create policy "admin_staff all %1$s" on public.%1$s for all using (public.current_user_role() in (''admin'',''staff'')) with check (public.current_user_role() in (''admin'',''staff''));',
      t
    );
  end loop;
end $$;

-- tax_agent: 매입매출·외상 화면(거래/외상/거래처/결제수단/지출카테고리)만 읽기 전용.
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'transactions','credit_payments','clients','payment_methods','expense_categories'
    ])
  loop
    execute format(
      'create policy "tax_agent read %1$s" on public.%1$s for select using (public.current_user_role() = ''tax_agent'');',
      t
    );
  end loop;
end $$;

-- 백업 파일도 admin/staff만 접근하도록 강화 (영수증은 매입매출 범위라 기존대로 유지).
drop policy if exists "authenticated backups access" on storage.objects;
create policy "admin_staff backups access" on storage.objects
  for all using (bucket_id = 'backups' and public.current_user_role() in ('admin', 'staff'))
  with check (bucket_id = 'backups' and public.current_user_role() in ('admin', 'staff'));
