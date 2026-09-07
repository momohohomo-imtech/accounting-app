-- 일용직 사용내역(세무사 제출용): 특정 날짜에 어떤 일용직 근로자를 사용했는지 등록.
-- 매입 거래 기준 통계("일용직 사용내역" 탭)와는 별개의 데이터 — 이름/주민번호/전화번호는
-- daily_workers 테이블 값을 그대로 조인해서 보여준다.
create table public.daily_worker_usage_logs (
    id              uuid primary key default gen_random_uuid(),
    use_date        date not null,
    daily_worker_id uuid not null references public.daily_workers(id) on delete cascade,
    note            text,
    created_at      timestamptz not null default now()
);
create index idx_daily_worker_usage_logs_date on public.daily_worker_usage_logs(use_date);
create index idx_daily_worker_usage_logs_worker on public.daily_worker_usage_logs(daily_worker_id);

alter table public.daily_worker_usage_logs enable row level security;

drop policy if exists "admin_staff all daily_worker_usage_logs" on public.daily_worker_usage_logs;
create policy "admin_staff all daily_worker_usage_logs" on public.daily_worker_usage_logs
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));
