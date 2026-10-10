-- Sécurité de la base par clinique (Loi 25)
-- Applique dans la base de données les MÊMES règles que l'application :
--   admin global (super_admin) : tout, dans les deux cliniques
--   admin de clinique          : employés de sa (ses) clinique(s)
--   gestionnaire               : employés de son département, dans sa clinique
--   employé                    : uniquement ses propres données
-- Corrige aussi :
--   - un employé pouvait modifier sa propre fiche (y compris son rôle) en passant directement par la base ;
--   - un gestionnaire pouvait modifier/supprimer n'importe quel employé, certificat, assignation ou preuve ;
--   - 3 vues contournaient les règles de sécurité ;
--   - 3 fonctions internes pouvaient être appelées par n'importe qui (ex. marquer un module terminé pour un autre employé).
-- L'application fait toutes ses écritures sensibles côté serveur (clé de service) : elle n'est pas affectée.
-- À exécuter une fois dans Supabase → SQL Editor. Tout est appliqué d'un bloc (ou rien en cas d'erreur). Peut être relancé.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Fonctions de portée (évaluées avec les droits du propriétaire, sans boucle de règles)

CREATE OR REPLACE FUNCTION public.cliniques_de(c text) RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE c WHEN 'LES_DEUX' THEN ARRAY['CMC','WSSC']
                WHEN 'CMC' THEN ARRAY['CMC']
                WHEN 'WSSC' THEN ARRAY['WSSC']
                ELSE ARRAY[]::text[] END
$$;

-- Fiche de l'utilisateur connecté (null si non connecté ou archivé)
CREATE OR REPLACE FUNCTION public.mon_profil()
RETURNS TABLE (id uuid, role text, clinique text, departement_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.role, e.clinique, e.departement_id
  FROM public.employes e
  WHERE e.auth_user_id = auth.uid() AND coalesce(e.actif, true)
  LIMIT 1
$$;

-- L'utilisateur connecté peut-il voir les données de cet employé ? (même logique que src/lib/permissions.ts)
CREATE OR REPLACE FUNCTION public.peut_voir_employe(cible uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  moi record;
  c record;
BEGIN
  IF cible IS NULL THEN RETURN false; END IF;
  SELECT * INTO moi FROM public.mon_profil();
  IF moi.id IS NULL THEN RETURN false; END IF;
  IF cible = moi.id THEN RETURN true; END IF;
  IF moi.role = 'super_admin' THEN RETURN true; END IF;
  IF moi.role NOT IN ('admin', 'gestionnaire') THEN RETURN false; END IF;

  SELECT e.clinique, e.departement_id INTO c FROM public.employes e WHERE e.id = cible;
  IF NOT FOUND THEN RETURN false; END IF;
  IF NOT (public.cliniques_de(c.clinique) && public.cliniques_de(moi.clinique)) THEN RETURN false; END IF;
  IF moi.role = 'admin' THEN RETURN true; END IF;
  -- gestionnaire : son département seulement
  RETURN moi.departement_id IS NOT NULL AND c.departement_id = moi.departement_id;
END;
$$;

-- Membre de l'équipe de gestion (admin global, admin de clinique, gestionnaire)
CREATE OR REPLACE FUNCTION public.est_equipe() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.mon_profil() p WHERE p.role IN ('super_admin','admin','gestionnaire'))
$$;

REVOKE EXECUTE ON FUNCTION public.mon_profil() FROM anon;
REVOKE EXECUTE ON FUNCTION public.peut_voir_employe(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.est_equipe() FROM anon;

-- ---------------------------------------------------------------------------
-- 2. Employés : lecture limitée à la portée ; aucune écriture directe (tout passe par le serveur)

DROP POLICY IF EXISTS "admin: voir tous les employes" ON public.employes;
DROP POLICY IF EXISTS "admin: modifier les employes" ON public.employes;
DROP POLICY IF EXISTS "admin: inserer un employe" ON public.employes;
DROP POLICY IF EXISTS employes_admin_all ON public.employes;
DROP POLICY IF EXISTS employe_update_own ON public.employes;
DROP POLICY IF EXISTS employes_self_update ON public.employes;
DROP POLICY IF EXISTS "employe: voir sa propre ligne" ON public.employes;
DROP POLICY IF EXISTS employe_select_own ON public.employes;
DROP POLICY IF EXISTS employes_self_select ON public.employes;
DROP POLICY IF EXISTS employes_lecture_portee ON public.employes;
DROP POLICY IF EXISTS employes_lecture_soi ON public.employes;

CREATE POLICY employes_lecture_soi ON public.employes FOR SELECT
  USING (auth_user_id = (SELECT auth.uid()));
CREATE POLICY employes_lecture_portee ON public.employes FOR SELECT
  USING (public.peut_voir_employe(id));

-- ---------------------------------------------------------------------------
-- 3. Données de formation des employés : l'équipe ne lit que sa portée, et n'écrit plus directement

-- assignations
DROP POLICY IF EXISTS assignations_admin_all ON public.assignations;
DROP POLICY IF EXISTS assignations_lecture_portee ON public.assignations;
CREATE POLICY assignations_lecture_portee ON public.assignations FOR SELECT
  USING (public.est_equipe() AND public.peut_voir_employe(employe_id));

-- certificats
DROP POLICY IF EXISTS certificats_admin_all ON public.certificats;
DROP POLICY IF EXISTS certificats_lecture_portee ON public.certificats;
CREATE POLICY certificats_lecture_portee ON public.certificats FOR SELECT
  USING (public.est_equipe() AND public.peut_voir_employe(employe_id));

-- progressions (l'employé garde l'accès à sa propre progression)
DROP POLICY IF EXISTS progressions_admin_all ON public.progressions;
DROP POLICY IF EXISTS progressions_lecture_portee ON public.progressions;
CREATE POLICY progressions_lecture_portee ON public.progressions FOR SELECT
  USING (public.est_equipe() AND public.peut_voir_employe(employe_id));

-- progression par leçon
DROP POLICY IF EXISTS "Admins can read all lesson progressions" ON public.lesson_progressions;
DROP POLICY IF EXISTS lesson_progressions_lecture_portee ON public.lesson_progressions;
CREATE POLICY lesson_progressions_lecture_portee ON public.lesson_progressions FOR SELECT
  USING (public.est_equipe() AND public.peut_voir_employe(employe_id));

-- preuves externes (la validation passe par le serveur)
DROP POLICY IF EXISTS "admin: valider preuve" ON public.preuves_externes;
DROP POLICY IF EXISTS preuves_admin_all ON public.preuves_externes;
DROP POLICY IF EXISTS preuves_externes_lecture_portee ON public.preuves_externes;
CREATE POLICY preuves_externes_lecture_portee ON public.preuves_externes FOR SELECT
  USING (public.est_equipe() AND public.peut_voir_employe(employe_id));

-- preuves de lecture (vidéos vues, « J'ai lu et compris »)
DROP POLICY IF EXISTS preuves_lecture_lecture_equipe ON public.preuves_lecture;
DROP POLICY IF EXISTS preuves_lecture_lecture_portee ON public.preuves_lecture;
CREATE POLICY preuves_lecture_lecture_portee ON public.preuves_lecture FOR SELECT
  USING (public.est_equipe() AND public.peut_voir_employe(employe_id));

-- tentatives de questionnaire (l'employé garde l'accès aux siennes)
DROP POLICY IF EXISTS tentatives_admin_all ON public.tentatives_questionnaire;
DROP POLICY IF EXISTS tentatives_lecture_portee ON public.tentatives_questionnaire;
CREATE POLICY tentatives_lecture_portee ON public.tentatives_questionnaire FOR SELECT
  USING (public.est_equipe() AND public.peut_voir_employe(employe_id));

-- journal d'audit : admin global = tout ; admin/gestionnaire = événements concernant sa portée
DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_lecture_portee ON public.audit_logs;
CREATE POLICY audit_logs_lecture_portee ON public.audit_logs FOR SELECT
  USING (
    public.est_equipe() AND (
      public.get_my_role() = 'super_admin'
      OR public.peut_voir_employe(cible_employe_id)
      OR public.peut_voir_employe(acteur_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Vues : appliquer les règles de l'utilisateur qui consulte (au lieu de les contourner)

ALTER VIEW IF EXISTS public.certificats_avec_statut SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_audit_retention_stats SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_consultations_dossiers SET (security_invoker = true);
REVOKE ALL ON public.certificats_avec_statut FROM anon;
REVOKE ALL ON public.v_audit_retention_stats FROM anon;
REVOKE ALL ON public.v_consultations_dossiers FROM anon;

-- ---------------------------------------------------------------------------
-- 5. Fonctions internes : plus appelables depuis l'extérieur (l'application ne les utilise pas)

REVOKE EXECUTE ON FUNCTION public.marquer_module_termine(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verifier_et_emettre_certificat(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_old_audit_logs() FROM PUBLIC, anon, authenticated;

COMMIT;

-- ---------------------------------------------------------------------------
-- Vérification (attendu : 0 règle « équipe » trop large restante, 3 vues protégées, 0 fonction interne ouverte)
SELECT
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
     AND tablename IN ('employes','assignations','certificats','progressions','lesson_progressions',
                       'preuves_externes','preuves_lecture','tentatives_questionnaire','audit_logs')
     AND (qual ILIKE '%get_my_role() = ANY%' OR with_check ILIKE '%get_my_role() = ANY%'
          OR (tablename = 'employes' AND cmd <> 'SELECT'))) AS regles_trop_larges,
  (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace
     AND relname IN ('certificats_avec_statut','v_audit_retention_stats','v_consultations_dossiers')
     AND 'security_invoker=true' = ANY (reloptions)) AS vues_protegees,
  (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace
     AND proname IN ('marquer_module_termine','verifier_et_emettre_certificat','purge_old_audit_logs')
     AND has_function_privilege('authenticated', oid, 'EXECUTE')) AS fonctions_ouvertes;
