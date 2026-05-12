
# Plan de mise en service — COSLxBloobiz

Document opérationnel : tout ce qu'il faut paramétrer, dans l'ordre, pour qu'une instance vierge soit fonctionnelle en production. À cocher étape par étape.

---

## 1. Pré-requis serveur

| Composant | Version min. | Usage |
|---|---|---|
| Node.js | 20 LTS | Build + Express runtime |
| npm ou bun | npm 10 / bun 1.1 | Install |
| PostgreSQL | 15+ | Base Supabase |
| Supabase self-hosted | dernière stable | Auth + DB + Storage |
| Reverse proxy | nginx ou Caddy | TLS + WAF devant Express |
| Domaine + certificat | Let's Encrypt | HTTPS obligatoire (Supabase exige HTTPS pour cookies sécurisés) |

---

## 2. Provisionner Supabase self-hosted

1. Déployer Supabase (docker-compose officiel ou Coolify/Dokploy).
2. Récupérer dans le dashboard Supabase → **Project Settings → API** :
   - `Project URL` (ex. `https://supabase.cosl.lu`)
   - `anon public key` (clé publique)
   - `service_role key` (clé privée — **ne jamais committer**)
3. Vérifier que **Auth → Email auth** est activé, **désactiver "Enable email confirmations"** (l'app utilise des emails synthétiques `${username}@coslbloobiz.local` qui ne sont pas livrables).
4. Vérifier que **Auth → Settings → Site URL** pointe vers le domaine final (ex. `https://app.cosl.lu`).
5. Optionnel : activer **HIBP password check** (Auth → Providers → Email).

---

## 3. Appliquer le schéma SQL

Dans cet ordre, depuis le serveur Postgres ou via `psql` distant :

```bash
psql "$DATABASE_URL" -f supabase/sql/01_init.sql
psql "$DATABASE_URL" -f supabase/sql/02_storage.sql
```

`01_init.sql` crée :
- 13 enums métier
- 24 tables (référentiels, athlètes, games, accréditations, logistique, communication)
- triggers `handle_new_user` + `set_athletes_updated_at`
- RPC `athlete_kyc_valid`, `accreditation_completeness`, `quota_filled`
- RLS activé sur toutes les tables avec policy "authenticated = full access"

`02_storage.sql` crée le bucket privé `accreditation-docs` + policies.

> ⚠️ **À corriger avant prod** (cf. audit précédent) : les RLS sont permissives. Réécrire les policies par rôle (admin/games_manager/fed_manager/logistics/communication/reader) avant ouverture multi-utilisateurs.

---

## 4. Seed de données initiales

Aucun seed n'est fourni. À insérer manuellement via SQL ou via l'UI une fois le 1er admin créé :

1. **Sports** (athlétisme, natation, judo, …) — table `sports`
2. **Disciplines** rattachées à chaque sport — table `disciplines`
3. **Fédérations luxembourgeoises** (FLA, FLNS, FLAM, …) — table `federations`
4. **Clubs** principaux — table `clubs`

Sans sports/fédérations, les formulaires athlètes/games seront bloqués (FK vides).

---

## 5. Créer le premier utilisateur admin

⚠️ La fonction `auth.admin_create_user(jsonb)` **n'existe pas** dans Supabase self-hosted (c'est une API REST, pas une fonction SQL). Trois méthodes possibles, par ordre de préférence :

### Méthode A — Dashboard Supabase (recommandée)

1. Supabase Studio → **Authentication → Users → Add user → Create new user**
2. Email : `admin@coslbloobiz.local`
3. Password : un mot de passe fort
4. Cocher **Auto Confirm User**
5. Créer.

Puis compléter le profil applicatif (le trigger `handle_new_user` lit `raw_user_meta_data` qui est vide via cette UI, donc il faut soit relancer le trigger, soit insérer manuellement) :

```sql
-- Récupérer l'UUID créé
SELECT id, email FROM auth.users WHERE email = 'admin@coslbloobiz.local';

-- Insérer le profil applicatif
INSERT INTO public.user_profiles (id, username, full_name, email, role)
VALUES (
  '<UUID_COPIE_CI_DESSUS>',
  'admin',
  'Administrateur COSL',
  'admin@coslbloobiz.local',
  'admin'
);
```

### Méthode B — API REST Auth Admin (script ou curl)

Avec la `SERVICE_ROLE_KEY` (jamais committée) :

```bash
curl -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@coslbloobiz.local",
    "password": "CHANGEZ_MOI_FORT",
    "email_confirm": true,
    "user_metadata": {
      "username": "admin",
      "full_name": "Administrateur COSL",
      "role": "admin"
    }
  }'
```

Avec cette méthode, `user_metadata` est rempli → le trigger `handle_new_user` crée automatiquement la ligne `user_profiles` avec rôle `admin`. Aucune insertion manuelle nécessaire.

### Méthode C — Insertion SQL directe (avancé, à éviter sauf si A/B impossibles)

```sql
-- 1) Créer l'utilisateur dans auth.users (mot de passe haché par Supabase)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated', 'authenticated',
  'admin@coslbloobiz.local',
  crypt('CHANGEZ_MOI_FORT', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"admin","full_name":"Administrateur COSL","role":"admin"}'::jsonb,
  now(), now(), '', '', '', ''
);
```

Le trigger `handle_new_user` se déclenche et crée la ligne `user_profiles`. Nécessite l'extension `pgcrypto` (`CREATE EXTENSION IF NOT EXISTS pgcrypto;`).

### Connexion

Une fois le compte créé, login via `/login` avec **username = `admin`** + mot de passe défini.

---

## 6. Variables d'environnement

Créer `.env` à la racine du projet **avant** le build :

```env
# Côté client (injecté dans le bundle)
VITE_SUPABASE_URL=https://supabase.cosl.lu
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> Le `service_role` key n'est utilisé nulle part dans le code actuel et ne doit JAMAIS être ajoutée à un `VITE_*`. Elle sera nécessaire uniquement quand on implémentera la suppression hard d'utilisateurs (route serveur dédiée — non en place).

---

## 7. Build de production

```bash
npm install              # ou bun install
npm run build:prod       # → dist/client/ (SPA pure, ssr: false)
```

Vérifier que `dist/client/index.html` (ou `_shell.html`) existe.

---

## 8. Lancer le serveur Express

```bash
PORT=3000 HOST=0.0.0.0 npm run start:prod
```

À production, encadrer avec un superviseur :
- **systemd** (recommandé) — créer `/etc/systemd/system/cosl-bloobiz.service`
- ou **PM2** — `pm2 start "npm run start:prod" --name cosl`

---

## 9. Reverse proxy + TLS

Exemple nginx minimal :

```nginx
server {
  listen 443 ssl http2;
  server_name app.cosl.lu;
  ssl_certificate     /etc/letsencrypt/live/app.cosl.lu/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/app.cosl.lu/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

Renouvellement Let's Encrypt via `certbot --nginx`.

---

## 10. CORS Supabase

Dans Supabase → **API → CORS** : ajouter `https://app.cosl.lu` dans les origins autorisées.

---

## 11. Storage : taille fichiers et types

Dans Supabase → Storage → bucket `accreditation-docs` → **Edit** :
- File size limit : 10 MB recommandé
- Allowed MIME types : `application/pdf, image/jpeg, image/png`

---

## 12. Sauvegardes

1. **Postgres** : `pg_dump` quotidien chiffré (cron + offsite, ex. S3 + GPG).
2. **Storage** : sync `accreditation-docs` avec `rclone` ou snapshot du volume Docker.
3. Tester la restauration au moins une fois.

---

## 13. Monitoring minimal

- Healthcheck HTTP : `GET https://app.cosl.lu/login` → 200
- Logs Express → journald (via systemd) ou fichier rotaté
- Alertes Supabase (CPU/disque) via dashboard

---

## 14. Checklist avant ouverture aux utilisateurs

- [ ] Schéma SQL appliqué (01 + 02)
- [ ] Seeds sports / disciplines / fédérations / clubs insérés
- [ ] Compte admin créé et testé
- [ ] `.env` rempli avec URL + anon key prod
- [ ] Build prod OK (`dist/client/` présent)
- [ ] Express tourne sous systemd/PM2
- [ ] Domaine HTTPS opérationnel + CORS Supabase configuré
- [ ] Bucket `accreditation-docs` privé avec policies appliquées
- [ ] Backup Postgres + Storage planifié
- [ ] **(P0 sécurité)** RLS reécrites par rôle avant accès multi-utilisateurs
- [ ] **(P1)** Validation Zod étendue à tous les formulaires
- [ ] **(P1)** `updated_at` ajouté à toutes les tables
- [ ] **(P2)** Tri colonnes ajouté sur les tableaux

---

## 15. Tests fonctionnels minimum

Une fois tout en place, dérouler :

1. Login avec admin → dashboard chargé.
2. Créer une fédération → un club → un sport → une discipline.
3. Créer un athlète complet, valider Zod, vérifier KYC.
4. Créer un Games, ajouter sport + quota.
5. Sélectionner un athlète → vérifier que la promotion vers `selected` appelle `athlete_kyc_valid` (toast rouge si KYC invalide).
6. Créer une accréditation, uploader un document, le valider.
7. Créer un plan de voyage, un vol avec passager.
8. Envoyer un message via template.
9. Créer un 2e utilisateur depuis `/admin/users`, se déconnecter, se reconnecter avec ce compte.

---

## 16. Travaux différés (post-mise en service)

D'après l'audit du tour précédent, à planifier en sprint suivant :

| Priorité | Action |
|---|---|
| P0 | Réécrire RLS par rôle (table `user_roles` + fonction `has_role`) |
| P0 | Ajouter `beforeLoad` sur layout `_authenticated/_admin` |
| P0 | Route serveur `/api/admin/users` (création/suppression via service_role) |
| P1 | Schémas Zod pour games, federations, clubs, coaches, accreditations, logistique, communication |
| P1 | Colonne + trigger `updated_at` sur toutes les tables mutables |
| P1 | CHECK SQL : `birth_date`, `passport_expiry`, regex `cosl_id` |
| P2 | Tri par colonne sur toutes les listes |
| P2 | Statuer sur soft-delete coaches / user_profiles |
| P3 | README de déploiement dérivé de ce plan |
