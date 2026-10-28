-- Notifications par courriel personnalisables (Admin → Paramètres → Notifications).
-- Une ligne par type modifié ; sans ligne, le texte par défaut s'applique et la notification est active.
create table if not exists public.notifications_modeles (
  cle         text primary key check (char_length(cle) between 1 and 80),
  actif       boolean not null default true,
  sujet       text check (char_length(sujet) <= 200),
  message     text check (char_length(message) <= 4000),
  bouton      text check (char_length(bouton) <= 60),
  modifie_le  timestamptz not null default now(),
  modifie_par uuid references public.employes(id) on delete set null
);
alter table public.notifications_modeles enable row level security;

-- Coordonnées affichées au pied des courriels (une seule ligne)
create table if not exists public.notifications_reglages (
  id                integer primary key default 1 check (id = 1),
  contact_libelle   text check (char_length(contact_libelle) <= 80),
  contact_courriel  text check (char_length(contact_courriel) <= 200),
  contact_telephone text check (char_length(contact_telephone) <= 40),
  modifie_le        timestamptz not null default now()
);
alter table public.notifications_reglages enable row level security;

select (select count(*) from public.notifications_modeles) as modeles, (select count(*) from public.notifications_reglages) as reglages;
