-- 지출카테고리별 "비과세" 표시(부가세가 없는 지출 — 인건비, 직원급여/상여/4대보험, 면세).
-- 지금까지는 카테고리 이름으로 비과세를 판단해서 이름을 바꾸면 부가세가 있는 것처럼 계산됐다.
-- 기존 세 카테고리에만 체크를 켜고, 거래 금액 등 다른 데이터는 전혀 바꾸지 않는다.
alter table public.expense_categories
  add column if not exists vat_exempt boolean not null default false;

update public.expense_categories
  set vat_exempt = true
  where name in ('인건비', '직원급여/상여/4대보험', '면세');
