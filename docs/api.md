# API Routes — WS Formation

Mise a jour : 2026-05-30
Base URL : `https://ws-formation.vercel.app`

---

## Conventions

- Toutes les routes sont sous `/api/`
- Format : JSON (`Content-Type: application/json`)
- Authentification : Cookie de session Supabase (httpOnly)
- Codes HTTP : 200 succes, 400 requete invalide, 401 non authentifie, 403 acces refuse, 500 erreur serveur

---

## 1. Authentification

### POST /api/auth/login

Connexion utilisateur. Verifie le MFA si actif.

**Request :**
```json
{
  "email": "employe@exemple.com",
  "password": "motdepasse"
}
```

**Response — succes sans MFA (200) :**
```json
{
  "success": true,
  "redirect": "/dashboard"
}
```

**Response — succes avec MFA (200) :**
```json
{
  "success": true,
  "redirect": "/mfa-verify",
  "factorId": "uuid-du-facteur-totp"
}
```

**Response — echec (401) :**
```json
{
  "error": "Identifiants invalides"
}
```

**Implementation :**
```typescript
// src/app/api/auth/login/route.ts
export async function POST(request: Request) {
  const { email, password } = await request.json();
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email, password
  });
  
  if (error) return Response.json({ error: 'Identifiants invalides' }, { status: 401 });
  
  // Verifier si MFA actif
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totpFactor = factors?.totp?.find(f => f.status === 'verified');
  
  if (totpFactor) {
    return Response.json({ success: true, redirect: '/mfa-verify', factorId: totpFactor.id });
  }
  
  return Response.json({ success: true, redirect: '/dashboard' });
}
```

---

### POST /api/auth/logout

Deconnecte l'utilisateur et invalide la session.

**Request :** Aucun body requis

**Response (200) :**
```json
{ "success": true }
```

**Implementation :**
```typescript
// src/app/api/auth/logout/route.ts
export async function POST() {
  await supabase.auth.signOut();
  return Response.json({ success: true });
}
```

---

## 2. Employes

### GET /api/admin/employes

Liste tous les employes. Requiert role admin ou super_admin.

**Query params :**
- `page` (optionnel) : Numero de page (defaut: 1)
- `limit` (optionnel) : Nombre de resultats (defaut: 20)
- `departement` (optionnel) : Filtrer par departement
- `actif` (optionnel) : true/false

**Response (200) :**
```json
{
  "employes": [
    {
      "id": "uuid",
      "prenom": "Alice",
      "nom": "Martin",
      "email": "alice@exemple.com",
      "poste": "Conseillere",
      "departement": "Ventes",
      "role": "employe",
      "actif": true
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

---

### POST /api/admin/employes

Cree un nouvel employe. Requiert role admin ou super_admin.

**Request :**
```json
{
  "prenom": "Alice",
  "nom": "Martin",
  "email": "alice@exemple.com",
  "poste": "Conseillere",
  "departement": "Ventes",
  "role": "employe"
}
```

**Response (201) :**
```json
{
  "success": true,
  "employe": { "id": "uuid", ...donnees }
}
```

---

### PATCH /api/admin/employes/[id]

Modifie un employe existant.

**Request :**
```json
{
  "poste": "Chef d'equipe",
  "actif": false
}
```

**Response (200) :**
```json
{ "success": true, "employe": { ...donnees mises a jour } }
```

---

## 3. Formations

### GET /api/formations

Liste les formations. Pour un employe : uniquement ses formations assignees.
Pour un admin : toutes les formations.

**Response (200) :**
```json
{
  "formations": [
    {
      "id": "uuid",
      "titre": "Securite informatique",
      "description": "Formation annuelle obligatoire",
      "duree_heures": 3,
      "actif": true
    }
  ]
}
```

---

### GET /api/formations/[id]/lecons

Liste les lecons d'une formation.

**Response (200) :**
```json
{
  "lecons": [
    {
      "id": "uuid",
      "titre": "Introduction",
      "ordre": 1,
      "type": "video",
      "duree_minutes": 15,
      "complete": false
    }
  ],
  "progression": {
    "statut": "en_cours",
    "pourcentage": 33
  }
}
```

---

### POST /api/progressions/update

Met a jour la progression d'un employe sur une lecon.

**Request :**
```json
{
  "formation_id": "uuid",
  "lecon_id": "uuid",
  "complete": true
}
```

**Response (200) :**
```json
{
  "success": true,
  "progression": {
    "pourcentage": 66,
    "statut": "en_cours"
  }
}
```

---

## 4. Certificats

### GET /api/certificats

Liste les certificats. Pour un employe : ses certificats.
Pour un admin : tous les certificats.

**Query params :**
- `statut` : valide | expire | revoque

**Response (200) :**
```json
{
  "certificats": [
    {
      "id": "uuid",
      "formation_titre": "Securite informatique",
      "date_emission": "2026-01-15",
      "date_expiration": "2027-01-15",
      "statut": "valide",
      "employe": {
        "prenom": "Alice",
        "nom": "Martin"
      }
    }
  ]
}
```

---

## 5. Rapports

### GET /api/admin/rapports

Genere un rapport. Requiert role admin ou super_admin.

**Query params :**
- `type` : completion | retard | certificats | audit
- `debut` : date ISO (YYYY-MM-DD)
- `fin` : date ISO
- `departement` (optionnel)

**Response (200) — type=completion :**
```json
{
  "rapport": {
    "type": "completion",
    "periode": { "debut": "2026-01-01", "fin": "2026-05-30" },
    "formations": [
      {
        "titre": "Securite informatique",
        "total_assignees": 45,
        "completees": 38,
        "taux": 84.4
      }
    ]
  }
}
```

---

## 6. Codes d'erreur

| Code | Signification | Exemple |
|------|--------------|---------|
| 400 | Requete invalide | Champ manquant ou invalide |
| 401 | Non authentifie | Session expiree |
| 403 | Acces refuse | Employe sur une route admin |
| 404 | Ressource introuvable | Formation ou employe inexistant |
| 409 | Conflit | Email deja utilise |
| 500 | Erreur serveur | Erreur Supabase |

---

## 7. Variables d'environnement requises (serveur)

```env
NEXT_PUBLIC_SUPABASE_URL=https://vtuegggoruiowjxoiocd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Voir `docs/securite.md` pour les details de securite des variables d'environnement.
