-- 일용직 사용내역서에 직접 기입하는 일급(일당) 금액.
alter table public.daily_worker_usage_logs add column if not exists daily_wage numeric;
