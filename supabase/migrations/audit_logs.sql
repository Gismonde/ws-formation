-- =====================================================
-- AUDIT LOG TABLE - ws-formation
-- Logs immuables : INSERT only, no UPDATE, no DELETE
-- Rétention : 2 à 5 ans minimum (exigence légale)
-- =====================================================

-- Créer le type enum pour les actions
CREATE TYPE audit_action_type AS ENUM (
    -- Actions employés
  'CONNEXION',
    'DECONNEXION',
    'CONNEXION_ECHOUEE',
    'FORMATION_DEBUT',
    'FORMATION_FIN',
    'MODULE_PROGRESSION',
    'QUESTIONNAIRE_REPONSE',
    'CERTIFICAT_OBTENU',
    'CERTIFICAT_ECHOUE',
    -- Actions administrateurs
  'FORMATION_CREEE',
    'FORMATION_MODIFIEE',
    'FORMATION_SUPPRIMEE',
    'FORMATION_ASSIGNEE',
    'SEUIL_MODIFIE',
    'CERTIFICAT_EMIS_MANUELLEMENT',
    'EMPLOYE_CREE',
    'EMPLOYE_MODIFIE',
    'EMPLOYE_SUPPRIME',
    -- Événements système
  'EXPORT_DONNEES',
    'PARAMETRE_MODIFIE',
    'PREUVE_SOUMISE',
    'PREUVE_VALIDEE',
    'PREUVE_REFUSEE'
  );

-- Créer la table audit_logs
CREATE TABLE audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Qui a effectué l'action
  acteur_id UUID REFERENCES employes(id) ON DELETE SET NULL,

  -- Type d'action
  type_action audit_action_type NOT NULL,

  -- Description lisible
  description TEXT NOT NULL,

  -- Références optionnelles
  formation_id UUID REFERENCES formations(id) ON DELETE SET NULL,
    cible_employe_id UUID REFERENCES employes(id) ON DELETE SET NULL,

  -- Données supplémentaires (JSON libre)
  metadata JSONB,

  -- Contexte réseau/appareil
  ip_address TEXT,
    user_agent TEXT
  );

-- Index pour les requêtes fréquentes
CREATE INDEX idx_audit_logs_acteur_id ON audit_logs(acteur_id);
CREATE INDEX idx_audit_logs_type_action ON audit_logs(type_action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_formation_id ON audit_logs(formation_id);
CREATE INDEX idx_audit_logs_cible_employe_id ON audit_logs(cible_employe_id);

-- Activer RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Politique : seuls les admins/gestionnaires peuvent LIRE
CREATE POLICY "Admins can read audit logs"
  ON audit_logs FOR SELECT
  USING (
      EXISTS (
        SELECT 1 FROM employes
        WHERE employes.auth_user_id = auth.uid()
          AND employes.role IN ('admin', 'gestionnaire')
      )
    );

-- AUCUNE politique UPDATE ou DELETE → logs immuables
-- Même les admins ne peuvent pas modifier ou supprimer un log
-- Seul le service role key peut insérer (via logAudit())

-- Commentaires de documentation
COMMENT ON TABLE audit_logs IS 'Journal d''audit immuable. INSERT only via service role. Rétention minimale 2 ans.';
COMMENT ON COLUMN audit_logs.acteur_id IS 'Employé qui a effectué l''action (peut être NULL si compte supprimé)';
COMMENT ON COLUMN audit_logs.type_action IS 'Type d''action selon l''enum audit_action_type';
COMMENT ON COLUMN audit_logs.description IS 'Description lisible de l''événement';
COMMENT ON COLUMN audit_logs.metadata IS 'Données JSON supplémentaires (modules, scores, etc.)';
COMMENT ON COLUMN audit_logs.ip_address IS 'Adresse IP de l''acteur au moment de l''action';
COMMENT ON COLUMN audit_logs.user_agent IS 'User-agent du navigateur/appareil';
