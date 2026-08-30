-- 대행구매 품목에도 지출카테고리를 지정할 수 있게 해서, 프로젝트 손익보고서의
-- 카테고리별 매입 그래프에 대행구매 금액도 같이 반영하기 위한 컬럼.
alter table public.project_agency_purchases
  add column if not exists category_id uuid references public.expense_categories(id) on delete set null;
