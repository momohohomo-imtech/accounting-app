-- 거래처마다 기본 지출카테고리를 저장해두고, 매입 등록 시 거래처 선택하면
-- 카테고리도 자동으로 채워주기 위한 컬럼 (기본 품목 자동 입력과 동일한 패턴).
alter table public.clients
  add column if not exists default_category_id uuid references public.expense_categories(id) on delete set null;
