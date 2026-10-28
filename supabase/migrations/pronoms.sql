-- Pronoms (facultatifs), saisis par la personne elle-même dans « Mon profil ».
alter table public.employes add column if not exists pronoms text;
alter table public.employes drop constraint if exists employes_pronoms_longueur;
alter table public.employes add constraint employes_pronoms_longueur check (pronoms is null or char_length(pronoms) <= 40);
select count(*) as total, count(pronoms) as avec_pronoms from public.employes;
