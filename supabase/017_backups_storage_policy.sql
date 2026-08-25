-- "backups" 버킷에 로그인 사용자가 업로드/다운로드할 수 있게 하는 정책.
-- schema.sql에 있었지만(버킷과 마찬가지로) 실제로는 적용되어 있지 않았음.
drop policy if exists "authenticated backups access" on storage.objects;
create policy "authenticated backups access" on storage.objects
  for all using (bucket_id = 'backups' and auth.role() = 'authenticated')
  with check (bucket_id = 'backups' and auth.role() = 'authenticated');
