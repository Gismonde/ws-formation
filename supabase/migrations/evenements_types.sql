-- Événements : type (formation en présentiel, 5 à 7 / activité sociale, événement de la clinique)
ALTER TABLE public.evenements ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'formation';
ALTER TABLE public.evenements DROP CONSTRAINT IF EXISTS evenements_type_check;
ALTER TABLE public.evenements ADD CONSTRAINT evenements_type_check CHECK (type IN ('formation', 'social', 'clinique'));
-- Événement mis en vedette (bannière du haut, choisie par l'admin)
ALTER TABLE public.evenements ADD COLUMN IF NOT EXISTS en_vedette boolean NOT NULL DEFAULT false;
ALTER TABLE public.evenements ADD COLUMN IF NOT EXISTS fond text;
ALTER TABLE public.evenements ADD COLUMN IF NOT EXISTS emoji text;
ALTER TABLE public.evenements ADD COLUMN IF NOT EXISTS places_prevues integer;
ALTER TABLE public.evenements ADD COLUMN IF NOT EXISTS compte_a_rebours boolean NOT NULL DEFAULT false;
