-- Droit des gestionnaires (CMC) : assigner des formations aux membres externes de la clinique.
alter table public.employes add column if not exists peut_assigner_externes boolean not null default false;
select count(*) filter (where peut_assigner_externes) as avec_droit, count(*) as total from public.employes;
