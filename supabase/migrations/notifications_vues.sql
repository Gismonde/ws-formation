-- Notifications : date de dernière ouverture de la cloche, commune à tous les appareils de l'employé.
-- À exécuter une fois dans Supabase → SQL Editor. Peut être relancé sans effet de bord.
alter table public.employes add column if not exists notifications_vues_le timestamptz;

select count(*) as colonne from information_schema.columns where table_schema = 'public' and table_name = 'employes' and column_name = 'notifications_vues_le';
