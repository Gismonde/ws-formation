-- Éditeur de formations (phase 1)
--  1. Autorisation « peut créer des formations » pour les gestionnaires
--  2. Espace privé pour les médias des formations (images, vidéos, documents)
--  3. Règles RLS : seuls les admins et les gestionnaires autorisés peuvent MODIFIER le contenu des formations ;
--     tous les gestionnaires gardent la LECTURE (pour assigner).
-- À exécuter une fois dans Supabase → SQL Editor, AVANT de fusionner le code. Peut être relancé sans effet de bord.

-- 1. Autorisation par gestionnaire
ALTER TABLE employes ADD COLUMN IF NOT EXISTS peut_creer_formations boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN employes.peut_creer_formations IS 'Gestionnaire autorisé à créer/modifier des formations (les admins le sont toujours)';

CREATE OR REPLACE FUNCTION public.peut_editer_formations()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employes e
    WHERE e.auth_user_id = auth.uid()
      AND coalesce(e.actif, true)
      AND (e.role IN ('super_admin', 'admin') OR (e.role = 'gestionnaire' AND e.peut_creer_formations))
  );
$$;

-- 2. Espace de stockage privé (50 Mo max par fichier)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'formation-medias', 'formation-medias', false, 52428800,
  ARRAY[
    'image/jpeg','image/png','image/gif','image/webp',
    'video/mp4','video/webm','video/quicktime',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword','application/vnd.ms-excel','application/vnd.ms-powerpoint'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Règles RLS sur le contenu des formations
DO $$
DECLARE
  t text;
  ancienne text;
  anciennes jsonb := '{
    "formations": "formations_admin_all",
    "modules": "modules_admin_all",
    "lessons": "Admins can manage lessons",
    "content_blocks": "Admins can manage content blocks",
    "questionnaires": "questionnaires_admin_all",
    "questions": "questions_admin_all",
    "reponses_possibles": "reponses_admin_all"
  }';
BEGIN
  FOR t, ancienne IN SELECT key, value FROM jsonb_each_text(anciennes) LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', ancienne, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_lecture_equipe', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_ajout_createurs', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_modif_createurs', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_suppr_createurs', t);

    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR SELECT
      USING (get_my_role() = ANY (ARRAY['super_admin','admin','gestionnaire']))$f$, t || '_lecture_equipe', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.peut_editer_formations())', t || '_ajout_createurs', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (public.peut_editer_formations()) WITH CHECK (public.peut_editer_formations())', t || '_modif_createurs', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (public.peut_editer_formations())', t || '_suppr_createurs', t);
  END LOOP;
END $$;

-- Vérification
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_name = 'employes' AND column_name = 'peut_creer_formations') AS colonne_ok,
  (SELECT count(*) FROM storage.buckets WHERE id = 'formation-medias' AND public = false) AS espace_prive_ok,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND policyname LIKE '%\_createurs') AS regles_ecriture,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND policyname IN
     ('formations_admin_all','modules_admin_all','Admins can manage lessons','Admins can manage content blocks',
      'questionnaires_admin_all','questions_admin_all','reponses_admin_all')) AS anciennes_regles_restantes;
