-- Moon3D — schema inicial. Esta migration já foi aplicada no projeto Supabase.
create table if not exists public.moon3d_state (
  id text primary key check (id = 'main'),
  payload jsonb not null default '{
    "compras": [],
    "vendas": [],
    "orcamentos": [],
    "produtos": [],
    "adicionais": [],
    "embalagens": [],
    "settings": {
      "filamentoKg": 100,
      "labor": 30,
      "energia": 0.20,
      "depreciacao": 0.25,
      "quebra": 8,
      "otherCosts": []
    }
  }'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.moon3d_state enable row level security;
revoke all on table public.moon3d_state from anon, authenticated;
grant select, insert, update on table public.moon3d_state to authenticated;

drop policy if exists "Moon3D only shared email can read state" on public.moon3d_state;
drop policy if exists "Moon3D only shared email can insert state" on public.moon3d_state;
drop policy if exists "Moon3D only shared email can update state" on public.moon3d_state;

create policy "Moon3D only shared email can read state"
  on public.moon3d_state for select to authenticated
  using ((auth.jwt() ->> 'email') = 'moon3d.oficial@gmail.com');

create policy "Moon3D only shared email can insert state"
  on public.moon3d_state for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'moon3d.oficial@gmail.com' and id = 'main');

create policy "Moon3D only shared email can update state"
  on public.moon3d_state for update to authenticated
  using ((auth.jwt() ->> 'email') = 'moon3d.oficial@gmail.com' and id = 'main')
  with check ((auth.jwt() ->> 'email') = 'moon3d.oficial@gmail.com' and id = 'main');

insert into public.moon3d_state (id) values ('main') on conflict (id) do nothing;