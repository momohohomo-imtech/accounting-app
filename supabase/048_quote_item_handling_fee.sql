-- 견적 품목별 핸들링 fee(%, 내부 마진용) — 견적서 작성 화면에서만 보이고
-- 인쇄/엑셀/PDF에는 절대 노출 안 됨(고객에게는 이미 반영된 확정금액만 보임).
-- note는 인쇄/엑셀 품목표의 "비고" 칸(외부 노출용, handling_fee_pct와는 무관).
alter table public.quote_items
  add column if not exists handling_fee_pct numeric not null default 0,
  add column if not exists note text;
