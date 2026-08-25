-- 영수증 버킷 접근 정책도 schema.sql에 있었지만 실제로는 안 만들어져 있었음
-- (backups/receipts 버킷 생성 때와 같은 문제).
drop policy if exists "authenticated receipts access" on storage.objects;
create policy "authenticated receipts access" on storage.objects
  for all using (bucket_id = 'receipts' and auth.role() = 'authenticated')
  with check (bucket_id = 'receipts' and auth.role() = 'authenticated');
