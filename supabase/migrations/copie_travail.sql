-- Copie de travail d'une formation publiée : on modifie une copie (invisible des employés),
-- on la fait valider, puis on l'applique d'un coup à la formation publiée.
-- À exécuter une fois dans Supabase → SQL Editor. Peut être relancé sans effet de bord.

-- 1. Lien copie → formation publiée (une seule copie en cours par formation)
alter table public.formations add column if not exists copie_de uuid references public.formations(id) on delete cascade;
create unique index if not exists ux_formations_copie_de on public.formations (copie_de) where copie_de is not null;

-- 2. Correspondance des éléments copiés avec ceux d'origine (pour conserver la progression des employés)
alter table public.modules add column if not exists origine_id uuid;
alter table public.lessons add column if not exists origine_id uuid;
alter table public.content_blocks add column if not exists origine_id uuid;

-- 3. Application de la copie, en une seule transaction :
--    progression et preuves de lecture rattachées aux nouveaux modules / leçons / blocs,
--    ancien contenu remplacé par celui de la copie, questionnaire mis à jour (historique des tentatives conservé).
create or replace function public.appliquer_copie_formation(p_copie uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_orig uuid;
  q_orig uuid;
  q_copie uuid;
begin
  select copie_de into v_orig from formations where id = p_copie for update;
  if v_orig is null then raise exception 'Cette formation n''est pas une copie de travail'; end if;
  perform 1 from formations where id = v_orig for update;

  -- Progression des employés → éléments correspondants de la copie
  update lesson_progressions lp set lesson_id = l.id
    from lessons l join modules m on m.id = l.module_id
    where m.formation_id = p_copie and l.origine_id = lp.lesson_id;
  update preuves_lecture p set bloc_id = b.id
    from content_blocks b join lessons l on l.id = b.lesson_id join modules m on m.id = l.module_id
    where m.formation_id = p_copie and b.origine_id = p.bloc_id;
  update preuves_lecture p set lesson_id = l.id
    from lessons l join modules m on m.id = l.module_id
    where m.formation_id = p_copie and l.origine_id = p.lesson_id;
  update progressions pr set module_id = m.id
    from modules m
    where m.formation_id = p_copie and m.origine_id = pr.module_id and pr.formation_id = v_orig;
  -- Modules retirés dans la copie : leur progression n'a plus d'objet
  delete from progressions where formation_id = v_orig and module_id in (select id from modules where formation_id = v_orig);

  -- Contenu : l'ancien est remplacé par celui de la copie
  delete from modules where formation_id = v_orig;
  update modules set formation_id = v_orig where formation_id = p_copie;

  -- Questionnaire : on garde la même fiche (et donc les tentatives déjà faites), avec les nouvelles questions
  select id into q_orig from questionnaires where formation_id = v_orig and actif order by created_at desc limit 1;
  select id into q_copie from questionnaires where formation_id = p_copie and actif order by created_at desc limit 1;
  if q_copie is not null and q_orig is not null then
    delete from questions where questionnaire_id = q_orig;
    update questions set questionnaire_id = q_orig where questionnaire_id = q_copie;
    update questionnaires o set description = c.description, note_passage = c.note_passage,
      nb_tentatives_max = c.nb_tentatives_max, duree_minutes = c.duree_minutes
      from questionnaires c where o.id = q_orig and c.id = q_copie;
  elsif q_copie is not null then
    update questionnaires set formation_id = v_orig where id = q_copie;
  elsif q_orig is not null then
    update questionnaires set actif = false where id = q_orig;
  end if;

  return v_orig;
end $$;
revoke all on function public.appliquer_copie_formation(uuid) from public, anon, authenticated;
grant execute on function public.appliquer_copie_formation(uuid) to service_role;

-- Vérification
select
  (select count(*) from information_schema.columns where table_schema = 'public' and column_name = 'copie_de' and table_name = 'formations') as copie_de,
  (select count(*) from information_schema.columns where table_schema = 'public' and column_name = 'origine_id' and table_name in ('modules', 'lessons', 'content_blocks')) as origine_id,
  (select count(*) from pg_proc where proname = 'appliquer_copie_formation') as fonction;
