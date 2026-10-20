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

-- ---------------------------------------------------------------------------
-- 2. Sondages de satisfaction (séparés des examens)
--    Une réponse par employé et par formation. Les résultats sont présentés à l'équipe sans nom.
--    Accès : par le serveur (clé de service) uniquement.

CREATE TABLE IF NOT EXISTS public.sondage_reponses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id    uuid NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  employe_id      uuid NOT NULL REFERENCES public.employes(id) ON DELETE CASCADE,
  note_globale    smallint NOT NULL CHECK (note_globale BETWEEN 1 AND 5),
  clarte          smallint NOT NULL CHECK (clarte BETWEEN 1 AND 5),
  utilite         smallint NOT NULL CHECK (utilite BETWEEN 1 AND 5),
  duree           smallint NOT NULL CHECK (duree BETWEEN 1 AND 5),
  recommandation  smallint NOT NULL CHECK (recommandation BETWEEN 1 AND 5),
  commentaire     text CHECK (char_length(commentaire) <= 2000),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (formation_id, employe_id)
);
CREATE INDEX IF NOT EXISTS sondage_reponses_formation_idx ON public.sondage_reponses (formation_id);
ALTER TABLE public.sondage_reponses ENABLE ROW LEVEL SECURITY;

-- Sondage proposé ou non à la fin de chaque formation (activé par défaut)
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS sondage_actif boolean NOT NULL DEFAULT true;

COMMIT;
