-- Catégories de la librairie (arbre à deux niveaux : catégorie > sous-catégorie), ordre choisi.
-- Les éléments de la librairie gardent le nom de leur catégorie dans librairie.categorie.
create table if not exists public.librairie_categories (
  id         uuid primary key default gen_random_uuid(),
  nom        text not null check (char_length(nom) between 1 and 80),
  parent_id  uuid references public.librairie_categories(id) on delete set null,
  ordre      integer not null default 0,
  cree_le    timestamptz not null default now()
);
create unique index if not exists librairie_categories_nom_idx on public.librairie_categories (lower(nom));
alter table public.librairie_categories enable row level security;

-- Catégories de départ (comme la plateforme GrS), si la liste est vide
do $$
declare p1 uuid; p2 uuid;
begin
  if not exists (select 1 from public.librairie_categories) then
    insert into public.librairie_categories (nom, ordre) values ('Formations organisationnelles', 1) returning id into p1;
    insert into public.librairie_categories (nom, parent_id, ordre) values ('Politiques et procédures', p1, 1);
    insert into public.librairie_categories (nom, ordre) values
      ('Formations cliniques', 2), ('Formations en santé et sécurité au travail', 3), ('Formation en gestion de risques', 4),
      ('Formations en gestion', 5), ('Formations en santé publique', 6);
    insert into public.librairie_categories (nom, ordre) values ('Formation continue', 7) returning id into p2;
    insert into public.librairie_categories (nom, parent_id, ordre) values ('Clinique postopératoire', p2, 1), ('Clinique préopératoire', p2, 2);
  end if;
end $$;

-- Catégories déjà utilisées dans la librairie : ajoutées à la liste
insert into public.librairie_categories (nom, ordre)
select distinct trim(categorie), 100 from public.librairie
where coalesce(trim(categorie), '') <> ''
  and not exists (select 1 from public.librairie_categories c where lower(c.nom) = lower(trim(librairie.categorie)))
on conflict do nothing;

select count(*) as categories, count(parent_id) as sous_categories from public.librairie_categories;
