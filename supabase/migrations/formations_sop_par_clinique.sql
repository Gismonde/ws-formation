-- Formations et SOP rattachées à une clinique (Loi 25)
--   formations.clinique / sop.clinique : 'CMC', 'WSSC' ou 'LES_DEUX' (commune aux deux cliniques)
--
-- Qui VOIT un contenu ?
--   admin global (super_admin)        : tout
--   employé rattaché aux deux         : tout
--   employé CMC (ou WSSC)             : contenus CMC (ou WSSC) + contenus communs
--   employé sans clinique             : contenus communs seulement
--   (les employés ne voient en plus que les formations publiées qui leur sont assignées, comme avant)
--
-- Qui GÈRE (crée / modifie / supprime) un contenu ?
--   admin global                      : tout
--   admin ou gestionnaire autorisé    : contenus de SA clinique ; contenus communs seulement s'il est rattaché aux deux
--
-- Le même contrôle est appliqué au contenu des formations (modules, leçons, blocs, questionnaires, questions,
-- réponses) : impossible de lire une formation d'une autre clinique en devinant son adresse.
-- Les 25 formations reprises de GrS (tag « GrS ») sont rattachées à CMC.
--
-- À exécuter une fois dans Supabase → SQL Editor, AVANT de fusionner le code. Tout ou rien. Peut être relancé.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Colonnes

ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS clinique text NOT NULL DEFAULT 'LES_DEUX';
ALTER TABLE public.sop        ADD COLUMN IF NOT EXISTS clinique text NOT NULL DEFAULT 'LES_DEUX';

ALTER TABLE public.formations DROP CONSTRAINT IF EXISTS formations_clinique_check;
ALTER TABLE public.formations ADD CONSTRAINT formations_clinique_check CHECK (clinique IN ('CMC','WSSC','LES_DEUX'));
ALTER TABLE public.sop DROP CONSTRAINT IF EXISTS sop_clinique_check;
ALTER TABLE public.sop ADD CONSTRAINT sop_clinique_check CHECK (clinique IN ('CMC','WSSC','LES_DEUX'));

COMMENT ON COLUMN public.formations.clinique IS 'Clinique de la formation : CMC, WSSC ou LES_DEUX (commune)';
COMMENT ON COLUMN public.sop.clinique IS 'Clinique de la SOP : CMC, WSSC ou LES_DEUX (commune)';

CREATE INDEX IF NOT EXISTS formations_clinique_idx ON public.formations (clinique);
CREATE INDEX IF NOT EXISTS sop_clinique_idx ON public.sop (clinique);

-- Formations reprises de la plateforme GrS du CMC
UPDATE public.formations SET clinique = 'CMC' WHERE 'GrS' = ANY (tags) AND clinique <> 'CMC';

-- ---------------------------------------------------------------------------
-- 2. Fonctions de portée (droits du propriétaire : pas de boucle de règles)

CREATE OR REPLACE FUNCTION public.peut_voir_contenu_clinique(c text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mon_profil() p
    WHERE p.id IS NOT NULL
      AND (p.role = 'super_admin' OR c = 'LES_DEUX' OR c = ANY (public.cliniques_de(p.clinique)))
  )
$$;

CREATE OR REPLACE FUNCTION public.peut_gerer_contenu_clinique(c text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.peut_editer_formations() AND EXISTS (
    SELECT 1 FROM public.mon_profil() p
    WHERE p.role = 'super_admin'
       OR p.clinique = 'LES_DEUX'
       OR (c <> 'LES_DEUX' AND c = ANY (public.cliniques_de(p.clinique)))
  )
$$;

-- Les SOP ne sont gérées que par les administrateurs (pas les gestionnaires)
CREATE OR REPLACE FUNCTION public.peut_gerer_sop_clinique(c text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mon_profil() p
    WHERE p.role = 'super_admin'
       OR (p.role = 'admin' AND (p.clinique = 'LES_DEUX' OR (c <> 'LES_DEUX' AND c = ANY (public.cliniques_de(p.clinique)))))
  )
$$;

-- Clinique d'une formation à partir de ses éléments (sans dépendre des règles des tables)
CREATE OR REPLACE FUNCTION public.clinique_formation(fid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT clinique FROM public.formations WHERE id = fid
$$;
CREATE OR REPLACE FUNCTION public.clinique_module(mid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.clinique FROM public.modules m JOIN public.formations f ON f.id = m.formation_id WHERE m.id = mid
$$;
CREATE OR REPLACE FUNCTION public.clinique_lecon(lid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.clinique FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.formations f ON f.id = m.formation_id
  WHERE l.id = lid
$$;
CREATE OR REPLACE FUNCTION public.clinique_questionnaire(qid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.clinique FROM public.questionnaires q JOIN public.formations f ON f.id = q.formation_id WHERE q.id = qid
$$;
CREATE OR REPLACE FUNCTION public.clinique_question(quid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.clinique FROM public.questions qu
    JOIN public.questionnaires q ON q.id = qu.questionnaire_id
    JOIN public.formations f ON f.id = q.formation_id
  WHERE qu.id = quid
$$;

REVOKE EXECUTE ON FUNCTION public.peut_voir_contenu_clinique(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.peut_gerer_contenu_clinique(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.peut_gerer_sop_clinique(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.clinique_formation(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.clinique_module(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.clinique_lecon(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.clinique_questionnaire(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.clinique_question(uuid) FROM anon;

-- ---------------------------------------------------------------------------
-- 3. Formations

ALTER TABLE public.formations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS formations_employe_select ON public.formations;
DROP POLICY IF EXISTS formations_lecture_equipe ON public.formations;
DROP POLICY IF EXISTS formations_ajout_createurs ON public.formations;
DROP POLICY IF EXISTS formations_modif_createurs ON public.formations;
DROP POLICY IF EXISTS formations_suppr_createurs ON public.formations;
DROP POLICY IF EXISTS formations_lecture_clinique ON public.formations;
DROP POLICY IF EXISTS formations_ajout_clinique ON public.formations;
DROP POLICY IF EXISTS formations_modif_clinique ON public.formations;
DROP POLICY IF EXISTS formations_suppr_clinique ON public.formations;

-- Équipe : toutes les formations (brouillons compris) de ses cliniques.
-- Employé : les formations publiées qui lui sont assignées, dans ses cliniques.
CREATE POLICY formations_lecture_clinique ON public.formations FOR SELECT
  USING (
    public.peut_voir_contenu_clinique(clinique) AND (
      public.est_equipe()
      OR (publiee = true AND id IN (
        SELECT a.formation_id FROM public.assignations a
        WHERE a.employe_id = (SELECT p.id FROM public.mon_profil() p)
      ))
    )
  );
CREATE POLICY formations_ajout_clinique ON public.formations FOR INSERT
  WITH CHECK (public.peut_gerer_contenu_clinique(clinique));
CREATE POLICY formations_modif_clinique ON public.formations FOR UPDATE
  USING (public.peut_gerer_contenu_clinique(clinique))
  WITH CHECK (public.peut_gerer_contenu_clinique(clinique));
CREATE POLICY formations_suppr_clinique ON public.formations FOR DELETE
  USING (public.peut_gerer_contenu_clinique(clinique));

-- ---------------------------------------------------------------------------
-- 4. Contenu des formations : lecture si la formation est visible, écriture si sa clinique est gérable

DO $$
DECLARE
  t text;
  expr text;     -- expression qui donne la clinique de la ligne
  lecture text;  -- condition de lecture
  regles jsonb := '{
    "modules":            ["public.clinique_formation(formation_id)",      "EXISTS (SELECT 1 FROM public.formations f WHERE f.id = formation_id)"],
    "questionnaires":     ["public.clinique_formation(formation_id)",      "EXISTS (SELECT 1 FROM public.formations f WHERE f.id = formation_id)"],
    "lessons":            ["public.clinique_module(module_id)",            "EXISTS (SELECT 1 FROM public.modules m WHERE m.id = module_id)"],
    "content_blocks":     ["public.clinique_lecon(lesson_id)",             "EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = lesson_id)"],
    "questions":          ["public.clinique_questionnaire(questionnaire_id)", "EXISTS (SELECT 1 FROM public.questionnaires q WHERE q.id = questionnaire_id)"],
    "reponses_possibles": ["public.clinique_question(question_id)",        "public.est_equipe() AND EXISTS (SELECT 1 FROM public.questions qu WHERE qu.id = question_id)"]
  }';
BEGIN
  FOR t IN SELECT jsonb_object_keys(regles) LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    expr    := regles -> t ->> 0;
    lecture := regles -> t ->> 1;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Anciennes règles (lecture ouverte à tout utilisateur connecté, ou sans notion de clinique)
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_authenticated_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_lecture_equipe', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_ajout_createurs', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_modif_createurs', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_suppr_createurs', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_lecture_clinique', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_ajout_clinique', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_modif_clinique', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_suppr_clinique', t);

    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (%s)', t || '_lecture_clinique', t, lecture);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.peut_gerer_contenu_clinique(%s))', t || '_ajout_clinique', t, expr);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (public.peut_gerer_contenu_clinique(%s)) WITH CHECK (public.peut_gerer_contenu_clinique(%s))', t || '_modif_clinique', t, expr, expr);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (public.peut_gerer_contenu_clinique(%s))', t || '_suppr_clinique', t, expr);
  END LOOP;
END $$;

-- Règles historiques remplacées par les règles ci-dessus
DROP POLICY IF EXISTS "Employes can read assigned lessons" ON public.lessons;
DROP POLICY IF EXISTS "Admins can manage lessons" ON public.lessons;
DROP POLICY IF EXISTS "Employes can read assigned content blocks" ON public.content_blocks;
DROP POLICY IF EXISTS "Admins can manage content blocks" ON public.content_blocks;
-- Bonnes réponses : plus lisibles par les employés (correction côté serveur, cf. questionnaire_serveur.sql)
DROP POLICY IF EXISTS reponses_authenticated_select ON public.reponses_possibles;

-- ---------------------------------------------------------------------------
-- 5. SOP : rôle (comme avant) ET clinique

ALTER TABLE public.sop ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sop_select_by_role ON public.sop;
DROP POLICY IF EXISTS sop_write_admin ON public.sop;
DROP POLICY IF EXISTS sop_lecture_clinique ON public.sop;
DROP POLICY IF EXISTS sop_ecriture_clinique ON public.sop;

CREATE POLICY sop_lecture_clinique ON public.sop FOR SELECT
  USING (
    public.peut_voir_contenu_clinique(clinique) AND EXISTS (
      SELECT 1 FROM public.mon_profil() p
      WHERE p.role IN ('admin', 'super_admin')
         OR (p.role = 'gestionnaire' AND sop.acces_role IN ('employe', 'gestionnaire'))
         OR (p.role NOT IN ('admin', 'super_admin', 'gestionnaire') AND sop.acces_role = 'employe')
    )
  );
CREATE POLICY sop_ecriture_clinique ON public.sop FOR ALL
  USING (public.peut_gerer_sop_clinique(clinique))
  WITH CHECK (public.peut_gerer_sop_clinique(clinique));

COMMIT;

-- ---------------------------------------------------------------------------
-- Vérification
SELECT
  (SELECT string_agg(clinique || ' : ' || n, ', ' ORDER BY clinique)
     FROM (SELECT clinique, count(*) n FROM public.formations GROUP BY clinique) x)             AS formations_par_clinique,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND policyname LIKE '%\_clinique') AS regles_par_clinique,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND policyname IN
     ('formations_employe_select','modules_authenticated_select','questionnaires_authenticated_select',
      'questions_authenticated_select','reponses_authenticated_select','sop_select_by_role'))      AS anciennes_regles_restantes;
