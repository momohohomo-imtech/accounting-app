-- 작업일지 항목에 현장을 연결해서 현장별 자동 색상을 입히고, 같은 현장 작업이
-- 이어지는 날은 내용 없이 현장만 선택해도 색으로 표시되게 하기 위한 컬럼 추가.
alter table public.work_logs add column if not exists site_id uuid references public.sites(id) on delete set null;
create index if not exists idx_worklogs_site on public.work_logs(site_id);
