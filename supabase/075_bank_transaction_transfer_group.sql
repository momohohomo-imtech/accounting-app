-- 계좌 간 이체 시 양쪽에 자동 생성되는 두 거래를 하나로 묶어두는 값.
-- 같은 값을 가진 두 행은 "짝"이라, 한쪽을 지우면 반대쪽도 같이 지운다.
alter table public.bank_transactions add column if not exists transfer_group_id uuid;
