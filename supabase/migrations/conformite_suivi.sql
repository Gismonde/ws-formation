-- Conformité et suivi : rappels automatiques, sondages de satisfaction, page d'accueil des cliniques
--
-- À exécuter une fois dans Supabase → SQL Editor. Tout ou rien. Peut être relancé sans effet de bord.
-- Le code fonctionne avant l'exécution : les fonctions concernées restent simplement inactives.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Rappels envoyés (certificats qui expirent, formations en retard)
--    Un rappel = (type, référence, palier). Sert à ne jamais envoyer deux fois le même courriel,
--    et de preuve d'envoi (conformité). Accès : clé de service uniquement (aucune règle RLS).

CREATE TABLE IF NOT EXISTS public.rappels_envoyes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type         text NOT NULL CHECK (type IN ('certificat_expiration', 'formation_echeance')),
  reference    text NOT NULL,   -- certificat : « id:date_expiration » ; échéance : « assignation_id:date_echeance »
  palier       text NOT NULL,   -- ex. « J-30 », « J-7 », « J-0 », « retard-1 »
  employe_id   uuid REFERENCES public.employes(id) ON DELETE SET NULL,
  destinataire text,
  envoye_le    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (type, reference, palier)
);
CREATE INDEX IF NOT EXISTS rappels_envoyes_employe_idx ON public.rappels_envoyes (employe_id);
ALTER TABLE public.rappels_envoyes ENABLE ROW LEVEL SECURITY;

COMMIT;
