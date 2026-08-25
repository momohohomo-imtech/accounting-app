-- 일용직 근로자 명단 반입을 위한 컬럼 추가 (등급/마스킹된 주민번호/능력/계좌).
alter table public.daily_workers
  add column if not exists grade text,
  add column if not exists resident_id_masked text,
  add column if not exists language_ability text,
  add column if not exists other_ability text,
  add column if not exists bank_name text,
  add column if not exists account_number text;
