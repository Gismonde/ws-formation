-- Formulaires remplis par les employés (ex. déclaration d'incident), reçus par l'admin créateur
-- ou par un admin désigné. Accès uniquement par le serveur (clé de service) : RLS activé, aucune règle publique.

-- 1. Droit accordé par l'administrateur global
ALTER TABLE public.employes ADD COLUMN IF NOT EXISTS peut_creer_formulaires boolean NOT NULL DEFAULT false;

-- 2. Formulaires
CREATE TABLE IF NOT EXISTS public.formulaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titre text NOT NULL,
  code text,
  description text,
  instructions text,
  clinique text NOT NULL CHECK (clinique IN ('CMC', 'WSSC', 'LES_DEUX')),
  champs jsonb NOT NULL DEFAULT '[]'::jsonb,
  actif boolean NOT NULL DEFAULT false,
  archive boolean NOT NULL DEFAULT false,
  cree_par uuid REFERENCES public.employes(id) ON DELETE SET NULL,
  destinataire_id uuid REFERENCES public.employes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS formulaires_clinique_idx ON public.formulaires (clinique) WHERE actif AND NOT archive;

-- 3. Réponses (la définition du formulaire est copiée au moment de l'envoi)
CREATE TABLE IF NOT EXISTS public.formulaire_reponses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigserial,
  formulaire_id uuid NOT NULL REFERENCES public.formulaires(id) ON DELETE RESTRICT,
  employe_id uuid REFERENCES public.employes(id) ON DELETE SET NULL,
  definition jsonb NOT NULL,
  reponses jsonb NOT NULL DEFAULT '{}'::jsonb,
  reserve jsonb NOT NULL DEFAULT '{}'::jsonb,
  statut text NOT NULL DEFAULT 'recu' CHECK (statut IN ('recu', 'en_traitement', 'traite')),
  note_interne text,
  traite_par uuid REFERENCES public.employes(id) ON DELETE SET NULL,
  traite_le timestamptz,
  soumis_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS formulaire_reponses_formulaire_idx ON public.formulaire_reponses (formulaire_id, soumis_le DESC);
CREATE INDEX IF NOT EXISTS formulaire_reponses_employe_idx ON public.formulaire_reponses (employe_id, soumis_le DESC);

ALTER TABLE public.formulaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulaire_reponses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.formulaires, public.formulaire_reponses FROM anon, authenticated;

-- 4. Journal d'audit
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'FORMULAIRE_CREE';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'FORMULAIRE_MODIFIE';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'FORMULAIRE_SOUMIS';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'FORMULAIRE_TRAITE';
