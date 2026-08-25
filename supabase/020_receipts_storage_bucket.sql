-- 영수증 이미지를 저장할 storage 버킷 생성 (schema.sql에 있었지만 실제로는 안 만들어져 있었음,
-- backups 버킷 때와 같은 문제).
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false)
  on conflict (id) do nothing;
