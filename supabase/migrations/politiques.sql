-- Politiques de la clinique + confirmations « J'ai lu et compris »
--  - Une politique s'adresse à une clinique (CMC, WSSC ou les deux) et, au choix, à toute la clinique
--    ou à un ou plusieurs départements.
--  - Chaque nouvelle version demande une nouvelle confirmation à tous les employés visés.
-- À exécuter une fois dans Supabase → SQL Editor, AVANT de fusionner le code. Peut être relancé sans effet de bord.

CREATE TABLE IF NOT EXISTS politiques (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titre          text NOT NULL,
  description    text,
  clinique       text NOT NULL CHECK (clinique IN ('CMC', 'WSSC', 'LES_DEUX')),
  departements   uuid[] NOT NULL DEFAULT '{}',          -- vide = toute la clinique
  version        integer NOT NULL DEFAULT 1,
  fichier        text NOT NULL,                         -- « media:politiques/… » (espace privé)
  nom_fichier    text,
  note_version   text,
  publiee_le     timestamptz NOT NULL DEFAULT now(),    -- date de la version en vigueur
  publiee_par    uuid REFERENCES employes(id) ON DELETE SET NULL,
  actif          boolean NOT NULL DEFAULT true,         -- false = archivée
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE politiques IS 'Politiques de la clinique à lire et confirmer par les employés visés';

CREATE TABLE IF NOT EXISTS politiques_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  politique_id  uuid NOT NULL REFERENCES politiques(id) ON DELETE CASCADE,
  version       integer NOT NULL,
  fichier       text NOT NULL,
  nom_fichier   text,
  note_version  text,
  publiee_le    timestamptz NOT NULL DEFAULT now(),
  publiee_par   uuid REFERENCES employes(id) ON DELETE SET NULL,
  UNIQUE (politique_id, version)
);
COMMENT ON TABLE politiques_versions IS 'Historique des versions de chaque politique (preuve du document confirmé)';

CREATE TABLE IF NOT EXISTS politiques_confirmations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  politique_id  uuid NOT NULL REFERENCES politiques(id) ON DELETE CASCADE,
  version       integer NOT NULL,
  employe_id    uuid NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
  texte         text NOT NULL,
  ip_address    text,
  user_agent    text,
  confirme_le   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (politique_id, version, employe_id)
);
COMMENT ON TABLE politiques_confirmations IS 'Confirmations « J''ai lu et compris » horodatées, par version de politique';
CREATE INDEX IF NOT EXISTS idx_politiques_confirmations_employe ON politiques_confirmations (employe_id);

-- Accès : uniquement par le serveur de l'application (clé de service), qui applique les règles par clinique/département.
ALTER TABLE politiques ENABLE ROW LEVEL SECURITY;
ALTER TABLE politiques_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE politiques_confirmations ENABLE ROW LEVEL SECURITY;

-- Journal d'audit (chaque valeur est ajoutée séparément)
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'INVITATION_ENVOYEE';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'POLITIQUE_PUBLIEE';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'POLITIQUE_MODIFIEE';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'POLITIQUE_CONFIRMEE';

-- Vérification (attendu : 3 tables, 4 valeurs)
SELECT
  (SELECT count(*) FROM information_schema.tables
     WHERE table_name IN ('politiques','politiques_versions','politiques_confirmations')) AS tables_politiques,
  (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'audit_action_type'
       AND e.enumlabel IN ('INVITATION_ENVOYEE','POLITIQUE_PUBLIEE','POLITIQUE_MODIFIEE','POLITIQUE_CONFIRMEE')) AS valeurs_audit;
