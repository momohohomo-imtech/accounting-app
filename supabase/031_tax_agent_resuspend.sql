-- 세무사 계정 정지 해제 시 "몇 시간만 열어주고 자동으로 다시 정지"를 지원하기 위한 예약 시각.
alter table public.users add column if not exists resuspend_at timestamptz;
