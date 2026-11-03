-- Narration audio : démarrage automatique à l'ouverture des leçons (sinon l'apprenant clique sur ▶)
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS audio_auto boolean NOT NULL DEFAULT false;
