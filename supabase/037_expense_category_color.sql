-- 지출카테고리마다 고유 색을 지정해서, 매입매출 목록/프로젝트 손익보고서 등 카테고리 이름이
-- 나오는 곳마다 그 색으로 표시하기 위한 컬럼. 지정 안 하면 기존처럼(project_only만 빨간색,
-- 그 외 기본 텍스트색) 동작함 — sites.color와 동일한 "지정 없으면 기본값" 패턴.
alter table public.expense_categories
  add column if not exists color text;
