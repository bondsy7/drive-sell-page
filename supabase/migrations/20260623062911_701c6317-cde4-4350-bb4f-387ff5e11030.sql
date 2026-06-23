
create table public.user_songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Neuer Song',
  prompt text,
  lyrics text,
  storage_path text not null,
  mime_type text not null default 'audio/mpeg',
  model text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.user_songs to authenticated;
grant all on public.user_songs to service_role;

alter table public.user_songs enable row level security;

create policy "own songs select" on public.user_songs for select to authenticated using (auth.uid() = user_id);
create policy "own songs insert" on public.user_songs for insert to authenticated with check (auth.uid() = user_id);
create policy "own songs update" on public.user_songs for update to authenticated using (auth.uid() = user_id);
create policy "own songs delete" on public.user_songs for delete to authenticated using (auth.uid() = user_id);

create index user_songs_user_created_idx on public.user_songs (user_id, created_at desc);
