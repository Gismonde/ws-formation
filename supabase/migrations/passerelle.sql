-- « La Passerelle » : le journal de la clinique (portail employé, WSSC). Éditions en PDF, stockées en privé.
CREATE TABLE IF NOT EXISTS public.passerelle_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinique text NOT NULL DEFAULT 'WSSC',
  numero integer NOT NULL,
  volume integer NOT NULL DEFAULT 1,
  date_parution date NOT NULL,
  temps_lecture integer,                      -- minutes
  accroche text NOT NULL DEFAULT '',          -- une phrase de présentation (facultatif)
  sommaire jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{ "titre": "…", "page": 3 }]
  couleur text NOT NULL DEFAULT 'bleu',
  pdf text NOT NULL,                          -- « media:<chemin> » (espace privé)
  couverture text NOT NULL DEFAULT '',        -- « media:<chemin> » : page 1 du PDF
  publie boolean NOT NULL DEFAULT false,
  cree_par uuid REFERENCES public.employes(id) ON DELETE SET NULL,
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passerelle_editions_date_idx ON public.passerelle_editions (clinique, date_parution DESC);
ALTER TABLE public.passerelle_editions ENABLE ROW LEVEL SECURITY;

-- Lectures (badge « Lecteur de La Passerelle »)
CREATE TABLE IF NOT EXISTS public.passerelle_lectures (
  employe_id uuid NOT NULL REFERENCES public.employes(id) ON DELETE CASCADE,
  edition_id uuid NOT NULL REFERENCES public.passerelle_editions(id) ON DELETE CASCADE,
  lu_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employe_id, edition_id)
);
ALTER TABLE public.passerelle_lectures ENABLE ROW LEVEL SECURITY;

-- Réglages simples (clé → JSON) : texte de l'encadré « On veut vous lire ! », bannière des comités…
CREATE TABLE IF NOT EXISTS public.reglages (
  cle text PRIMARY KEY,
  valeur jsonb NOT NULL DEFAULT '{}'::jsonb,
  modifie_par uuid REFERENCES public.employes(id) ON DELETE SET NULL,
  modifie_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reglages ENABLE ROW LEVEL SECURITY;
