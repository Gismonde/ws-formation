-- Accès aux formations hors assignation : « disponible sans obligation » ou « disponible sur demande ».
-- aucun   : seulement par assignation (comportement habituel)
-- libre   : tout employé de la clinique peut la commencer, sans obligation
-- demande : l'employé demande l'accès ; le responsable de la formation ou un admin accepte ou refuse
ALTER TABLE formations ADD COLUMN IF NOT EXISTS acces_hors_assignation text NOT NULL DEFAULT 'aucun';
ALTER TABLE formations DROP CONSTRAINT IF EXISTS formations_acces_hors_assignation_check;
ALTER TABLE formations ADD CONSTRAINT formations_acces_hors_assignation_check CHECK (acces_hors_assignation IN ('aucun', 'libre', 'demande'));
-- Compte du responsable de la formation (traite les demandes d'accès avec les admins)
ALTER TABLE formations ADD COLUMN IF NOT EXISTS responsable_id uuid REFERENCES employes(id) ON DELETE SET NULL;

-- Inscription hors obligation (libre ou sur demande acceptée) : exclue de la conformité et des rappels
ALTER TABLE assignations ADD COLUMN IF NOT EXISTS volontaire boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS demandes_acces_formation (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id  uuid NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
  employe_id    uuid NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
  statut        text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'acceptee', 'refusee')),
  message       text,
  demandee_le   timestamptz NOT NULL DEFAULT now(),
  traitee_par   uuid REFERENCES employes(id) ON DELETE SET NULL,
  traitee_le    timestamptz,
  motif         text,
  UNIQUE (formation_id, employe_id)
);
-- Lu et écrit uniquement côté serveur (clé de service)
ALTER TABLE demandes_acces_formation ENABLE ROW LEVEL SECURITY;
