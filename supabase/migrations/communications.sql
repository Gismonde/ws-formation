-- « Affiches & communications » (section Politiques & procédures du portail employé)
CREATE TABLE IF NOT EXISTS public.communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinique text NOT NULL DEFAULT 'WSSC',          -- WSSC | CMC | LES_DEUX
  titre text NOT NULL,
  description text NOT NULL DEFAULT '',
  fichier text NOT NULL,                          -- « media:communications/… » (espace privé)
  type_fichier text NOT NULL,                     -- application/pdf, image/jpeg, image/png, image/webp
  apercu text NOT NULL DEFAULT '',                -- vignette (page 1 du PDF) « media:communications/… »
  publie boolean NOT NULL DEFAULT false,
  publie_le timestamptz,
  cree_par uuid REFERENCES public.employes(id) ON DELETE SET NULL,
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS communications_clinique_idx ON public.communications (clinique, publie_le DESC);
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
