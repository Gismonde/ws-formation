-- Migration: Ajout colonne acces_role à la table sop
-- Date: 2026-05-30
-- Description: Permet de restreindre la visibilité des SOPs par rôle utilisateur
--              Les valeurs possibles : 'employe', 'gestionnaire', 'admin'
--              Un gestionnaire voit ses SOPs + celles des employés
--              Un admin voit toutes les SOPs

-- 1. Créer le type enum pour les rôles d'accès SOP
DO $$ BEGIN
  CREATE TYPE sop_acces_role AS ENUM ('employe', 'gestionnaire', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Ajouter la colonne acces_role à la table sop
ALTER TABLE sop
  ADD COLUMN IF NOT EXISTS acces_role sop_acces_role NOT NULL DEFAULT 'employe';

-- 3. Mettre à jour les SOPs existantes avec le bon rôle
-- SOPs employés (visibles par tous)
UPDATE sop SET acces_role = 'employe'
WHERE titre ILIKE '%onboarding%'
   OR titre ILIKE '%incident%'
   OR titre ILIKE '%certificat%';

-- SOPs gestionnaires (gestionnaires + admins)
UPDATE sop SET acces_role = 'gestionnaire'
WHERE titre ILIKE '%offboarding%'
   OR titre ILIKE '%creer%formation%'
   OR titre ILIKE '%formation%retard%'
   OR titre ILIKE '%preuve%externe%'
   OR titre ILIKE '%valider%';

-- SOPs admin seulement
UPDATE sop SET acces_role = 'admin'
WHERE titre ILIKE '%deploiement%'
   OR titre ILIKE '%sauvegarde%'
   OR titre ILIKE '%audit%';

-- 4. Créer un index pour améliorer les performances de filtrage
CREATE INDEX IF NOT EXISTS idx_sop_acces_role ON sop (acces_role);

-- 5. Commentaire sur la colonne
COMMENT ON COLUMN sop.acces_role IS 'Role minimum requis pour voir cette SOP. employe=tous, gestionnaire=gestionnaires+admins, admin=admins seulement';

-- Vérification
SELECT acces_role, COUNT(*) as nb_sops FROM sop GROUP BY acces_role ORDER BY acces_role;
