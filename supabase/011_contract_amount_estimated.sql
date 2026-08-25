-- 수주액을 확정 금액(검정) 또는 예상 금액(빨강)으로 표시하기 위한 플래그.
alter table public.projects add column if not exists contract_amount_estimated boolean not null default false;
