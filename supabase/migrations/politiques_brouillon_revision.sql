-- Politiques : brouillon (préparée sans être diffusée) et date de révision (avec alerte)
ALTER TABLE politiques ADD COLUMN IF NOT EXISTS brouillon boolean NOT NULL DEFAULT false;
ALTER TABLE politiques ADD COLUMN IF NOT EXISTS date_revision date;
-- Dernière alerte de révision envoyée (évite les courriels en double)
ALTER TABLE politiques ADD COLUMN IF NOT EXISTS revision_alerte_le date;
NOTIFY pgrst, 'reload schema';
