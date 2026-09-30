-- 출장일지 새 방식 — 작업일지 팝업에서 줄마다 "출장"을 체크하면 그 날짜가 그 프로젝트의 출장일지에 자동으로 들어감
-- (사용자 요청: 같은 프로젝트끼리는 한 장, 날짜별 사내·조공 인원과 총 일수·총 투입 인원, 장비 투입 여부·사용처·시간·비고).
--   trip_log_days: 프로젝트·날짜별 한 줄(사내·조공 인원, 장비 투입, 사용처, 시간, 비고)
--   trip_logs:     프로젝트별 출장일지 머리 정보(작업구분, 비고) — 원청사·현장은 프로젝트에서 자동으로.
-- 예전 출장일지(business_trip_logs, 026·027·056)는 지우지 않음 — 화면에서 "이전 출장일지(보기만)"로 남김.
-- 기존 데이터는 바꾸지 않음(새 표만 만듦). 두 번 실행해도 됨.

create table if not exists public.trip_logs (
    project_id  uuid primary key references public.projects(id) on delete cascade,
    work_types  text[] not null default '{}',
    note        text,
    updated_at  timestamptz not null default now()
);

create table if not exists public.trip_log_days (
    id               uuid primary key default gen_random_uuid(),
    project_id       uuid not null references public.projects(id) on delete cascade,
    work_date        date not null,
    staff_count      integer not null default 0 check (staff_count >= 0),
    helper_count     integer not null default 0 check (helper_count >= 0),
    equipment_used   boolean not null default false,
    equipment_place  text,
    equipment_hours  text,
    note             text,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    unique (project_id, work_date)
);
create index if not exists idx_trip_log_days_date on public.trip_log_days(work_date);

alter table public.trip_logs enable row level security;
alter table public.trip_log_days enable row level security;

-- 예전 출장일지(026)·작업일지와 같은 권한: 관리자·직원은 전체, 조회 전용(viewer)은 읽기만(084와 같은 방식).
do $$
declare
  t text;
begin
  for t in select unnest(array['trip_logs', 'trip_log_days'])
  loop
    execute format('drop policy if exists "admin_staff all %1$s" on public.%1$s;', t);
    execute format(
      'create policy "admin_staff all %1$s" on public.%1$s for all using (public.current_user_role() in (''admin'', ''staff'')) with check (public.current_user_role() in (''admin'', ''staff''));',
      t
    );
    execute format('drop policy if exists "viewer read %1$s" on public.%1$s;', t);
    execute format(
      'create policy "viewer read %1$s" on public.%1$s for select using (public.current_user_role() = ''viewer'');',
      t
    );
  end loop;
end $$;
