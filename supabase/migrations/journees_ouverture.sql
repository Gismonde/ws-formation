-- Journées de formation programmées : une journée datée dans le futur n'assigne rien et n'envoie rien
-- avant le matin du jour prévu (tâche quotidienne). ouverte_le = moment où le contenu a été assigné.
ALTER TABLE public.journees_formation ADD COLUMN IF NOT EXISTS ouverte_le timestamptz;
ALTER TABLE public.journees_formation ADD COLUMN IF NOT EXISTS notifier boolean NOT NULL DEFAULT true;
-- Journées déjà lancées : leur contenu a été assigné à la création
UPDATE public.journees_formation SET ouverte_le = cree_le WHERE modele = false AND ouverte_le IS NULL;
CREATE INDEX IF NOT EXISTS journees_formation_a_ouvrir_idx ON public.journees_formation (date_journee) WHERE modele = false AND ouverte_le IS NULL;
