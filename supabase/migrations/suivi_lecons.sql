-- Phase 2 de l'éditeur : suivi des leçons
--  1. Option « J'ai lu et compris » par leçon
--  2. Preuves de lecture : vidéos obligatoires vues en entier + attestations (horodatées, Loi 25 / conformité)
--  3. Nouveaux types d'événements dans le journal d'audit
-- À exécuter une fois dans Supabase → SQL Editor, AVANT de fusionner le code. Peut être relancé sans effet de bord.

-- 1. Attestation par leçon
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS attestation_requise boolean NOT NULL DEFAULT false;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS texte_attestation text;
COMMENT ON COLUMN lessons.attestation_requise IS 'Si vrai, l''employé doit cocher « J''ai lu et compris » pour terminer la leçon';

-- 2. Preuves de lecture
CREATE TABLE IF NOT EXISTS preuves_lecture (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id  uuid NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
  lesson_id   uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  bloc_id     uuid REFERENCES content_blocks(id) ON DELETE SET NULL,
  type        text NOT NULL CHECK (type IN ('video_complete', 'attestation')),
  texte       text,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE preuves_lecture IS 'Vidéos obligatoires vues en entier et attestations « J''ai lu et compris » (preuves de formation)';

CREATE UNIQUE INDEX IF NOT EXISTS ux_preuves_lecture_unique
  ON preuves_lecture (employe_id, lesson_id, type, coalesce(bloc_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_preuves_lecture_lesson ON preuves_lecture (lesson_id);

-- Lecture : l'employé voit les siennes, l'équipe de gestion voit tout ; écriture : uniquement par le serveur
ALTER TABLE preuves_lecture ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS preuves_lecture_lecture_soi ON preuves_lecture;
CREATE POLICY preuves_lecture_lecture_soi ON preuves_lecture FOR SELECT
  USING (employe_id IN (SELECT id FROM employes WHERE auth_user_id = auth.uid()));
DROP POLICY IF EXISTS preuves_lecture_lecture_equipe ON preuves_lecture;
CREATE POLICY preuves_lecture_lecture_equipe ON preuves_lecture FOR SELECT
  USING (get_my_role() = ANY (ARRAY['super_admin','admin','gestionnaire']));

-- 3. Journal d'audit (à exécuter tel quel : chaque valeur est ajoutée séparément)
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'ATTESTATION_LECTURE';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'LECON_TERMINEE';

-- Vérification
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_name = 'lessons' AND column_name IN ('attestation_requise','texte_attestation')) AS colonnes_lecons,
  (SELECT count(*) FROM information_schema.tables WHERE table_name = 'preuves_lecture') AS table_preuves,
  (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'audit_action_type' AND e.enumlabel IN ('ATTESTATION_LECTURE','LECON_TERMINEE')) AS valeurs_audit;
