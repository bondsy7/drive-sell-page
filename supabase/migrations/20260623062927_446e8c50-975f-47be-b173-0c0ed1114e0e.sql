
create policy "Users read own songs" on storage.objects for select to authenticated
  using (bucket_id = 'songs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users upload own songs" on storage.objects for insert to authenticated
  with check (bucket_id = 'songs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own songs" on storage.objects for delete to authenticated
  using (bucket_id = 'songs' and (storage.foldername(name))[1] = auth.uid()::text);
