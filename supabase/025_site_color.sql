-- 현장마다 자동으로 배정되는 고유색을 필요하면 수동으로 덮어쓸 수 있게 컬럼 추가.
-- null이면 기존처럼 site id를 해시해서 자동으로 색을 만든다.
alter table public.sites add column if not exists color text;
