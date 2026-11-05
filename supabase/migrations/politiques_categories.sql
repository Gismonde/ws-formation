-- Catégories de rangement des politiques (code court MED, CON…, nom, départements associés)
CREATE TABLE IF NOT EXISTS public.politiques_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  nom text NOT NULL,
  emoji text,
  departements uuid[] NOT NULL DEFAULT '{}',
  ordre integer NOT NULL DEFAULT 0,
  cree_par uuid REFERENCES public.employes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.politiques_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.politiques ADD COLUMN IF NOT EXISTS categorie_id uuid REFERENCES public.politiques_categories(id) ON DELETE SET NULL;
