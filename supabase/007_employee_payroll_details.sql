-- 직원 인적사항/비상연락망/월급·매월 차감액 기본값 추가, 급여 기록에 상여·차감항목 스냅샷 추가.
alter table public.employees
  add column if not exists employee_no text,
  add column if not exists department text,
  add column if not exists resigned_date date,
  add column if not exists home_phone text,
  add column if not exists address text,
  add column if not exists memo text,
  add column if not exists emergency1_relation text,
  add column if not exists emergency1_phone text,
  add column if not exists emergency2_relation text,
  add column if not exists emergency2_phone text,
  add column if not exists monthly_salary numeric,
  add column if not exists health_insurance numeric not null default 0,
  add column if not exists long_term_care_insurance numeric not null default 0,
  add column if not exists employment_insurance numeric not null default 0,
  add column if not exists income_tax numeric not null default 0,
  add column if not exists local_income_tax numeric not null default 0,
  add column if not exists rural_tax numeric not null default 0;

alter table public.payroll
  add column if not exists bonus numeric not null default 0,
  add column if not exists health_insurance numeric not null default 0,
  add column if not exists long_term_care_insurance numeric not null default 0,
  add column if not exists employment_insurance numeric not null default 0,
  add column if not exists income_tax numeric not null default 0,
  add column if not exists local_income_tax numeric not null default 0,
  add column if not exists rural_tax numeric not null default 0,
  add column if not exists non_taxable_unreported numeric not null default 0;
