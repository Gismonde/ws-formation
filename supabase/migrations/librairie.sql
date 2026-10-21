-- Librairie : vidéos, liens et documents réutilisables dans les formations
--  - Une leçon y fait référence (content_blocks.metadata.librairie_id) : modifier l'élément met à jour
--    toutes les leçons qui l'utilisent.
--  - Accès : par le serveur (clé de service) uniquement ; droits appliqués par l'application.
-- À exécuter une fois dans Supabase → SQL Editor. Peut être relancé sans effet de bord.

CREATE TABLE IF NOT EXISTS public.librairie (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text NOT NULL CHECK (type IN ('video', 'lien', 'document')),
  titre       text NOT NULL CHECK (char_length(titre) BETWEEN 1 AND 300),
  description text CHECK (char_length(description) <= 2000),
  url         text NOT NULL,                    -- https://… ou « media:… » (document téléversé, espace privé)
  nom_fichier text,
  categorie   text,
  clinique    text NOT NULL DEFAULT 'LES_DEUX' CHECK (clinique IN ('CMC', 'WSSC', 'LES_DEUX')),
  archive     boolean NOT NULL DEFAULT false,
  source      text,                             -- ex. « grs » pour l'import depuis la librairie GrS
  cree_par    uuid REFERENCES public.employes(id) ON DELETE SET NULL,
  cree_le     timestamptz NOT NULL DEFAULT now(),
  modifie_le  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS librairie_type_idx ON public.librairie (type, archive);
CREATE INDEX IF NOT EXISTS content_blocks_librairie_idx ON public.content_blocks ((metadata->>'librairie_id')) WHERE metadata ? 'librairie_id';
ALTER TABLE public.librairie ENABLE ROW LEVEL SECURITY;
