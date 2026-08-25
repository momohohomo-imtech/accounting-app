-- 거래처마다 항상 같은 품목만 거래하는 경우가 많아서, 거래처에 기본 품목을 저장해두고
-- 거래 등록 시 거래처 선택하면 자동으로 채워주기 위한 컬럼.
alter table public.clients add column if not exists default_item_name text;
