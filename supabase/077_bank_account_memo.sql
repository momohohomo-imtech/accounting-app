-- 은행 계좌 카드에 계좌별 자유 메모장을 추가.
alter table public.bank_accounts add column if not exists memo text;
