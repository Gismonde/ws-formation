-- Nouveaux types du journal d'audit : formations disponibles hors assignation
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'INSCRIPTION_VOLONTAIRE';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'DEMANDE_ACCES_ENVOYEE';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'DEMANDE_ACCES_TRAITEE';
