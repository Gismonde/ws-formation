# Schema de base de donnees — WS Formation

Base de donnees : PostgreSQL 15 via Supabase
Mise a jour : 2026-05-29

---

## Tables principales

### employes

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid PK | Identifiant unique |
| auth_user_id | uuid FK | Lien Supabase Auth |
| prenom | text | Prenom |
| nom | text | Nom de famille |
| email | text UNIQUE | Email |
| poste | text | Titre du poste |
| departement | text | Departement |
| role | text | employe / admin / super_admin |
| actif | boolean | Compte actif ou archive |
| date_embauche | date | Date d'embauche |
| created_at | timestamptz | Creation |

### formations

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid PK | Identifiant |
| titre | text | Titre |
| description | text | Description |
| niveau | text | debutant / intermediaire / avance |
| duree_estimee | integer | Duree en minutes |
| publiee | boolean | Publiee ou brouillon |
| obligatoire | boolean | Obligatoire pour tous |
| lsst | boolean | Formation securite LSST |
| departements_cibles | text[] | Departements vises |
| validite_mois | integer NULL | Validite certificat (NULL = permanent) |

### lecons

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid PK | Identifiant |
| formation_id | uuid FK | Formation parente |
| titre | text | Titre |
| contenu | jsonb | Contenu structure en blocs |
| ordre | integer | Ordre dans la formation |

### progressions

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid PK | Identifiant |
| employe_id | uuid FK | Employe |
| formation_id | uuid FK | Formation |
| lecon_id | uuid FK NULL | Lecon completee |
| statut | text | en_cours / completee |
| date_completion | timestamptz | Date de completion |

### certificats

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid PK | Identifiant |
| employe_id | uuid FK | Employe |
| formation_id | uuid FK | Formation |
| date_emission | timestamptz | Date d'emission |
| date_expiration | timestamptz NULL | Calculee auto par trigger |

### audit_logs

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid PK | Identifiant |
| acteur_id | uuid FK | Qui a fait l'action |
| type_action | text | CONNEXION / CONNEXION_ECHOUEE / etc. |
| description | text | Details |
| ip_address | text | Adresse IP |
| user_agent | text | Navigateur |
| created_at | timestamptz | Date |

### preuves

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid PK | Identifiant |
| employe_id | uuid FK | Employe |
| formation_id | uuid FK NULL | Formation |
| fichier_url | text | URL Supabase Storage |
| statut | text | en_attente / validee / refusee |
| commentaire | text NULL | Commentaire admin |

---

## Trigger : trg_calculer_expiration_certificat

Declenche sur INSERT ou UPDATE de certificats.
Calcule date_expiration = date_emission + validite_mois mois.
Si formations.validite_mois est NULL, date_expiration reste NULL (permanent).

---

## Vue : certificats_avec_statut

Joint certificats + formations + employes.
Champs : id, employe_id, formation_id, date_emission, date_expiration, validite_mois, titre_formation, nom_employe
Statuts calcules : permanent / valide / bientot_expire (30j) / expire

---

## Row Level Security (RLS)

| Table | Politique | Description |
|-------|-----------|-------------|
| employes | employes_select_own | SELECT sur son propre profil |
| employes | admin_select_all | Admin voit tous les employes |
| formations | formations_select_publiees | Employes voient publiees |
| formations | admin_all | Admin gere tout |
| progressions | progressions_own | Employe gere sa progression |
| certificats | certificats_own | Employe voit ses certificats |
| audit_logs | admin_only | Admins uniquement |

---

## Relations

employes 1---N progressions
employes 1---N certificats
employes 1---N preuves
employes 1---N audit_logs
formations 1---N lecons
formations 1---N progressions
formations 1---N certificats
formations 1---N preuves
