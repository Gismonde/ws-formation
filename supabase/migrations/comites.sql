-- « Apprenez à connaître vos comités » (portail employé, WSSC).
-- Un comité en brouillon (publie = false) n'est visible que par les administrateurs, dans leur espace employé.
CREATE TABLE IF NOT EXISTS public.comites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinique text NOT NULL DEFAULT 'WSSC',
  nom text NOT NULL,
  icone text NOT NULL DEFAULT '🤝',
  couleur text NOT NULL DEFAULT 'violet',
  presentation text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  activites text NOT NULL DEFAULT '',
  utilite text NOT NULL DEFAULT '',
  contact text NOT NULL DEFAULT '',
  -- [{ "employe_id": uuid|null, "nom": "…", "poste": "…", "role": "…" }]
  membres jsonb NOT NULL DEFAULT '[]'::jsonb,
  ordre integer NOT NULL DEFAULT 0,
  publie boolean NOT NULL DEFAULT false,
  cree_par uuid REFERENCES public.employes(id) ON DELETE SET NULL,
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comites_clinique_ordre_idx ON public.comites (clinique, ordre);
-- Accès uniquement par le serveur (clé de service) : aucune politique pour les clients
ALTER TABLE public.comites ENABLE ROW LEVEL SECURITY;

-- Réglages simples de la plateforme (clé → valeur JSON). Ex. « banniere_comites » : bannière de la page d'accueil.
CREATE TABLE IF NOT EXISTS public.reglages (
  cle text PRIMARY KEY,
  valeur jsonb NOT NULL DEFAULT '{}'::jsonb,
  modifie_par uuid REFERENCES public.employes(id) ON DELETE SET NULL,
  modifie_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reglages ENABLE ROW LEVEL SECURITY;

-- Image de couverture d'un comité (adresse https:// ou chemin /…)
ALTER TABLE public.comites ADD COLUMN IF NOT EXISTS image text NOT NULL DEFAULT '';
