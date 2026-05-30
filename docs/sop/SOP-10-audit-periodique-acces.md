# SOP-10 — Audit périodique des accès

**Version :** 1.0
**Date :** 2026-05-30
**Audience :** Administrateurs système uniquement
**Responsable :** Administrateur système

---

## Objectif

Cette procédure décrit comment effectuer un audit trimestriel des accès à la plateforme WS Formation pour s'assurer que les droits attribués sont toujours appropriés, détecter des activités suspectes, et maintenir la conformité Loi 25 / RGPD.

---

## Fréquence

| Audit | Fréquence | Déclencheur |
|-------|-----------|-------------|
| Revue des comptes actifs | Trimestriel | Calendrier fixe |
| Revue des rôles admin | Mensuel | Calendrier + après tout changement d'équipe |
| Analyse des logs d'activité | Mensuel | Calendrier fixe |
| Audit complet pré-inspection | À la demande | Avant un audit externe ou une inspection |

---

## Étapes

### Étape 1 — Revue des comptes utilisateurs actifs

#### 1.1 Extraire la liste des comptes actifs

1. Connecte-toi à Supabase → **SQL Editor**
2. Exécute la requête suivante :

```sql
-- Liste complète des comptes actifs avec leur rôle et dernière activité
SELECT
  e.id,
  e.prenom,
  e.nom,
  e.email,
  e.poste,
  e.departement,
  e.role,
  e.actif,
  e.created_at,
  -- Dernière connexion depuis audit_logs (si disponible)
  MAX(al.created_at) AS derniere_activite
FROM employes e
LEFT JOIN audit_logs al ON al.employe_id = e.id
GROUP BY e.id, e.prenom, e.nom, e.email, e.poste, e.departement, e.role, e.actif, e.created_at
ORDER BY e.role, e.nom;
```

3. Exporte les résultats (bouton "Download CSV" dans Supabase SQL Editor)

---

#### 1.2 Vérifier chaque compte

Pour chaque compte dans la liste, vérifie :

- [ ] L'employé est toujours en poste dans l'organisation
- [ ] Le rôle attribué correspond à ses fonctions actuelles
- [ ] Le département/poste est à jour
- [ ] Le compte n'est pas resté actif après un départ (vérifier avec RH)

**Comptes suspects à investiguer :**
- Comptes actifs sans aucune activité depuis plus de 90 jours
- Comptes d'employés qui ont quitté l'organisation (vérifier avec RH)
- Comptes avec un rôle admin non justifié

---

#### 1.3 Actions correctives

| Problème détecté | Action |
|-----------------|--------|
| Employé parti, compte encore actif | Désactiver immédiatement (SOP-02) |
| Rôle incorrect | Modifier via Admin → Employés |
| Compte sans activité prolongée | Contacter l'employé, désactiver si confirmé |
| Compte admin non justifié | Rétrograder au rôle employé |

---

### Étape 2 — Revue des comptes administrateurs

Les comptes avec rôle **admin** ou **super_admin** doivent faire l'objet d'une attention particulière :

```sql
-- Lister tous les administrateurs
SELECT
  prenom,
  nom,
  email,
  role,
  departement,
  created_at
FROM employes
WHERE role IN ('admin', 'super_admin')
AND actif = true
ORDER BY role DESC, nom;
```

Pour chaque administrateur :
- [ ] L'accès admin est-il toujours justifié par ses fonctions ?
- [ ] A-t-il reçu une formation sur la gestion de la plateforme ?
- [ ] Son MFA est-il activé ? (les admins devraient tous avoir le MFA actif)

```sql
-- Vérifier quels admins ont le MFA activé (via Supabase Auth)
-- Note : vérifier manuellement dans Supabase → Authentication → Users
-- Filtrer par email des admins et vérifier la colonne "MFA"
```

---

### Étape 3 — Analyse des logs d'activité

#### 3.1 Activité générale

```sql
-- Résumé de l'activité des 30 derniers jours
SELECT
  e.prenom || ' ' || e.nom AS employe,
  e.role,
  al.action,
  COUNT(*) AS nb_actions,
  MAX(al.created_at) AS derniere_action
FROM audit_logs al
JOIN employes e ON e.id = al.employe_id
WHERE al.created_at >= NOW() - INTERVAL '30 days'
GROUP BY e.prenom, e.nom, e.role, al.action
ORDER BY nb_actions DESC;
```

#### 3.2 Activités suspectes à détecter

```sql
-- Connexions en dehors des heures ouvrables (avant 7h ou après 20h)
SELECT
  e.prenom || ' ' || e.nom AS employe,
  al.action,
  al.created_at,
  EXTRACT(HOUR FROM al.created_at) AS heure
FROM audit_logs al
JOIN employes e ON e.id = al.employe_id
WHERE al.action = 'CONNEXION'
AND (
  EXTRACT(HOUR FROM al.created_at) < 7
  OR EXTRACT(HOUR FROM al.created_at) > 20
)
AND al.created_at >= NOW() - INTERVAL '30 days'
ORDER BY al.created_at DESC;

-- Tentatives de connexion échouées répétées
SELECT
  al.details->>'email' AS email_tente,
  COUNT(*) AS nb_echecs,
  MAX(al.created_at) AS dernier_echec
FROM audit_logs al
WHERE al.action = 'CONNEXION_ECHEC'
AND al.created_at >= NOW() - INTERVAL '7 days'
GROUP BY al.details->>'email'
HAVING COUNT(*) >= 3
ORDER BY nb_echecs DESC;

-- Modifications massives de données
SELECT
  e.prenom || ' ' || e.nom AS employe,
  al.action,
  al.table_cible,
  COUNT(*) AS nb_modifications,
  MIN(al.created_at) AS debut,
  MAX(al.created_at) AS fin
FROM audit_logs al
JOIN employes e ON e.id = al.employe_id
WHERE al.action IN ('UPDATE', 'DELETE', 'INSERT')
AND al.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY e.prenom, e.nom, al.action, al.table_cible
HAVING COUNT(*) >= 10
ORDER BY nb_modifications DESC;
```

---

### Étape 4 — Vérifier les configurations de sécurité

#### 4.1 RLS (Row Level Security)

```sql
-- Vérifier que toutes les tables ont le RLS activé
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_active
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Résultat attendu :** `rls_active = true` pour toutes les tables.

#### 4.2 Policies actives

```sql
-- Lister toutes les policies RLS en place
SELECT
  tablename,
  policyname,
  cmd AS operation,
  roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

Vérifie qu'il n'y a pas de policy manquante ou incorrecte par rapport à la documentation (/docs/securite.md).

---

### Étape 5 — Documenter et conclure l'audit

#### 5.1 Rapport d'audit

Crée un rapport contenant :

```
RAPPORT D'AUDIT DES ACCÈS — WS Formation
Date : [Date]
Réalisé par : [Nom de l'administrateur]

COMPTES ACTIFS
- Total comptes actifs : [X]
- Dont admins/super_admins : [X]
- Comptes désactivés ce trimestre : [X]

CHANGEMENTS EFFECTUÉS
- [Liste des actions correctives prises]

ACTIVITÉS SUSPECTES DÉTECTÉES
- [Aucune / Description si applicable]
- Actions prises : [Description]

CONFIGURATIONS DE SÉCURITÉ
- RLS : Toutes les tables ✅ / Issues : [Description]
- Policies : Conformes ✅ / Issues : [Description]

PROCHAINE RÉVISION
- Date : [Trimestre prochain]
```

#### 5.2 Archiver le rapport

1. Conserve le rapport dans le dossier d'audit interne (hors GitHub — données sensibles)
2. Note la date de la prochaine révision dans le calendrier
3. Informe la direction de tout problème significatif détecté

---

## Checklist d'audit rapide (mensuel)

- [ ] Vérifier les nouveaux comptes créés ce mois
- [ ] Vérifier les comptes désactivés ce mois (offboarding effectué ?)
- [ ] Consulter les logs d'activité pour anomalies
- [ ] Vérifier que tous les admins ont le MFA activé
- [ ] Aucune tentative de connexion suspecte en série

---

## Références

- [Sécurité — RLS et politiques](../securite.md)
- [Permissions et rôles](../permissions.md)
- [Schéma de base de données — audit_logs](../database.md)
- [SOP-02 — Offboarding](./SOP-02-offboarding-employe.md)
- [SOP-03 — Incident de sécurité](./SOP-03-incident-securite.md)
