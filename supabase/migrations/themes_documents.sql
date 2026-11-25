-- Catégories générales des guides et consentements (Recherche, Nutrition…), créées par les administrateurs,
-- et public d'un guide (employés ou patients). Rien n'est supprimé.
CREATE TABLE IF NOT EXISTS public.themes_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS themes_documents_nom_idx ON public.themes_documents (lower(nom));
ALTER TABLE public.themes_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS theme_id uuid REFERENCES public.themes_documents(id) ON DELETE SET NULL;
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS public text NOT NULL DEFAULT 'employes';
ALTER TABLE public.communications DROP CONSTRAINT IF EXISTS communications_public_check;
ALTER TABLE public.communications ADD CONSTRAINT communications_public_check CHECK (public IN ('employes','patients'));
INSERT INTO public.themes_documents (nom) VALUES ('Recherche'), ('Mineur'), ('Nutrition'), ('Chirurgie'), ('Accès aux dossiers') ON CONFLICT DO NOTHING;
