# SOP-08 — Déploiement d'une mise à jour

**Version :** 1.0
**Date :** 2026-05-30
**Audience :** Administrateurs système uniquement
**Responsable :** Administrateur système

---

## Objectif

Cette procédure décrit les étapes pour déployer une mise à jour de l'application WS Formation en production via Vercel, en minimisant les risques d'interruption de service et en garantissant un rollback rapide si nécessaire.

---

## Stack de déploiement

| Composant | Outil | URL |
|-----------|-------|-----|
| Frontend / API | Next.js sur Vercel | vercel.com/gismondes-projects/ws-formation |
| Base de données | Supabase (PostgreSQL) | supabase.com/dashboard/project/vtuegggoruiowjxoiocd |
| Code source | GitHub | github.com/Gismonde/ws-formation |
| Branche de production | `main` | Déploiement automatique à chaque push |

---

## Avant de commencer — Checklist pré-déploiement

Complète cette checklist **avant tout déploiement en production** :

- [ ] Les changements ont été testés en local (npm run dev)
- [ ] Les changements ont été testés sur une branche de staging (si disponible)
- [ ] Les variables d'environnement nécessaires sont configurées sur Vercel
- [ ] Les migrations de base de données (si applicable) sont prêtes
- [ ] Un backup récent de la base de données existe (voir SOP-09)
- [ ] Le déploiement est planifié pendant les heures creuses (si changement majeur)
- [ ] Un plan de rollback est identifié

---

## Étapes

### Étape 1 — Vérifier l'état actuel de la production

1. Ouvre la plateforme en production : **https://ws-formation.vercel.app**
2. Connecte-toi et vérifie que tout fonctionne normalement
3. Note la version actuelle si disponible (numéro de commit ou date du dernier déploiement)
4. Va sur Vercel : **https://vercel.com/gismondes-projects/ws-formation/deployments**
5. Identifie le déploiement actif (marqué "Production" en vert)
6. Note le Deployment ID en cas de besoin de rollback

---

### Étape 2 — Préparer et pousser les changements

**Si les changements sont déjà sur la branche main :**

Le déploiement se déclenche automatiquement. Passe à l'Étape 3.

**Si les changements sont sur une branche de feature :**

```bash
# 1. Fusionner la branche feature dans main
git checkout main
git pull origin main
git merge feature/nom-de-la-feature

# 2. Vérifier qu'il n'y a pas de conflits
# Résoudre les conflits si nécessaire

# 3. Pousser vers GitHub
git push origin main
```

**Via GitHub (sans ligne de commande) :**
1. Ouvre la Pull Request sur GitHub
2. Vérifie les changements dans l'onglet "Files changed"
3. Clique sur **"Merge pull request"**
4. Clique sur **"Confirm merge"**

---

### Étape 3 — Surveiller le déploiement sur Vercel

1. Va sur Vercel : **https://vercel.com/gismondes-projects/ws-formation/deployments**
2. Le nouveau déploiement apparaît en haut avec le statut **"Building"**
3. Clique sur le déploiement pour voir les logs en temps réel
4. Surveille les étapes :
   - **Installing dependencies** (~30 secondes)
   - **Building** (~1-2 minutes)
   - **Deploying** (~30 secondes)
5. Attends le statut **"Ready"** (déploiement réussi) ou **"Error"** (voir Étape 5)

**Durée typique d'un déploiement : 2-4 minutes**

---

### Étape 4 — Vérifications post-déploiement

Dès que le déploiement est marqué "Ready" :

1. **Test de connexion**
   - Ouvre https://ws-formation.vercel.app/login
   - Connecte-toi avec un compte de test
   - Vérifie que la session s'établit correctement

2. **Test du dashboard**
   - Naviguer vers /dashboard
   - Vérifier que les formations s'affichent
   - Vérifier que la navigation fonctionne

3. **Test admin** (si changements admin)
   - Naviguer vers /admin
   - Vérifier les fonctionnalités modifiées

4. **Test MFA** (si changements auth)
   - Tester la connexion avec un compte MFA activé
   - Vérifier le flux /mfa-verify

5. **Vérification Supabase**
   - Confirmer que les requêtes API fonctionnent
   - Vérifier les logs Supabase pour erreurs

---

### Étape 5 — Si le déploiement échoue (Build Error)

1. Clique sur le déploiement en erreur dans Vercel
2. Consulte les logs pour identifier l'erreur
3. **Erreurs courantes et solutions :**

| Erreur | Cause probable | Solution |
|--------|---------------|---------|
| Module not found | Dépendance manquante | Vérifier package.json |
| Type error | Erreur TypeScript | Corriger le type dans le code |
| Build timeout | Build trop long | Optimiser le build ou augmenter le timeout |
| Environment variable missing | Variable non configurée | Ajouter dans Vercel Settings → Env vars |

4. Corriger l'erreur dans le code
5. Pousser le correctif sur main
6. Surveiller le nouveau déploiement (retour à l'Étape 3)

---

### Étape 6 — Rollback si nécessaire

Si le déploiement est réussi (Ready) mais cause des problèmes en production :

1. Va sur Vercel : **https://vercel.com/gismondes-projects/ws-formation/deployments**
2. Trouve le dernier déploiement **stable** (avant ta mise à jour)
3. Clique sur les **trois points (...)** à droite de ce déploiement
4. Clique sur **"Promote to Production"**
5. Confirme l'action
6. Vercel remet immédiatement l'ancienne version en production

**Temps de rollback : moins de 30 secondes**

---

### Étape 7 — Migrations de base de données (si applicable)

Si la mise à jour inclut des changements de schéma de base de données :

1. **Avant le déploiement :** créer un backup (SOP-09)
2. Va dans Supabase → **SQL Editor**
3. Exécute les migrations dans l'ordre :
   ```sql
   -- Exemple : ajouter une colonne
   ALTER TABLE employes ADD COLUMN IF NOT EXISTS telephone text;
   ```
4. Vérifie que la migration s'est exécutée sans erreur
5. Teste une requête sur la table modifiée
6. Procède au déploiement du code (Étape 2)

> **Important :** Les migrations doivent être **rétrocompatibles** — ne jamais supprimer une colonne utilisée par le code actuel avant d'avoir déployé le code qui ne l'utilise plus.

---

### Étape 8 — Documenter le déploiement

Après chaque déploiement réussi :

1. Note dans le journal de déploiement (fichier ou outil interne) :
   - Date et heure du déploiement
   - Description des changements
   - Deployment ID Vercel
   - Résultat des tests post-déploiement
   - Problèmes rencontrés et solutions

---

## Variables d'environnement — Rappel

Si une nouvelle variable est requise, l'ajouter sur Vercel **avant** le déploiement :

1. Vercel → Settings → Environment Variables
2. Ajouter la variable pour l'environnement **Production**
3. Redéployer si nécessaire

**Variables critiques actuelles :**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

---

## Points de contact

| Situation | Qui contacter |
|-----------|--------------|
| Build qui échoue de façon inexplicable | Support Vercel / Équipe technique |
| Problème Supabase | Support Supabase |
| Rollback requis d'urgence | Administrateur système disponible le plus rapidement |

---

## Références

- [Architecture — Stack technique](../architecture.md)
- [Sécurité — Variables d'environnement](../securite.md)
- [SOP-09 — Sauvegarde et restauration](./SOP-09-sauvegarde-restauration.md)
- Dashboard Vercel : https://vercel.com/gismondes-projects/ws-formation
