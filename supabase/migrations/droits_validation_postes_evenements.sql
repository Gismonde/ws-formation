-- Droits des gestionnaires, validation des formations, liste officielle des postes, événements en présentiel.
-- N'efface aucune donnée. Peut être relancé sans effet de bord.

-- 1. Droits des gestionnaires (les administrateurs ont toujours tous les droits)
alter table public.employes add column if not exists peut_suivre_employes boolean not null default false;
alter table public.employes add column if not exists peut_valider_formations boolean not null default false;
alter table public.employes add column if not exists peut_creer_evenements boolean not null default false;

-- 2. Validation des formations avant publication
--    brouillon → en_validation → approuvee (ou a_modifier → retour au créateur) ; après publication : brouillon
--    (la version suivante devra à nouveau être validée)
alter table public.formations add column if not exists statut_validation text not null default 'brouillon';
alter table public.formations add column if not exists validateur_id uuid references public.employes(id) on delete set null;
alter table public.formations add column if not exists validation_demandee_le timestamptz;
alter table public.formations add column if not exists validation_demandee_par uuid references public.employes(id) on delete set null;
alter table public.formations add column if not exists validation_le timestamptz;
alter table public.formations add column if not exists validation_commentaire text;
alter table public.formations add column if not exists validee_par uuid references public.employes(id) on delete set null;
do $$ begin
  alter table public.formations add constraint formations_statut_validation_ck
    check (statut_validation in ('brouillon', 'en_validation', 'a_modifier', 'approuvee'));
exception when duplicate_object then null; end $$;

-- 3. Liste officielle des postes (gérée par les administrateurs)
create table if not exists public.postes (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique,
  famille text not null,
  ordre integer not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.postes enable row level security;
drop policy if exists postes_lecture on public.postes;
create policy postes_lecture on public.postes for select to authenticated using (true);
insert into public.postes (nom, famille, ordre) values
  ('Chef infirmière', 'Soins infirmiers', 1),
  ('Infirmière clinicienne', 'Soins infirmiers', 2),
  ('Infirmière', 'Soins infirmiers', 3),
  ('Infirmière auxiliaire', 'Soins infirmiers', 4),
  ('Infirmière de recherche', 'Soins infirmiers', 5),
  ('Préposée aux bénéficiaires', 'Soins infirmiers', 6),
  ('Infirmière de bloc opératoire', 'Bloc opératoire', 1),
  ('Inhalothérapeute', 'Bloc opératoire', 2),
  ('Technicienne en stérilisation', 'Bloc opératoire', 3),
  ('Médecin', 'Médical', 1),
  ('Chirurgien', 'Médical', 2),
  ('Anesthésiste', 'Médical', 3),
  ('Direction', 'Administration', 1),
  ('Gestionnaire', 'Administration', 2),
  ('Gestionnaire de projet', 'Administration', 3),
  ('Adjointe administrative', 'Administration', 4),
  ('Agente administrative', 'Administration', 5),
  ('Réceptionniste', 'Réception', 1),
  ('Coordonnatrice', 'Réception', 2),
  ('Conseillère en ressources humaines', 'Ressources humaines', 1),
  ('Technicien informatique', 'Technologies de l''information', 1),
  ('Préposé à l''entretien', 'Entretien', 1),
  ('Recherche', 'Recherche', 1)
on conflict (nom) do nothing;

-- 4. Événements de formation en présentiel
create table if not exists public.evenements (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text,
  image text,
  lieu text,
  responsable text,
  clinique text not null default 'LES_DEUX',
  departements uuid[] not null default '{}',
  employes uuid[] not null default '{}',
  roles text[] not null default '{}',
  postes text[] not null default '{}',
  obligatoire boolean not null default false,
  desinscription_heures integer not null default 24,
  formation_id uuid references public.formations(id) on delete set null,
  duree_minutes integer,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'publie', 'annule')),
  publie_le timestamptz,
  cree_par uuid references public.employes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.evenements_seances (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenements(id) on delete cascade,
  debut timestamptz not null,
  fin timestamptz not null,
  places integer not null default 10 check (places > 0),
  lieu text,
  annulee boolean not null default false,
  rappel_envoye boolean not null default false,
  sondage_envoye boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.evenements_inscriptions (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenements(id) on delete cascade,
  seance_id uuid not null references public.evenements_seances(id) on delete cascade,
  employe_id uuid not null references public.employes(id) on delete cascade,
  statut text not null default 'inscrit' check (statut in ('inscrit', 'attente', 'annule')),
  present boolean,
  presence_le timestamptz,
  inscrit_le timestamptz not null default now(),
  annule_le timestamptz,
  unique (seance_id, employe_id)
);
create index if not exists evenements_inscriptions_evenement on public.evenements_inscriptions (evenement_id, statut);
create index if not exists evenements_seances_evenement on public.evenements_seances (evenement_id, debut);
-- Accès uniquement par le serveur (clé de service) : RLS activé sans règle publique
alter table public.evenements enable row level security;
alter table public.evenements_seances enable row level security;
alter table public.evenements_inscriptions enable row level security;

select
  (select count(*) from public.postes) as postes,
  (select count(*) from public.formations) as formations,
  to_regclass('public.evenements') is not null as evenements_ok;
