-- 백업 파일을 저장할 storage 버킷 생성 (schema.sql에 있었지만 실제로는 안 만들어져 있었음).
insert into storage.buckets (id, name, public) values ('backups', 'backups', false)
  on conflict (id) do nothing;
