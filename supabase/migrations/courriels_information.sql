-- Courriels d'information (Administration → Courriel d'information) : envoi immédiat ou programmé,
-- à tous les employés d'une clinique, à des départements, à des postes ou à des employés choisis.
CREATE TABLE IF NOT EXISTS public.courriels_information (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objet text NOT NULL,
  contenu text NOT NULL,
  bouton_libelle text NOT NULL DEFAULT '',
  bouton_lien text NOT NULL DEFAULT '',
  cible jsonb NOT NULL,                  -- { type: cliniques | departements | postes | employes, … }
  statut text NOT NULL DEFAULT 'programme', -- programme | envoi | envoye | annule | erreur
  envoi_prevu timestamptz NOT NULL DEFAULT now(),
  envoye_le timestamptz,
  nb_destinataires integer,
  nb_envoyes integer,
  nb_non_actives integer,
  erreur text,
  cree_par uuid REFERENCES public.employes(id) ON DELETE SET NULL,
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS courriels_information_dus_idx ON public.courriels_information (envoi_prevu) WHERE statut = 'programme';
ALTER TABLE public.courriels_information ENABLE ROW LEVEL SECURITY;
