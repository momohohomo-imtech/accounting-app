-- 지출카테고리별 "매입세액 불공제" 표시(예: 승용차 렌트·유류비). 체크된 카테고리의 매입세액은
-- 대시보드 부가세 집계에서 공제 대상에서 빼고 따로 보여준다. 기존 카테고리는 전부 false로
-- 시작하며, 기존 거래 금액 등 다른 데이터는 전혀 바뀌지 않는다.
alter table public.expense_categories
  add column if not exists vat_non_deductible boolean not null default false;
