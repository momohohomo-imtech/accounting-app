-- 공제 항목에 국민연금 추가 (건강보험 앞).
alter table public.employees add column if not exists national_pension numeric not null default 0;
alter table public.payroll add column if not exists national_pension numeric not null default 0;
