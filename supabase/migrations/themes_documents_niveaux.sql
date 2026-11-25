-- Sous-catégories (ex. Chirurgie › Chirurgie générale › Dre Doyon) et plusieurs catégories par document.
ALTER TABLE public.themes_documents ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.themes_documents(id);
DROP INDEX IF EXISTS public.themes_documents_nom_idx;
CREATE UNIQUE INDEX IF NOT EXISTS themes_documents_parent_nom_idx ON public.themes_documents (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nom));
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS themes uuid[] NOT NULL DEFAULT '{}';
UPDATE public.communications SET themes = ARRAY[theme_id] WHERE theme_id IS NOT NULL AND themes = '{}';
