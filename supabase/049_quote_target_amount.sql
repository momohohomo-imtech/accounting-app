-- 견적 작성 중 내부 참고용 목표 금액 — 현재 작성 중인 견적 합계와 비교해서
-- 차액을 보여주는 용도. 인쇄/엑셀/PDF에는 절대 노출 안 됨(작성 화면 전용).
alter table public.quotes add column if not exists target_amount numeric;
