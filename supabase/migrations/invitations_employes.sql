-- Liens d'invitation des nouveaux employés, sans expiration : valides jusqu'à leur utilisation
-- (ou jusqu'à l'envoi d'une nouvelle invitation, qui annule l'ancienne). Seule l'empreinte SHA-256 du jeton est conservée.
CREATE TABLE IF NOT EXISTS public.invitations_employes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,
  email text NOT NULL,
  jeton_hash text NOT NULL UNIQUE,
  cree_le timestamptz NOT NULL DEFAULT now(),
  utilise_le timestamptz,
  annule_le timestamptz
);
CREATE INDEX IF NOT EXISTS invitations_employes_auth_idx ON public.invitations_employes (auth_user_id);
ALTER TABLE public.invitations_employes ENABLE ROW LEVEL SECURITY;
