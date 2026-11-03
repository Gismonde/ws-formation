-- Suggestions : assignation à un administrateur responsable du suivi
ALTER TABLE public.suggestions ADD COLUMN IF NOT EXISTS assigne_a uuid REFERENCES public.employes(id) ON DELETE SET NULL;
ALTER TABLE public.suggestions ADD COLUMN IF NOT EXISTS assigne_le timestamptz;
