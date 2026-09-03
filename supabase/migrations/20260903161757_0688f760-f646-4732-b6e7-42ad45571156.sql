do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='reference_v2_originals_select_own') then
    create policy "reference_v2_originals_select_own" on storage.objects for select to authenticated
      using (bucket_id = 'originals' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='reference_v2_originals_insert_own') then
    create policy "reference_v2_originals_insert_own" on storage.objects for insert to authenticated
      with check (bucket_id = 'originals' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;