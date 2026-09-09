-- 은행 거래내역: 등록된 거래처가 없을 때 수기로 거래처명을 입력할 수 있게 함
-- (transactions.client_name_raw 와 동일한 패턴 — matched_client_id 가 비어있을 때의 보조 텍스트)
alter table public.bank_transactions
  add column matched_client_name_raw text;
