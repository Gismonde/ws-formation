-- Droit « Mise en page des événements » (bannière en vedette, fond) : accordé seulement par l'administrateur global
ALTER TABLE public.employes ADD COLUMN IF NOT EXISTS peut_mise_en_page_evenements boolean NOT NULL DEFAULT false;
