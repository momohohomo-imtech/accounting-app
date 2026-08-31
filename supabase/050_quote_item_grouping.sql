-- 견적 품목 여러 개를 하나로 묶어서 보여주는 기능.
-- group_label이 같은 행들이 한 그룹 — is_group_summary=true인 행만 실제
-- 화면/인쇄/엑셀에 보이고, 나머지(묶인 원본 항목들)는 작성 화면에서만
-- 참고용으로 보이고 인쇄/엑셀/PDF에는 안 나감.
alter table public.quote_items
  add column if not exists unit text,
  add column if not exists group_label text,
  add column if not exists is_group_summary boolean not null default false;
