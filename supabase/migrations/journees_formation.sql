-- Journées de formation : parcours (raison + formations + politiques + éléments de librairie à visionner)
-- lancés pour des employés. modele = true : modèle réutilisable (sans employés).
create table if not exists public.journees_formation (
  id uuid primary key default gen_random_uuid(),
  modele boolean not null default false,
  nom text not null,
  raison text not null,
  clinique text not null default 'LES_DEUX',
  formation_ids uuid[] not null default '{}',
  politique_ids uuid[] not null default '{}',
  librairie_ids uuid[] not null default '{}',
  employe_ids uuid[] not null default '{}',
  date_journee date,
  date_echeance date,
  note text,
  cree_par uuid references public.employes(id) on delete set null,
  cree_le timestamptz not null default now()
);
create index if not exists journees_formation_employes on public.journees_formation using gin (employe_ids);
-- Accès par la clé de service seulement (contrôles dans l'application)
alter table public.journees_formation enable row level security;

-- Modèles repris des anciennes « formations » Journée de formation (CMC)
insert into public.journees_formation (modele, nom, raison, clinique, formation_ids)
select true, 'Journée de formation à l’embauche', 'Embauche', 'CMC', array(
  select id from public.formations where clinique = 'CMC' and titre in (
    'Formation à l''embauche',
    'Introduction sur la diversité sexuelle et la pluralité des genres',
    'Politique de télétravail',
    'Politique sur les heures et congé - salaire annuel',
    'Politique sur l''utilisation des uniformes',
    'Formation en prévention et contrôle des infections',
    'Informations sur le comité en santé et sécurité au travail et la santé psychologique au travail'
  ) order by titre)
where not exists (select 1 from public.journees_formation where modele and nom = 'Journée de formation à l’embauche');

insert into public.journees_formation (modele, nom, raison, clinique, formation_ids)
select true, 'Journée de formation retour à l’emploi', 'Retour à l’emploi', 'CMC', array(
  select id from public.formations where clinique = 'CMC' and titre in (
    'Formation retour à l''emploi',
    'Formation sur la confidentialité et la Loi 25',
    'Introduction sur la diversité sexuelle et la pluralité des genres',
    'Politique de télétravail',
    'Politique sur les heures et congé - salaire annuel',
    'Politique sur l''utilisation des uniformes',
    'Sécurité incendie',
    'Formation en prévention et contrôle des infections',
    'Informations sur le comité en santé et sécurité au travail et la santé psychologique au travail'
  ) order by titre)
where not exists (select 1 from public.journees_formation where modele and nom = 'Journée de formation retour à l’emploi');
