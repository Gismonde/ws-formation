-- =====================================================
-- LESSONS & CONTENT BLOCKS - ws-formation
-- Architecture : Course → Modules → Lessons → Content Blocks
-- =====================================================

-- =====================================================
-- TABLE : lessons
-- Une leçon appartient à un module
-- =====================================================
CREATE TABLE IF NOT EXISTS lessons (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    module_id       UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    titre           TEXT NOT NULL,
    description     TEXT,
    ordre           INTEGER NOT NULL DEFAULT 1,
    duree_minutes   INTEGER,
    est_obligatoire BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  );

COMMENT ON TABLE lessons IS 'Leçons appartenant à un module. Une leçon contient des blocs de contenu.';
COMMENT ON COLUMN lessons.module_id IS 'Module parent de la leçon';
COMMENT ON COLUMN lessons.ordre IS 'Ordre daffichage dans le module (commence à 1)';
COMMENT ON COLUMN lessons.est_obligatoire IS 'Si true, la leçon doit être complétée pour valider le module';

-- Index
CREATE INDEX IF NOT EXISTS idx_lessons_module_id ON lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_lessons_ordre ON lessons(module_id, ordre);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_lessons_updated_at
  BEFORE UPDATE ON lessons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ENUM : type de bloc de contenu
-- =====================================================
DO $$ BEGIN
  CREATE TYPE content_block_type AS ENUM (
      'text',    -- Texte riche (markdown/HTML)
    'video',   -- URL vidéo (YouTube, Vimeo, ou fichier)
    'quiz',    -- Questionnaire interactif
    'slide',   -- Présentation / diapositive
    'file',    -- Fichier téléchargeable (PDF, DOCX…)
    'image'    -- Image illustrative
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- TABLE : content_blocks
-- Un bloc de contenu appartient à une leçon
-- =====================================================
CREATE TABLE IF NOT EXISTS content_blocks (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lesson_id   UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    type        content_block_type NOT NULL,
    ordre       INTEGER NOT NULL DEFAULT 1,
    titre       TEXT,
    -- Contenu selon le type
  contenu     TEXT,        -- Texte brut ou markdown (type = text)
  url         TEXT,        -- URL vidéo ou fichier (type = video / file)
  metadata    JSONB,       -- Données supplémentaires selon le type
  -- Exemple metadata pour quiz   : { "questions": [...] }
  -- Exemple metadata pour slide  : { "slides": [...] }
  -- Exemple metadata pour video  : { "duree_secondes": 120 }
  est_requis  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
  );

COMMENT ON TABLE content_blocks IS 'Blocs de contenu dune leçon : texte, vidéo, quiz, slide, fichier ou image.';
COMMENT ON COLUMN content_blocks.lesson_id IS 'Leçon parente du bloc';
COMMENT ON COLUMN content_blocks.type IS 'Type de contenu : text | video | quiz | slide | file | image';
COMMENT ON COLUMN content_blocks.ordre IS 'Ordre daffichage dans la leçon (commence à 1)';
COMMENT ON COLUMN content_blocks.contenu IS 'Contenu textuel ou markdown pour les blocs de type text';
COMMENT ON COLUMN content_blocks.url IS 'URL pour les blocs vidéo ou fichier';
COMMENT ON COLUMN content_blocks.metadata IS 'Données JSON libres selon le type (questions de quiz, slides, etc.)';
COMMENT ON COLUMN content_blocks.est_requis IS 'Si true, le bloc doit être consulté pour valider la leçon';

-- Index
CREATE INDEX IF NOT EXISTS idx_content_blocks_lesson_id ON content_blocks(lesson_id);
CREATE INDEX IF NOT EXISTS idx_content_blocks_ordre ON content_blocks(lesson_id, ordre);
CREATE INDEX IF NOT EXISTS idx_content_blocks_type ON content_blocks(type);

-- Trigger updated_at
CREATE TRIGGER trigger_content_blocks_updated_at
  BEFORE UPDATE ON content_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLE : lesson_progressions
-- Suivi de la progression d'un employé par leçon
-- =====================================================
CREATE TABLE IF NOT EXISTS lesson_progressions (
    id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employe_id            UUID NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
    lesson_id             UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    statut                TEXT NOT NULL DEFAULT 'non_commence'
                            CHECK (statut IN ('non_commence', 'en_cours', 'termine')),
    pourcentage_complete  INTEGER DEFAULT 0 CHECK (pourcentage_complete BETWEEN 0 AND 100),
    date_debut            TIMESTAMPTZ,
    date_fin              TIMESTAMPTZ,
    updated_at            TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (employe_id, lesson_id)
  );

COMMENT ON TABLE lesson_progressions IS 'Progression dun employé sur une leçon spécifique.';
COMMENT ON COLUMN lesson_progressions.statut IS 'non_commence | en_cours | termine';

-- Index
CREATE INDEX IF NOT EXISTS idx_lesson_progressions_employe_id ON lesson_progressions(employe_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progressions_lesson_id ON lesson_progressions(lesson_id);

-- Trigger updated_at
CREATE TRIGGER trigger_lesson_progressions_updated_at
  BEFORE UPDATE ON lesson_progressions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================

-- Activer RLS
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progressions ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- LESSONS : politiques
-- -------------------------------------------------------

-- Les employés peuvent lire les leçons des formations qui leur sont assignées
CREATE POLICY "Employes can read assigned lessons"
  ON lessons FOR SELECT
  USING (
      EXISTS (
        SELECT 1
        FROM modules m
        JOIN assignations a ON a.formation_id = m.formation_id
        JOIN employes e ON e.id = a.employe_id
        WHERE m.id = lessons.module_id
          AND e.auth_user_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1
        FROM employes
        WHERE auth_user_id = auth.uid()
          AND role IN ('admin', 'gestionnaire')
      )
    );

-- Seuls admins/gestionnaires peuvent créer/modifier/supprimer des leçons
CREATE POLICY "Admins can manage lessons"
  ON lessons FOR ALL
  USING (
      EXISTS (
        SELECT 1 FROM employes
        WHERE auth_user_id = auth.uid()
          AND role IN ('admin', 'gestionnaire')
      )
    );

-- -------------------------------------------------------
-- CONTENT_BLOCKS : politiques
-- -------------------------------------------------------

-- Les employés peuvent lire les blocs des leçons accessibles
CREATE POLICY "Employes can read assigned content blocks"
  ON content_blocks FOR SELECT
  USING (
      EXISTS (
        SELECT 1
        FROM lessons l
        JOIN modules m ON m.id = l.module_id
        JOIN assignations a ON a.formation_id = m.formation_id
        JOIN employes e ON e.id = a.employe_id
        WHERE l.id = content_blocks.lesson_id
          AND e.auth_user_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM employes
        WHERE auth_user_id = auth.uid()
          AND role IN ('admin', 'gestionnaire')
      )
    );

-- Seuls admins/gestionnaires peuvent gérer les blocs de contenu
CREATE POLICY "Admins can manage content blocks"
  ON content_blocks FOR ALL
  USING (
      EXISTS (
        SELECT 1 FROM employes
        WHERE auth_user_id = auth.uid()
          AND role IN ('admin', 'gestionnaire')
      )
    );

-- -------------------------------------------------------
-- LESSON_PROGRESSIONS : politiques
-- -------------------------------------------------------

-- Un employé peut voir et gérer ses propres progressions
CREATE POLICY "Employes can manage own lesson progressions"
  ON lesson_progressions FOR ALL
  USING (
      EXISTS (
        SELECT 1 FROM employes
        WHERE auth_user_id = auth.uid()
          AND id = lesson_progressions.employe_id
      )
    );

-- Admins/gestionnaires peuvent lire toutes les progressions
CREATE POLICY "Admins can read all lesson progressions"
  ON lesson_progressions FOR SELECT
  USING (
      EXISTS (
        SELECT 1 FROM employes
        WHERE auth_user_id = auth.uid()
          AND role IN ('admin', 'gestionnaire')
      )
    );
