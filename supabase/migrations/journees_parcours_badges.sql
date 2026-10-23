-- Journées de formation → parcours : ordre imposé des formations et badge de fin.
-- À exécuter une fois dans Supabase → SQL Editor. Peut être relancé sans effet de bord.
alter table public.journees_formation add column if not exists ordre_impose boolean not null default false;
alter table public.journees_formation add column if not exists badge_icone text not null default '🏅';

select count(*) as colonnes from information_schema.columns
where table_schema = 'public' and table_name = 'journees_formation' and column_name in ('ordre_impose', 'badge_icone');
