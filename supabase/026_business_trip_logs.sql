-- 출장 업무 내역서: 작업일지와 별도로, 원청사/현장/작업인원/장비/지출을
-- A4 1장짜리 양식으로 정리해서 인쇄·엑셀로 뽑아볼 수 있는 보고서.
create table public.business_trip_logs (
    id              uuid primary key default gen_random_uuid(),
    work_date       date not null,
    created_date    date not null default current_date,
    client_name     text,
    site_name       text,
    project_name    text,
    work_types      text[] not null default '{}',
    note            text,
    workers         jsonb not null default '[]',
    total_manpower  text,
    equipment       jsonb not null default '[]',
    expenses        jsonb not null default '[]',
    created_by      uuid references public.users(id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index idx_business_trip_logs_date on public.business_trip_logs(work_date);

alter table public.business_trip_logs enable row level security;

create policy "admin_staff all business_trip_logs" on public.business_trip_logs
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));
