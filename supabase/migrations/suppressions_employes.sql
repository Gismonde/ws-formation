-- Traçabilité des suppressions définitives d'employés archivés (administrateurs globaux seulement).
-- On conserve l'identité minimale de la personne supprimée, la raison, l'auteur et un résumé des données effacées.
create table if not exists public.suppressions_employes (
  id uuid primary key default gen_random_uuid(),
  employe_id uuid not null,
  prenom text,
  nom text,
  email text,
  role text,
  clinique text,
  raison text not null,
  resume jsonb,
  supprime_par uuid,
  supprime_par_nom text,
  supprime_le timestamptz not null default now()
);
create index if not exists suppressions_employes_date on public.suppressions_employes (supprime_le desc);
-- Accès uniquement par la clé de service (aucune politique RLS pour les utilisateurs)
alter table public.suppressions_employes enable row level security;
