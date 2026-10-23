-- Modèles de leçons enregistrés par les équipes (en plus des modèles intégrés).
-- À exécuter une fois dans Supabase → SQL Editor. Peut être relancé sans effet de bord.
create table if not exists public.modeles_lecons (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  description text,
  icone text not null default '⭐',
  clinique text not null default 'LES_DEUX' check (clinique in ('CMC', 'WSSC', 'LES_DEUX')),
  attestation boolean not null default false,
  blocs jsonb not null default '[]'::jsonb,
  cree_par uuid references public.employes(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_modeles_lecons_clinique on public.modeles_lecons (clinique);
-- Lecture et écriture par le serveur seulement (clé de service), après contrôle des droits
alter table public.modeles_lecons enable row level security;

select count(*) as modeles_lecons from information_schema.tables where table_schema = 'public' and table_name = 'modeles_lecons';
