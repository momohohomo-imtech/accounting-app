-- 공구별 글씨색에 이어 배경색도 지정할 수 있게 컬럼 추가(같은 6색 팔레트 재사용).
alter table public.tools add column if not exists background_color text;
