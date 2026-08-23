-- ============================================================
-- 결제수단 관리 + 세금계산서 발행여부 + 외상 정산(합산) 지원
-- Supabase SQL Editor에서 전체 실행하세요. (schema.sql 이후 적용)
-- ============================================================

-- ---------- 결제수단 ----------
create table public.payment_methods (
    id          uuid primary key default gen_random_uuid(),
    name        text not null unique,
    sort_order  smallint not null default 0,
    created_at  timestamptz not null default now()
);

insert into public.payment_methods (name, sort_order) values
    ('우리카드', 1),
    ('삼성카드', 2),
    ('NH카드', 3),
    ('KB카드', 4),
    ('현대카드', 5),
    ('현금', 6),
    ('송금', 7),
    ('기타', 8)
on conflict (name) do nothing;

-- ---------- transactions: 결제수단 / 세금계산서 발행여부 ----------
alter table public.transactions
    add column if not exists payment_method_id uuid references public.payment_methods(id),
    add column if not exists tax_invoice_issued boolean not null default false;

-- 기존 card_company 값을 결제수단 목록에 매핑 (프리셋에 있는 이름이면 그대로 연결)
update public.transactions t
set payment_method_id = pm.id
from public.payment_methods pm
where t.payment_method_id is null
  and t.card_company is not null
  and trim(t.card_company) <> ''
  and pm.name = trim(t.card_company);

-- 프리셋에 없는 카드사명이 적혀있던 기존 거래는 "기타"로
update public.transactions t
set payment_method_id = (select id from public.payment_methods where name = '기타')
where t.payment_method_id is null
  and t.card_company is not null
  and trim(t.card_company) <> '';

-- card_company가 비어있던 기존 거래는 "송금"으로
update public.transactions t
set payment_method_id = (select id from public.payment_methods where name = '송금')
where t.payment_method_id is null
  and (t.card_company is null or trim(t.card_company) = '');

-- ---------- credit_payments: 정산 시 생성된 매입 항목과 연결 ----------
alter table public.credit_payments
    add column if not exists settlement_transaction_id uuid references public.transactions(id) on delete set null;

-- ============================================================
-- RLS
-- ============================================================
alter table public.payment_methods enable row level security;

create policy "authenticated all payment_methods" on public.payment_methods
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 실행 후 확인:
-- select * from public.payment_methods order by sort_order;
-- select id, card_company, payment_method_id, tax_invoice_issued from public.transactions limit 20;
