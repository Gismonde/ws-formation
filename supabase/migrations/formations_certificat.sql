-- Chaque formation peut délivrer ou non un certificat de complétion (par défaut : oui).
alter table public.formations add column if not exists delivre_certificat boolean not null default true;
