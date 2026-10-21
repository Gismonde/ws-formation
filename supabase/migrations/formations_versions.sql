-- Suivi des publications d'une formation : date de première publication, version en cours et journal des versions.
alter table public.formations add column if not exists publiee_le timestamptz;
alter table public.formations add column if not exists version integer not null default 1;
alter table public.formations add column if not exists version_le timestamptz;

create table if not exists public.formations_versions (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.formations(id) on delete cascade,
  version integer not null,
  publiee_le timestamptz not null default now(),
  note text,
  publiee_par uuid references public.employes(id) on delete set null,
  unique (formation_id, version)
);
alter table public.formations_versions enable row level security;
-- Lecture par les utilisateurs connectés (affichage) ; écriture par la clé de service seulement
drop policy if exists formations_versions_lecture on public.formations_versions;
create policy formations_versions_lecture on public.formations_versions for select to authenticated using (true);

-- Formations déjà publiées : version 1 datée de leur création
update public.formations set publiee_le = coalesce(publiee_le, created_at), version_le = coalesce(version_le, created_at) where publiee and publiee_le is null;
insert into public.formations_versions (formation_id, version, publiee_le, note)
select id, 1, publiee_le, 'Publication initiale' from public.formations f
where publiee and not exists (select 1 from public.formations_versions v where v.formation_id = f.id);
