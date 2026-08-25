-- 출입명단에 직원(정직원)도 추가할 수 있게 하고, 명단 항목별 비고를 남길 수 있게 함.
-- employees에 생년월일/국적 추가 (출입명단 엑셀에 필요).
alter table public.employees
  add column if not exists birth_date date,
  add column if not exists nationality text;

-- access_list_workers: daily_worker_id 또는 employee_id 중 하나만 채워지도록 변경.
alter table public.access_list_workers drop constraint if exists access_list_workers_pkey;
alter table public.access_list_workers add column if not exists id uuid primary key default gen_random_uuid();
alter table public.access_list_workers alter column daily_worker_id drop not null;
alter table public.access_list_workers add column if not exists employee_id uuid references public.employees(id) on delete cascade;
alter table public.access_list_workers add column if not exists note text;
alter table public.access_list_workers
  drop constraint if exists access_list_workers_member_check;
alter table public.access_list_workers
  add constraint access_list_workers_member_check
  check ((daily_worker_id is not null) <> (employee_id is not null));
create index if not exists idx_access_list_workers_employee on public.access_list_workers(employee_id);
