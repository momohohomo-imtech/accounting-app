-- 지출카테고리에 "프로젝트 전용" 구분 추가.
-- project_only = true (빨간색 표시): 부품/원자재/기타잡자재/지출/숙박비/식대 — 항상 특정 프로젝트에
--   귀속되는 지출.
-- project_only = false (기본, 검정색 표시): 물품/차량/출장/기타 등 — 프로젝트에 걸릴 수도, 일반경비로
--   남을 수도 있는 지출. 기존 카테고리(접대/회식/인건비/면세/직원급여 등)는 삭제하지 않고 그대로 두되
--   기본값(false)을 따른다.
alter table public.expense_categories add column if not exists project_only boolean not null default false;

insert into public.expense_categories (name, sort_order, project_only) values
    ('기타', 5, false),
    ('부품', 20, true),
    ('원자재', 21, true),
    ('기타잡자재', 22, true),
    ('지출', 23, true),
    ('숙박비', 24, true),
    ('식대', 25, true)
on conflict (name) do nothing;

update public.expense_categories
  set project_only = true
  where name in ('부품', '원자재', '기타잡자재', '지출', '숙박비', '식대');
