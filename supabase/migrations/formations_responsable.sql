-- Nom du responsable de la formation, affiché sur le certificat.
alter table public.formations add column if not exists responsable_formation text;
