-- Photo du formulaire papier (vignette affichée aux employés)
ALTER TABLE public.formulaires ADD COLUMN IF NOT EXISTS image text;
