-- Heures de formation continue créditables (ordres professionnels). Ne supprime rien.
alter table public.formations add column if not exists credits_admissible boolean not null default false;
alter table public.formations add column if not exists credits_heures numeric(5,2);
alter table public.formations add column if not exists credits_organisme text;
alter table public.formations add column if not exists credits_numero text;
select count(*) as formations from public.formations;
