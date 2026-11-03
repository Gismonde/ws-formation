-- Formulaires v2 : plusieurs destinataires (départements / personnes), envoi anonyme,
-- section complétée par le gestionnaire, suivi visible par l'employé (statut, réponse).
ALTER TABLE public.formulaires ADD COLUMN IF NOT EXISTS destinataires jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.formulaires ADD COLUMN IF NOT EXISTS anonyme_permis boolean NOT NULL DEFAULT false;
ALTER TABLE public.formulaires ADD COLUMN IF NOT EXISTS message_anonymat text;

ALTER TABLE public.formulaire_reponses ADD COLUMN IF NOT EXISTS anonyme boolean NOT NULL DEFAULT false;
ALTER TABLE public.formulaire_reponses ADD COLUMN IF NOT EXISTS statut_le timestamptz;
ALTER TABLE public.formulaire_reponses ADD COLUMN IF NOT EXISTS reponse_employe text;
ALTER TABLE public.formulaire_reponses ADD COLUMN IF NOT EXISTS reponse_le timestamptz;
ALTER TABLE public.formulaire_reponses ADD COLUMN IF NOT EXISTS reserve_complete_le timestamptz;
ALTER TABLE public.formulaire_reponses ADD COLUMN IF NOT EXISTS reserve_complete_par uuid REFERENCES public.employes(id) ON DELETE SET NULL;
