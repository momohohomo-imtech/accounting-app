-- 은행 거래내역 체크박스로 매입/매출장(transactions)에 올린 건을 추적하는 링크.
-- 체크 해제하면 이 값을 기준으로 만들어둔 transactions 행을 다시 지운다.
alter table public.bank_transactions
  add column if not exists promoted_transaction_id uuid references public.transactions(id) on delete set null;
