-- Blocs interactifs (cartes, accordéon, étapes, ligne du temps, avant/après, animation, zones cliquables,
-- trouvez l'erreur, mise en situation, glisser-déposer) et apparition progressive des blocs d'une leçon.
-- Ne supprime rien.
alter type public.content_block_type add value if not exists 'interactif';
alter table public.lessons add column if not exists apparition_progressive boolean not null default false;
