-- 보고서 "작업일지 집계" 표의 체크박스 상태를 저장 — 체크된 항목만 한 행씩 존재하고,
-- 체크 해제하면 그 행을 지움(존재 = 체크됨). group_key는 화면에서 쓰는 행 식별자와
-- 동일하게 "${siteId}::${title}" 형태로 둬서 uuid 타입 제약 없이 단순하게 관리함.
create table public.work_log_summary_checks (
    id          uuid primary key default gen_random_uuid(),
    year        int not null,
    group_key   text not null,
    created_at  timestamptz not null default now(),
    unique (year, group_key)
);

alter table public.work_log_summary_checks enable row level security;

-- 030_report_ai_insights.sql과 동일한 admin_staff 전체 권한 패턴.
create policy "admin_staff all work_log_summary_checks" on public.work_log_summary_checks
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));
