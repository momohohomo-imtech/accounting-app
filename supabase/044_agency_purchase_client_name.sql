-- 대행구매 품목에 매입처(거래처) 이름을 남길 수 있게 추가. 거래처 테이블과 연결하지 않고
-- transactions.client_name_raw와 동일한 자유입력 방식(선택 강제 없이 직접 타이핑, 기존
-- 거래처명은 자동완성 후보로만 제시)으로 둠.
alter table public.project_agency_purchases
  add column if not exists client_name text;
