-- Versions linguistiques des formations (FR / EN) et langue de formation des employés.
-- Une version anglaise est une formation à part, reliée à la française par version_de.
ALTER TABLE formations ADD COLUMN IF NOT EXISTS langue text NOT NULL DEFAULT 'fr';
ALTER TABLE formations DROP CONSTRAINT IF EXISTS formations_langue_check;
ALTER TABLE formations ADD CONSTRAINT formations_langue_check CHECK (langue IN ('fr', 'en'));
ALTER TABLE formations ADD COLUMN IF NOT EXISTS version_de uuid REFERENCES formations(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS formations_version_de_unique ON formations(version_de) WHERE version_de IS NOT NULL;

ALTER TABLE employes ADD COLUMN IF NOT EXISTS langue_formation text NOT NULL DEFAULT 'fr';
ALTER TABLE employes DROP CONSTRAINT IF EXISTS employes_langue_formation_check;
ALTER TABLE employes ADD CONSTRAINT employes_langue_formation_check CHECK (langue_formation IN ('fr', 'en'));

NOTIFY pgrst, 'reload schema';
