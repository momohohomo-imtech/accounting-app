-- 고용보험 환급금(조정)을 일반 고용보험 차감액과 분리해서 기록.
alter table public.payroll add column if not exists employment_insurance_refund numeric not null default 0;
