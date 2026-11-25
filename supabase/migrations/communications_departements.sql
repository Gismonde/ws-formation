-- Documents (affiches, guides, consentements) réservés à certains départements.
-- Vide : toute la clinique. Les administrateurs et l'administrateur global voient toujours tout.
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS departements uuid[] NOT NULL DEFAULT '{}';
