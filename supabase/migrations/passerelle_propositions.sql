-- « La Passerelle » : propositions des employés (idées d'articles, photos en PDF/JPEG/PNG, stockées en privé).
-- Les personnes qui les reçoivent sont choisies dans Administration → La Passerelle (table reglages, clé passerelle_destinataires).
CREATE TABLE IF NOT EXISTS public.passerelle_propositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id uuid REFERENCES public.employes(id) ON DELETE SET NULL,
  sujet text NOT NULL,
  message text NOT NULL DEFAULT '',
  fichiers jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ "ref": "media:passerelle-propositions/…", "nom": "…", "type": "…", "taille": 123 }]
  statut text NOT NULL DEFAULT 'nouvelle',       -- nouvelle | retenue | classee
  note text NOT NULL DEFAULT '',                 -- note interne de l'équipe du journal
  traite_par uuid REFERENCES public.employes(id) ON DELETE SET NULL,
  traite_le timestamptz,
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passerelle_propositions_date_idx ON public.passerelle_propositions (cree_le DESC);
CREATE INDEX IF NOT EXISTS passerelle_propositions_employe_idx ON public.passerelle_propositions (employe_id);
ALTER TABLE public.passerelle_propositions ENABLE ROW LEVEL SECURITY;
