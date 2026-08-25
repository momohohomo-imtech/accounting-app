-- 급여명세서에 필요시 쓸 수 있는 메모(전달사항 등) 추가.
alter table public.payroll add column if not exists memo text;
