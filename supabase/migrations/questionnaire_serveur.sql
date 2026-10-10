-- Questionnaire corrigé côté serveur
--  1. Les tentatives peuvent être « annulées » par un gestionnaire pour redonner des essais
--     (elles restent conservées comme preuve, mais ne comptent plus dans la limite).
--  2. Les bonnes réponses ne sont plus lisibles par les employés directement dans la base
--     (la correction se fait maintenant sur le serveur ; l'équipe garde l'accès pour l'éditeur).
-- À exécuter une fois dans Supabase → SQL Editor, AVANT de fusionner le code. Peut être relancé.

ALTER TABLE public.tentatives_questionnaire ADD COLUMN IF NOT EXISTS annulee boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.tentatives_questionnaire.annulee IS 'Tentative remise à zéro par un gestionnaire (conservée, mais hors limite)';

DROP POLICY IF EXISTS reponses_authenticated_select ON public.reponses_possibles;

-- Vérification (attendu : 1 et 0)
SELECT
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'tentatives_questionnaire' AND column_name = 'annulee') AS colonne_annulee,
  (SELECT count(*) FROM pg_policies
     WHERE tablename = 'reponses_possibles' AND policyname = 'reponses_authenticated_select') AS reponses_visibles_employes;
