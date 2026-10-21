-- Politiques : ciblage d'employés précis (en plus de la clinique et des départements)
--  - employes vide et departements vide : toute la clinique (comme avant)
--  - sinon : les départements listés ET les employés listés
-- À exécuter une fois dans Supabase → SQL Editor. Peut être relancé sans effet de bord.
ALTER TABLE public.politiques ADD COLUMN IF NOT EXISTS employes uuid[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.politiques.employes IS 'Employés visés individuellement (assignation groupée) ; vide avec departements vide = toute la clinique';
