-- Politiques & procédures : une même table pour trois pages (Affiches & communications, Nos guides, Nos consentements).
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS categorie text NOT NULL DEFAULT 'communication';
ALTER TABLE public.communications DROP CONSTRAINT IF EXISTS communications_categorie_check;
ALTER TABLE public.communications ADD CONSTRAINT communications_categorie_check CHECK (categorie IN ('communication','guide','consentement'));
