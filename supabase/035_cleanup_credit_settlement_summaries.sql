-- 외상 정산 로직을 "합계 거래 1건 생성" 방식에서 "원본 거래를 그대로 장부에 편입" 방식으로
-- 바꾸면서(2026-08-30), 예전 방식으로 이미 만들어졌던 합계 거래("외상 정산 (N건)")는 이제
-- 필요 없어짐 — 그대로 두면 원본 거래(이제 장부에 새로 편입됨)와 이중집계됨.
--
-- 아래 SELECT로 먼저 몇 건/얼마인지 확인하고, 맞으면 DELETE를 실행하세요.
-- 원본 개별 거래(품목/카테고리/프로젝트 있는 것들)는 이 조건에 안 걸리니 안전합니다.

-- 1) 미리보기: 지워질 대상 확인
select id, trans_date, client_id, client_name_raw, item_name, purchase_amount, purchase_vat, sales_amount, sales_vat
from public.transactions
where item_name ~ '^외상 정산 \(\d+건\)$'
  and project_id is null
  and category_id is null
order by trans_date;

-- 2) 위 목록이 맞으면 아래 DELETE 실행 (credit_payments.settlement_transaction_id는
--    on delete set null이라 정산 이력 자체는 안 지워지고 연결만 끊깁니다)
-- delete from public.transactions
-- where item_name ~ '^외상 정산 \(\d+건\)$'
--   and project_id is null
--   and category_id is null;
