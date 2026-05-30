# SOP-09 — Sauvegarde et restauration des données

**Version :** 1.0
**Date :** 2026-05-30
**Audience :** Administrateurs système uniquement
**Responsable :** Administrateur système

---

## Objectif

Cette procédure décrit comment vérifier les sauvegardes automatiques de Supabase, créer une sauvegarde manuelle avant un changement critique, et restaurer les données en cas de besoin.

---

## Architecture de sauvegarde

WS Formation utilise **Supabase** (PostgreSQL managé) qui inclut des sauvegardes automatiques :

| Type | Fréquence | Rétention | Plan requis |
|------|-----------|-----------|-------------|
| Sauvegardes automatiques | Quotidiennes | 7 jours (Free) / 30 jours (Pro) | Tous |
| Point-in-Time Recovery (PITR) | Continue | Selon le plan | Pro et plus |
| Sauvegarde manuelle (dump SQL) | À la demande | Indéfini (stockage local) | Tous |

---

## Étapes

### Étape 1 — Vérifier les sauvegardes automatiques Supabase

À faire **hebdomadairement** ou avant tout changement majeur :

1. Connecte-toi au dashboard Supabase : **https://supabase.com/dashboard/project/vtuegggoruiowjxoiocd**
2. Dans le menu de gauche, clique sur **"Database"** → **"Backups"**
3. Vérifie que des sauvegardes récentes sont listées
4. Confirme la date et l'heure de la dernière sauvegarde automatique
5. Note les informations dans le journal d'administration

**Critère de succès :** Une sauvegarde récente (moins de 24h) est disponible.

---

### Étape 2 — Créer une sauvegarde manuelle avant un changement critique

À faire **avant tout déploiement majeur** ou migration de base de données.

#### Option A — Export via le dashboard Supabase

1. Va dans Supabase → **"Database"** → **"Backups"**
2. Clique sur **"Download backup"** (si disponible selon le plan)
3. Télécharge le fichier et conserve-le en lieu sûr

#### Option B — Export SQL manuel via SQL Editor

1. Va dans Supabase → **"SQL Editor"**
2. Exécute les requêtes d'export pour chaque table critique :

```sql
-- Exporter les données employes
COPY employes TO '/tmp/employes_backup.csv' WITH CSV HEADER;

-- Exporter les progressions
COPY progressions TO '/tmp/progressions_backup.csv' WITH CSV HEADER;

-- Exporter les certificats
COPY certificats TO '/tmp/certificats_backup.csv' WITH CSV HEADER;
```

#### Option C — pg_dump (ligne de commande, recommandé)

Si tu as accès aux outils PostgreSQL localement :

```bash
# Récupérer les credentials dans Supabase → Settings → Database
pg_dump   --host=db.vtuegggoruiowjxoiocd.supabase.co   --port=5432   --username=postgres   --dbname=postgres   --format=custom   --file=ws-formation-backup-$(date +%Y%m%d).dump

# Vérifier la taille du fichier
ls -lh ws-formation-backup-*.dump
```

3. **Stocker le backup** dans un emplacement sécurisé :
   - Dossier crypté sur un disque externe
   - Stockage cloud sécurisé (pas GitHub public)
   - Jamais sur un appareil partagé

---

### Étape 3 — Vérifier l'intégrité d'une sauvegarde

Après la création d'une sauvegarde manuelle :

```sql
-- Dans SQL Editor, vérifier le nombre de lignes par table
SELECT 'employes' as table_name, COUNT(*) as lignes FROM employes
UNION ALL
SELECT 'formations', COUNT(*) FROM formations
UNION ALL
SELECT 'progressions', COUNT(*) FROM progressions
UNION ALL
SELECT 'certificats', COUNT(*) FROM certificats
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs;
```

Note ces chiffres. Après une restauration, comparer avec ces valeurs pour valider l'intégrité.

---

### Étape 4 — Restaurer depuis une sauvegarde Supabase

#### Restauration via le dashboard Supabase (Plan Pro+)

1. Va dans Supabase → **"Database"** → **"Backups"**
2. Identifie la sauvegarde à restaurer (date et heure)
3. Clique sur **"Restore"** à côté de la sauvegarde
4. Confirme l'opération (irréversible — toutes les données après ce point seront perdues)
5. Attends la fin de la restauration (peut prendre plusieurs minutes)
6. Vérifie l'intégrité avec la requête de l'Étape 3

> **Attention :** La restauration via Supabase est irréversible. Elle remplace toutes les données par celles du point de restauration choisi. Crée toujours une sauvegarde de l'état actuel avant de restaurer.

#### Restauration depuis un dump pg_dump

```bash
# Restaurer depuis un fichier .dump
pg_restore   --host=db.vtuegggoruiowjxoiocd.supabase.co   --port=5432   --username=postgres   --dbname=postgres   --clean   --if-exists   ws-formation-backup-20260530.dump
```

#### Restauration partielle (une seule table)

Si seule une table est corrompue :

```sql
-- Vider la table et réimporter depuis le CSV
TRUNCATE TABLE employes RESTART IDENTITY CASCADE;

COPY employes FROM '/tmp/employes_backup.csv' WITH CSV HEADER;

-- Vérifier
SELECT COUNT(*) FROM employes;
```

---

### Étape 5 — Vérifications post-restauration

Après toute restauration :

1. **Vérifier le nombre de lignes** (comparer avec les notes de l'Étape 3)
2. **Tester la connexion** à la plateforme
3. **Tester une opération** de chaque type :
   - Connexion utilisateur
   - Affichage des formations
   - Affichage des certificats
4. **Vérifier les RLS policies** :
   ```sql
   -- Vérifier que les policies sont actives
   SELECT tablename, policyname, cmd
   FROM pg_policies
   WHERE schemaname = 'public'
   ORDER BY tablename;
   ```
5. Documenter la restauration dans le journal d'administration

---

## Fréquence et calendrier recommandés

| Action | Fréquence | Responsable |
|--------|-----------|-------------|
| Vérifier backups automatiques Supabase | Hebdomadaire | Admin |
| Backup manuel avant déploiement majeur | Avant chaque déploiement critique | Admin |
| Test de restauration (simulation) | Trimestriel | Admin |
| Vérification de la politique de rétention | Annuelle | Admin + Direction |

---

## Politique de rétention des backups manuels

| Type de backup | Durée de conservation |
|---------------|----------------------|
| Avant un déploiement mineur | 30 jours |
| Avant un déploiement majeur | 1 an |
| Snapshot annuel | 3 ans (ou selon réglementation) |
| Backup de conformité (audit) | Selon exigences légales |

---

## Contacts d'urgence

| Situation | Action |
|-----------|--------|
| Perte de données critique | Contacter Supabase Support immédiatement |
| Restauration impossible | Support Supabase + escalade direction |
| Corruption de la base de données | Isoler l'environnement, ne pas modifier |

Support Supabase : https://supabase.com/support

---

## Références

- [Architecture — Base de données](../architecture.md)
- [Schéma de base de données](../database.md)
- [SOP-08 — Déploiement](./SOP-08-deploiement-mise-a-jour.md)
- Dashboard Supabase : https://supabase.com/dashboard/project/vtuegggoruiowjxoiocd
