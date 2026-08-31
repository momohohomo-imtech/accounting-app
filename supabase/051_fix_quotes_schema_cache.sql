-- target_amount가 실제로 있는지 다시 한 번 보장하고(이미 있으면 아무 일 없음),
-- PostgREST(Supabase API 레이어)가 최신 스키마를 다시 읽도록 강제로 알림.
-- "Could not find the 'target_amount' column of 'quotes' in the schema cache" 에러 대응.
alter table public.quotes add column if not exists target_amount numeric;

notify pgrst, 'reload schema';
