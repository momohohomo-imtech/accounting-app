-- 결제수단 이름에 글씨색/배경색을 지정할 수 있게 — 공구(tools)의 text_color/
-- background_color와 같은 방식(고정 팔레트 중 택1, 값은 hex 문자열 또는 null).
alter table public.payment_methods add column if not exists text_color text;
alter table public.payment_methods add column if not exists background_color text;
