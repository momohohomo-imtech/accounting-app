-- 출장일지 목록의 "공사일수"를 자동 계산(프로젝트별 공사일 중 서로 다른 날짜 수)만
-- 쓰지 않고 사용자가 직접 값을 입력/수정할 수 있게 컬럼 추가. null이면 화면에서
-- 기존처럼 자동 계산값을 보여주고, 값이 있으면 그 값을 그대로 씀.
alter table public.business_trip_logs add column if not exists day_count integer;
