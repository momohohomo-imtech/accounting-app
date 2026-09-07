-- 일용직 사용내역서 소계를 사람 단위가 아니라 현장 단위로 묶기 위한 현장 참조.
alter table public.daily_worker_usage_logs add column if not exists site_id uuid references public.sites(id);
create index if not exists idx_daily_worker_usage_logs_site on public.daily_worker_usage_logs(site_id);
