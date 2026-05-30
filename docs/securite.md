# Securite — WS Formation

Mise a jour : 2026-05-30

---

## 1. Authentification

### 1.1 Supabase Auth (JWT)

WS Formation utilise **Supabase Auth** pour toute la gestion des sessions.

- Authentification par email + mot de passe
- JWT signé par Supabase, stocké dans un cookie `httpOnly` (géré par le SDK)
- Durée de session : 1 heure (access token), 7 jours (refresh token)
- Le serveur valide chaque requête via `supabase.auth.getSession()` ou `supabase.auth.getUser()`

### 1.2 Flux de connexion

```
1. Utilisateur soumet email + mot de passe
2. POST /api/auth/login
   → supabase.auth.signInWithPassword()
   → Si succès : vérifier si MFA activé
     a. MFA inactif : redirect vers /dashboard
     b. MFA actif   : redirect vers /mfa-verify
3. Page /mfa-verify
   → Utilisateur saisit code TOTP (6 chiffres)
   → supabase.auth.mfa.challengeAndVerify()
   → Si succès : redirect vers /dashboard
```

### 1.3 Déconnexion

```typescript
// src/app/api/auth/logout/route.ts
await supabase.auth.signOut();
// Détruit la session côté serveur + invalide le cookie
```

---

## 2. Double Authentification (MFA TOTP)

### 2.1 Configuration Supabase

Dans le dashboard Supabase → Authentication → MFA :
- **TOTP (App Authenticator)** : Activé
- **SMS** : Désactivé
- MFA est **optionnel** pour les utilisateurs

### 2.2 Activer le MFA (côté utilisateur)

```typescript
// src/app/dashboard/securite/page.tsx

// Étape 1 — Créer le facteur TOTP
const { data, error } = await supabase.auth.mfa.enroll({
  factorType: 'totp',
  friendlyName: 'Application Authenticator'
});
// data.totp.qr_code → afficher le QR code
// data.totp.secret  → afficher le code manuel

// Étape 2 — Vérifier le code
const { data: challengeData } = await supabase.auth.mfa.challenge({
  factorId: data.id
});
await supabase.auth.mfa.verify({
  factorId: data.id,
  challengeId: challengeData.id,
  code: userInputCode
});
```

### 2.3 Vérification post-connexion

```typescript
// src/app/mfa-verify/page.tsx
const factors = await supabase.auth.mfa.listFactors();
const totpFactor = factors.data?.totp[0];

const { data: challengeData } = await supabase.auth.mfa.challenge({
  factorId: totpFactor.id
});
await supabase.auth.mfa.verify({
  factorId: totpFactor.id,
  challengeId: challengeData.id,
  code: codeEntreParUtilisateur
});
```

### 2.4 Désactiver le MFA

```typescript
await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
```

---

## 3. Row Level Security (RLS)

Toutes les tables Supabase ont le RLS activé. Les politiques utilisent `auth.uid()` pour identifier l'utilisateur connecté.

### 3.1 Table `employes`

```sql
-- Un employé peut voir uniquement son propre profil
CREATE POLICY "employe_voir_son_profil"
ON employes FOR SELECT
USING (auth_user_id = auth.uid());

-- Un admin peut tout voir
CREATE POLICY "admin_voir_tous_employes"
ON employes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM employes
    WHERE auth_user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);
```

### 3.2 Table `progressions`

```sql
-- Un employé voit uniquement ses propres progressions
CREATE POLICY "employe_voir_progressions"
ON progressions FOR SELECT
USING (employe_id = (
  SELECT id FROM employes WHERE auth_user_id = auth.uid()
));

-- Un employé peut créer/modifier ses propres progressions
CREATE POLICY "employe_modifier_progressions"
ON progressions FOR INSERT
WITH CHECK (employe_id = (
  SELECT id FROM employes WHERE auth_user_id = auth.uid()
));
```

### 3.3 Table `certificats`

```sql
-- Un employé voit ses propres certificats
CREATE POLICY "employe_voir_certificats"
ON certificats FOR SELECT
USING (employe_id = (
  SELECT id FROM employes WHERE auth_user_id = auth.uid()
));
```

### 3.4 Table `audit_logs`

```sql
-- Seuls les admins peuvent lire les logs d'audit
CREATE POLICY "admin_lire_audit"
ON audit_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM employes
    WHERE auth_user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);

-- Les logs sont insérés par des triggers (pas par les utilisateurs directement)
CREATE POLICY "trigger_inserer_audit"
ON audit_logs FOR INSERT
WITH CHECK (true); -- restreint par les triggers côté serveur
```

---

## 4. Variables d'environnement sensibles

```env
# .env.local (JAMAIS commité dans Git)

# Supabase — publiques (safe côté client)
NEXT_PUBLIC_SUPABASE_URL=https://vtuegggoruiowjxoiocd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Supabase — serveur uniquement (JAMAIS exposé côté client)
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Next.js
NEXTAUTH_SECRET=...
```

**Règles :**
- `NEXT_PUBLIC_*` : accessible côté navigateur, utilisé pour les opérations publiques
- `SUPABASE_SERVICE_ROLE_KEY` : utilisé UNIQUEMENT dans les API routes serveur, jamais dans les composants client
- `.env.local` est dans `.gitignore` — ne jamais commit ce fichier
- Sur Vercel : variables définies dans le dashboard Vercel → Settings → Environment Variables

---

## 5. Protection des routes

### 5.1 Middleware Next.js

```typescript
// src/middleware.ts
export async function middleware(request: NextRequest) {
  const supabase = createMiddlewareClient({ req: request, res: response });
  const { data: { session } } = await supabase.auth.getSession();

  // Routes protégées : /dashboard/*
  if (!session && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Routes admin : /admin/*
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const employe = await getEmploye(session.user.id);
    if (!employe || employe.role === 'employe') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }
}
```

### 5.2 Routes protégées

| Route | Protection |
|-------|-----------|
| /dashboard/* | Session active requise |
| /admin/* | Session + rôle admin/super_admin |
| /mfa-verify | Session partielle (en cours de connexion MFA) |
| /login, /register | Redirection si déjà connecté |

---

## 6. Conformité Loi 25 (Québec) / RGPD

### 6.1 Données personnelles collectées

| Donnée | Table | Justification |
|--------|-------|---------------|
| Prénom, nom | employes | Identification utilisateur |
| Email | employes | Authentification |
| Poste, département | employes | Gestion des formations |
| Progression | progressions | Suivi formation obligatoire |
| Certificats | certificats | Preuve de conformité |

### 6.2 Mesures de protection

- **Chiffrement en transit** : HTTPS/TLS obligatoire (Vercel + Supabase)
- **Chiffrement au repos** : Base de données Supabase chiffrée (AES-256)
- **Accès minimal** : RLS limite chaque utilisateur à ses propres données
- **Journalisation** : Table `audit_logs` pour traçabilité des actions sensibles
- **MFA disponible** : Double authentification optionnelle pour tous les utilisateurs
- **Retention** : Données conservées le temps de la relation d'emploi + [définir durée]

### 6.3 Droits des utilisateurs

| Droit | Implémentation |
|-------|---------------|
| Accès | Page profil — voir ses propres données |
| Rectification | Admin peut modifier le profil employé |
| Effacement | Super admin peut désactiver/supprimer un compte |
| Portabilité | Export CSV des formations/certificats (à implémenter) |

### 6.4 Audit Trail

Toute action sensible est enregistrée dans `audit_logs` :

```sql
INSERT INTO audit_logs (employe_id, action, table_cible, details)
VALUES (
  uuid_employe,
  'COMPLETION_FORMATION',
  'progressions',
  '{"formation_id": "...", "score": 95}'
);
```

---

## 7. Checklist sécurité

- [x] HTTPS activé (Vercel)
- [x] RLS activé sur toutes les tables
- [x] Variables sensibles hors du code source
- [x] MFA TOTP disponible
- [x] Logs d'audit en place
- [x] Middleware de protection des routes
- [x] Service role key utilisée uniquement côté serveur
- [ ] Rotation régulière des clés API (à planifier)
- [ ] Test de pénétration (à planifier)
- [ ] Politique de mots de passe complexes (à configurer dans Supabase)
