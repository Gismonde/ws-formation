-- Événements « date à venir » (coming soon) : publiés sans date ; les employés intéressés sont avisés à l'annonce de la date.
ALTER TABLE public.evenements ADD COLUMN IF NOT EXISTS date_a_venir boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.evenements_interets (
  evenement_id uuid NOT NULL REFERENCES public.evenements(id) ON DELETE CASCADE,
  employe_id uuid NOT NULL REFERENCES public.employes(id) ON DELETE CASCADE,
  cree_le timestamptz NOT NULL DEFAULT now(),
  avise_le timestamptz,
  PRIMARY KEY (evenement_id, employe_id)
);
ALTER TABLE public.evenements_interets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.evenements_interets FROM anon, authenticated;
