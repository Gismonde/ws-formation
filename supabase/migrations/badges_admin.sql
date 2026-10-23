-- Badges réglables par l'administration : réglages des badges intégrés et badges créés par les cliniques.
-- À exécuter une fois dans Supabase → SQL Editor. Peut être relancé sans effet de bord.
create table if not exists public.badges_reglages (
  cle text primary key,
  actif boolean not null default true,
  icone text,
  titre text,
  description text,
  seuils integer[],
  modifie_par uuid references public.employes(id) on delete set null,
  modifie_le timestamptz not null default now()
);
create table if not exists public.badges_perso (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  description text,
  icone text not null default '⭐',
  clinique text not null default 'LES_DEUX' check (clinique in ('CMC', 'WSSC', 'LES_DEUX')),
  formation_ids uuid[] not null default '{}',
  actif boolean not null default true,
  cree_par uuid references public.employes(id) on delete set null,
  created_at timestamptz not null default now()
);
-- Accès par le serveur seulement (clé de service), après contrôle des droits
alter table public.badges_reglages enable row level security;
alter table public.badges_perso enable row level security;

select count(*) as tables from information_schema.tables where table_schema = 'public' and table_name in ('badges_reglages', 'badges_perso');
