-- Formations disponibles en libre accès : l'employé peut les suivre sans qu'elles lui soient assignées.
ALTER TABLE formations  ADD COLUMN IF NOT EXISTS libre_acces boolean NOT NULL DEFAULT false;
-- Inscription faite par l'employé lui-même (non obligatoire : exclue de la conformité et des rappels)
ALTER TABLE assignations ADD COLUMN IF NOT EXISTS volontaire boolean NOT NULL DEFAULT false;
