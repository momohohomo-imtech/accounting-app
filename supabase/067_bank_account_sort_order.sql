-- 은행 계좌 목록 순번을 직접 지정할 수 있게 정렬순서 컬럼 추가.
alter table public.bank_accounts add column if not exists sort_order integer not null default 0;
