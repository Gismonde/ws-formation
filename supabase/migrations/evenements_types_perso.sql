-- Types d'événements créés par les admins (en plus de formation / social / clinique)
CREATE TABLE IF NOT EXISTS public.evenements_types_perso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  emoji text NOT NULL,
  couleur text NOT NULL,
  fond text,
  mode text NOT NULL DEFAULT 'participation' CHECK (mode IN ('inscription', 'participation')),
  cree_par uuid REFERENCES public.employes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.evenements_types_perso ENABLE ROW LEVEL SECURITY;
-- Le type d'un événement peut désormais être un type créé (son identifiant)
ALTER TABLE public.evenements DROP CONSTRAINT IF EXISTS evenements_type_check;
