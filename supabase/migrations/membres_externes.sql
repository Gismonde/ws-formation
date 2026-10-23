-- Membres externes (CMC) : mêmes fonctions et autorisations qu'un employé (rôle « employe »),
-- mais identifiés comme externes à la clinique, avec leur organisation.
alter table public.employes add column if not exists externe boolean not null default false;
alter table public.employes add column if not exists organisation text;
create index if not exists employes_externe_idx on public.employes (externe) where externe;
select count(*) filter (where externe) as externes, count(*) as total from public.employes;
