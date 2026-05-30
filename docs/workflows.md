# Workflows — WS Formation

Mise a jour : 2026-05-30

---

## 1. Workflow de connexion

### 1.1 Connexion sans MFA

```
Utilisateur
  │
  ├─► Page /login
  │     • Saisit email + mot de passe
  │     • Soumet le formulaire
  │
  ├─► POST /api/auth/login
  │     • supabase.auth.signInWithPassword({ email, password })
  │     • Vérifie mfa.listFactors() → aucun facteur actif
  │     • Retourne { redirect: '/dashboard' }
  │
  └─► Page /dashboard
        • Session active
        • Accès aux fonctionnalités selon le rôle
```

### 1.2 Connexion avec MFA (TOTP activé)

```
Utilisateur
  │
  ├─► Page /login
  │     • Saisit email + mot de passe
  │
  ├─► POST /api/auth/login
  │     • supabase.auth.signInWithPassword({ email, password })
  │     • Vérifie mfa.listFactors() → facteur TOTP trouvé
  │     • Retourne { redirect: '/mfa-verify', factorId: '...' }
  │
  ├─► Page /mfa-verify
  │     • Affiche champ pour code TOTP (6 chiffres)
  │     • Utilisateur ouvre son app authenticator
  │     • Saisit le code à 6 chiffres
  │
  ├─► Vérification TOTP
  │     • supabase.auth.mfa.challenge({ factorId })
  │     • supabase.auth.mfa.verify({ factorId, challengeId, code })
  │     • Si succès → session complète
  │
  └─► Page /dashboard
        • Session complètement authentifiée
```

### 1.3 Gestion des erreurs de connexion

| Erreur | Message affiché | Action |
|--------|----------------|--------|
| Email inconnu | "Identifiants invalides" | Rester sur /login |
| Mot de passe incorrect | "Identifiants invalides" | Rester sur /login |
| Compte désactivé | "Compte désactivé" | Contacter admin |
| Code TOTP invalide | "Code incorrect" | Réessayer (30s max) |
| Code TOTP expiré | "Code expiré" | Nouveau code |

---

## 2. Workflow de formation

### 2.1 Inscription à une formation

```
Admin/SuperAdmin
  │
  ├─► Page /admin/formations
  │     • Crée une nouvelle formation
  │     • Définit : titre, description, durée, modules
  │
  ├─► Page /admin/formations/[id]/assigner
  │     • Sélectionne employés cibles
  │     • Définit date limite
  │
  └─► Inscription créée dans la table progressions
        • statut = 'en_cours'
        • date_debut = NOW()

Employé
  │
  ├─► Page /dashboard
  │     • Voit la formation assignée dans "Mes formations"
  │
  └─► Commence la formation
```

### 2.2 Progression dans une formation (leçons)

```
Employé
  │
  ├─► Ouvre une leçon
  │     • GET /api/formations/[id]/lecons
  │     • Affiche le contenu (vidéo, texte, quiz)
  │
  ├─► Complète la leçon
  │     • POST /api/progressions/update
  │     • Met à jour progressions.modules_completes
  │     • Calcule pourcentage_completion
  │
  ├─► [Répéter pour chaque leçon]
  │
  └─► Dernière leçon complétée
        • progressions.statut = 'complete'
        • progressions.date_fin = NOW()
        • Trigger : générer_certificat() → INSERT INTO certificats
```

### 2.3 Trigger de génération de certificat

```sql
-- Déclenchement automatique quand statut = 'complete'
CREATE OR REPLACE FUNCTION generer_certificat()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'complete' AND OLD.statut != 'complete' THEN
    INSERT INTO certificats (
      employe_id,
      formation_id,
      date_emission,
      date_expiration,
      statut
    ) VALUES (
      NEW.employe_id,
      NEW.formation_id,
      NOW(),
      NOW() + INTERVAL '1 year',  -- ou selon la formation
      'valide'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generer_certificat
AFTER UPDATE ON progressions
FOR EACH ROW EXECUTE FUNCTION generer_certificat();
```

### 2.4 Expiration des certificats

```sql
-- Trigger de mise à jour du statut des certificats expirés
CREATE OR REPLACE FUNCTION verifier_expiration_certificats()
RETURNS void AS $$
BEGIN
  UPDATE certificats
  SET statut = 'expire'
  WHERE date_expiration < NOW()
  AND statut = 'valide';
END;
$$ LANGUAGE plpgsql;

-- Peut être exécuté via un cron job Supabase (pg_cron)
SELECT cron.schedule(
  'verifier-expirations',
  '0 0 * * *',  -- chaque nuit à minuit
  $$ SELECT verifier_expiration_certificats(); $$
);
```

---

## 3. Workflow soumission de preuve

### 3.1 Soumettre une preuve externe

```
Employé
  │
  ├─► Page /dashboard/preuves/nouvelle
  │     • Sélectionne le type de formation
  │     • Téléverse le document (PDF, image)
  │     • Saisit date et organisme de formation
  │
  ├─► POST /api/preuves/submit
  │     • Stocke le fichier dans Supabase Storage
  │     • Crée une entrée dans preuves
  │     • Notifie les admins
  │
  ├─► Admin reçoit la notification
  │     • Ouvre /admin/preuves
  │     • Visualise le document
  │
  └─► Admin approuve ou refuse
        • Si approuvé → statut = 'approuve'
        • Si refusé  → statut = 'refuse' + motif
        • Employé voit le résultat sur son dashboard
```

---

## 4. Workflows administrateur

### 4.1 Gestion des employés

```
Admin/SuperAdmin → /admin/employes

Créer un employé :
  1. Clic "Ajouter un employé"
  2. Formulaire : nom, prénom, email, poste, département, rôle
  3. POST /api/admin/employes → INSERT INTO employes
  4. Invitation email envoyée par Supabase Auth

Modifier un employé :
  1. Clic "Modifier" sur la ligne
  2. Formulaire pré-rempli
  3. PUT /api/admin/employes/[id] → UPDATE employes

Désactiver un employé :
  1. Clic "Désactiver"
  2. Confirmation
  3. PATCH /api/admin/employes/[id] → UPDATE employes SET actif = false
  4. Session Supabase révoquée
```

### 4.2 Génération de rapports

```
Admin → /admin/rapports

Types de rapports disponibles :
  • Taux de complétion par formation
  • Formations en retard (date_limite dépassée)
  • Certificats valides / expirés par département
  • Historique des connexions (audit_logs)

Workflow :
  1. Admin sélectionne le type de rapport
  2. Filtre par période, département, formation
  3. GET /api/admin/rapports?type=...&filters=...
  4. Résultats affichés en tableau
  5. Export CSV optionnel
```

### 4.3 Workflow de déconnexion

```
Utilisateur
  │
  ├─► Clic sur "Déconnexion"
  │
  ├─► POST /api/auth/logout
  │     • supabase.auth.signOut()
  │     • Cookie session supprimé
  │
  └─► Redirect vers /login
```

---

## 5. Workflow d'activation du MFA (utilisateur)

```
Employé → /dashboard/securite

Activer le MFA :
  1. Clic "Activer la double authentification"
  2. Appel supabase.auth.mfa.enroll({ factorType: 'totp' })
  3. QR code affiché + code secret manuel
  4. Utilisateur scanne avec son app (Google Authenticator, Authy...)
  5. Saisit le code TOTP pour confirmer
  6. Appel mfa.challenge() puis mfa.verify()
  7. Si succès → MFA actif, confirmation affichée

Désactiver le MFA :
  1. Clic "Désactiver"
  2. Confirmation requise
  3. Appel supabase.auth.mfa.unenroll({ factorId })
  4. MFA désactivé immédiatement
```

---

## 6. Résumé des transitions d'état

### Formation / Progression

```
non_commence → en_cours → complete
                         → en_retard (si date_limite dépassée)
```

### Certificat

```
(généré automatiquement) → valide → expire
                                  → revoque (action admin)
```

### Preuve externe

```
soumise → en_attente → approuve
                     → refuse
```
