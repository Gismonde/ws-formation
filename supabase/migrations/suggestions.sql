-- « Aidez-nous à nous améliorer » : suggestions des employés (demande de formation, commentaire, idée pour la plateforme).
-- À exécuter une fois dans Supabase → SQL Editor. Peut être relancé sans effet de bord.
create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('formation', 'commentaire', 'plateforme')),
  formation_id uuid references public.formations(id) on delete set null,
  sujet text,
  message text not null,
  -- Nominatif : employe_id ; anonyme : employe_id vide (le nom n'est jamais enregistré)
  employe_id uuid references public.employes(id) on delete set null,
  anonyme boolean not null default false,
  -- Empreinte non réversible de l'auteur : limite de 3 par semaine et « Mes suggestions », même en anonyme
  empreinte text not null,
  clinique text,
  statut text not null default 'nouvelle' check (statut in ('nouvelle', 'en_etude', 'planifiee', 'realisee', 'refusee')),
  reponse text,
  repondu_par uuid references public.employes(id) on delete set null,
  repondu_le timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_suggestions_empreinte on public.suggestions (empreinte, created_at);
create index if not exists idx_suggestions_statut on public.suggestions (statut, created_at);
-- Accès par le serveur seulement (clé de service), après contrôle des droits
alter table public.suggestions enable row level security;

select count(*) as suggestions from information_schema.tables where table_schema = 'public' and table_name = 'suggestions';
