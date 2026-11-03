-- Affichage des leçons : « defilement » (une page qui défile) ou « ecrans » (présentation écran par écran)
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS mode_presentation text NOT NULL DEFAULT 'defilement';
ALTER TABLE public.formations DROP CONSTRAINT IF EXISTS formations_mode_presentation_check;
ALTER TABLE public.formations ADD CONSTRAINT formations_mode_presentation_check CHECK (mode_presentation IN ('defilement', 'ecrans'));
