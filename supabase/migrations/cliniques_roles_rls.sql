-- Cliniques CMC/WSSC + rôle super_admin : colonnes, contrainte de rôle et règles RLS
-- Idempotent : peut être relancé sans effet de bord.

-- 1. Colonnes clinique
ALTER TABLE employes ADD COLUMN IF NOT EXISTS clinique text;
DO $$ BEGIN
  ALTER TABLE employes ADD CONSTRAINT employes_clinique_check CHECK (clinique IS NULL OR clinique IN ('CMC', 'WSSC', 'LES_DEUX'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;
CREATE INDEX IF NOT EXISTS idx_employes_clinique ON employes (clinique);

ALTER TABLE departements ADD COLUMN IF NOT EXISTS clinique text;
DO $$ BEGIN
  ALTER TABLE departements ADD CONSTRAINT departements_clinique_check CHECK (clinique IS NULL OR clinique IN ('CMC', 'WSSC'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;
CREATE INDEX IF NOT EXISTS idx_departements_clinique ON departements (clinique);

-- 2. Autoriser le rôle super_admin
ALTER TABLE employes DROP CONSTRAINT IF EXISTS employes_role_check;
ALTER TABLE employes ADD CONSTRAINT employes_role_check
  CHECK (role IN ('super_admin', 'admin', 'gestionnaire', 'employe'));

-- 3. Règles RLS : super_admin a les mêmes droits que admin
DO $$
DECLARE
  p record;
  q text;
  w text;
  cmd text;
BEGIN
  FOR p IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%''admin''::text%'
      AND (coalesce(qual, '') || coalesce(with_check, '')) NOT LIKE '%super_admin%'
  LOOP
    q := replace(replace(p.qual, 'ARRAY[''admin''::text', 'ARRAY[''super_admin''::text, ''admin''::text'),
                 '= ''admin''::text', '= ANY (ARRAY[''super_admin''::text, ''admin''::text])');
    w := replace(replace(p.with_check, 'ARRAY[''admin''::text', 'ARRAY[''super_admin''::text, ''admin''::text'),
                 '= ''admin''::text', '= ANY (ARRAY[''super_admin''::text, ''admin''::text])');
    cmd := format('ALTER POLICY %I ON public.%I', p.policyname, p.tablename);
    IF q IS NOT NULL THEN cmd := cmd || ' USING (' || q || ')'; END IF;
    IF w IS NOT NULL THEN cmd := cmd || ' WITH CHECK (' || w || ')'; END IF;
    EXECUTE cmd;
  END LOOP;
END $$;

-- Vérification : politiques contenant 'admin' mais pas super_admin (doit être 0)
SELECT count(*) AS politiques_sans_super_admin
FROM pg_policies
WHERE schemaname = 'public'
  AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%''admin''::text%'
  AND (coalesce(qual, '') || coalesce(with_check, '')) NOT LIKE '%super_admin%';
