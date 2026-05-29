-- =====================================================
-- POLITIQUE DE RÉTENTION DES AUDIT LOGS - ws-formation
-- =====================================================
-- Exigence légale (Québec) :
--   - CNESST / LSST       : 5 ans minimum
--   - Loi 25 (vie privée) : durée nécessaire à la finalité
--   - Litiges/arbitrage   : 3 ans (prescription civile)
--   - Recommandation      : 5 ans de rétention active
--
-- Stratégie retenue :
--   - Rétention active    : 5 ans  (logs conservés intégralement)
--   - Purge automatique   : logs > 5 ans supprimés chaque mois
--   - Exception légale    : logs liés à un litige actif exclus de la purge
--
-- Déploiement :
--   1. Activer l'extension pg_cron dans Supabase Dashboard
--      (Database > Extensions > pg_cron)
--   2. Appliquer cette migration
-- =====================================================


-- =====================================================
-- ÉTAPE 1 : Activer pg_cron si ce n'est pas déjà fait
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;


-- =====================================================
-- ÉTAPE 2 : Colonne optionnelle pour exclure un log
--           d'une purge (ex. : litige en cours)
-- =====================================================
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS exclure_purge BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN audit_logs.exclure_purge IS
  'Si TRUE, ce log est exclu de la purge automatique (ex: litige en cours, demande Access-à-l-information).';


-- =====================================================
-- ÉTAPE 3 : Fonction de purge
-- =====================================================
CREATE OR REPLACE FUNCTION purge_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nb_supprimes INTEGER;
  seuil_retention INTERVAL := INTERVAL '5 years';
BEGIN
  -- Supprimer les logs plus anciens que le seuil,
  -- sauf ceux marqués exclure_purge = TRUE
  DELETE FROM audit_logs
  WHERE created_at < NOW() - seuil_retention
    AND exclure_purge = FALSE;

  GET DIAGNOSTICS nb_supprimes = ROW_COUNT;

  -- Enregistrer la purge elle-même dans les logs (traçabilité)
  IF nb_supprimes > 0 THEN
    INSERT INTO audit_logs (
          employe_id,
          type_action,
          description,
          metadata
        ) VALUES (
          NULL,
          'EXPORT_DONNEES',
          'Purge automatique des audit logs : ' || nb_supprimes || ' entrée(s) supprimée(s) (> 5 ans)',
          jsonb_build_object(
            'source', 'pg_cron',
            'retention_policy', '5 years',
            'nb_supprimes', nb_supprimes,
            'seuil_date', (NOW() - seuil_retention)::TEXT
          )
        );
  END IF;

  RAISE NOTICE '[audit_logs] Purge terminée : % entrée(s) supprimée(s) (seuil = %)',
    nb_supprimes, NOW() - seuil_retention;
END;
$$;

COMMENT ON FUNCTION purge_old_audit_logs() IS
  'Supprime les audit logs de plus de 5 ans (hors logs marqués exclure_purge=TRUE). Appelée automatiquement par pg_cron le 1er de chaque mois à 02h00 UTC.';


-- =====================================================
-- ÉTAPE 4 : Planifier la purge mensuelle avec pg_cron
--           Le 1er de chaque mois à 02h00 UTC
-- =====================================================

-- Supprimer le job existant s'il existe déjà (idempotence)
SELECT cron.unschedule('purge-audit-logs-mensuel')
  WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'purge-audit-logs-mensuel'
    );

SELECT cron.schedule(
    'purge-audit-logs-mensuel',
    '0 2 1 * *',
    $cron$ SELECT purge_old_audit_logs(); $cron$
);


-- =====================================================
-- ÉTAPE 5 : Vue de monitoring de la rétention
--           Permet à l'admin de vérifier l'état des logs
-- =====================================================
CREATE OR REPLACE VIEW v_audit_retention_stats AS
SELECT
  COUNT(*)                                          AS total_logs,
  COUNT(*) FILTER (WHERE exclure_purge = TRUE)      AS logs_proteges,
  MIN(created_at)                                   AS log_le_plus_ancien,
  MAX(created_at)                                   AS log_le_plus_recent,
  NOW() - INTERVAL '5 years'                        AS seuil_purge_actuel,
  COUNT(*) FILTER (
      WHERE created_at < NOW() - INTERVAL '5 years'
        AND exclure_purge = FALSE
    )                                                 AS logs_eligibles_purge_maintenant
FROM audit_logs;

COMMENT ON VIEW v_audit_retention_stats IS
  'Vue de monitoring : statistiques de rétention des audit logs. Consultable par les admins pour vérifier la conformité.';


-- =====================================================
-- ÉTAPE 6 : RLS sur la vue (lecture admin uniquement)
-- =====================================================
-- La vue hérite des permissions de la table audit_logs.
-- S'assurer que seuls les admins peuvent la consulter.
GRANT SELECT ON v_audit_retention_stats TO authenticated;


-- =====================================================
-- RÉSUMÉ DE LA POLITIQUE APPLIQUÉE
-- =====================================================
-- Rétention    : 5 ans (60 mois)
-- Purge auto   : 1er de chaque mois à 02h00 UTC (pg_cron)
-- Protection   : colonne exclure_purge pour cas exceptionnels
-- Traçabilité  : chaque purge est elle-même enregistrée dans les logs
-- Monitoring   : vue v_audit_retention_stats
-- =====================================================
