-- Politiques : ciblage par rôle (gestionnaires, administrateurs) et par poste / titre.
-- Une politique vise toute sa clinique si départements, employés, rôles et postes sont tous vides ;
-- sinon les employés qui correspondent à au moins un critère.
-- Peut être relancé sans effet de bord.
alter table public.politiques add column if not exists roles text[] not null default '{}';
alter table public.politiques add column if not exists postes text[] not null default '{}';
comment on column public.politiques.roles is 'Rôles visés : gestionnaire, admin (l''administrateur global compte comme admin)';
comment on column public.politiques.postes is 'Postes / titres visés (comparaison sans accents ni majuscules)';
