
# Audit COSLxBloobiz — rapport priorisé

Aucune modification effectuée. Statuts : ✅ conforme · ⚠️ partiel · ❌ non conforme.

## 🟢 Conformes (8/14)

**1. ✅ `ssr: false` & shell SPA** — `vite.config.prod.ts` configure bien `build.ssr=false`, `outDir=dist/client`. (`vite.config.ts` reste sur la config SSR Lovable mais n'est pas utilisée pour le build prod.)

**2. ✅ `server/node-server.mjs`** — fallback explicite sur `["index.html", "_shell.html"]` via `find(fs.existsSync)`, syntaxe Express 5 `app.get("/{*path}", …)` correcte, exit 1 si shell absent, cache long pour `/assets/`, no-cache pour le shell.

**3. ✅ `src/lib/supabase.ts`** — aucun fallback placeholder. Erreur console claire si les `VITE_SUPABASE_*` manquent, `createClient(url ?? "", anonKey ?? "")` ne masque rien.

**4. ✅ SERVICE_ROLE_KEY jamais côté client** — `rg SERVICE_ROLE src` ne renvoie qu'un commentaire dans `admin/users.tsx`. Aucun import, aucun usage. (Conséquence : la suppression réelle d'`auth.users` n'est pas implémentée — voir point 12.)

**5. ✅ `useAuth` ordre des appels** — `onAuthStateChange` est bien souscrit AVANT `getSession()` (lignes 67-87), avec `setTimeout(…, 0)` pour différer le fetch de profil et éviter le deadlock auth Supabase. Conforme aux bonnes pratiques.

**6. ✅ Routes protégées** — toutes les routes applicatives sont sous `src/routes/_authenticated/` qui monte `<ProtectedRoute>` via `_authenticated.tsx`. Login et `__root` sont les seules routes publiques.

**8. ✅ RPC `athlete_kyc_valid()`** — appelé dans `selections.tsx` (l. 173) AVANT la transition vers `status='selected'`. Bloque la promotion si `data === false`. Implémentation cohérente avec le CDC.

**14. ✅ Triggers `handle_new_user`** — défini l. 471, attaché à `auth.users` AFTER INSERT. Crée le `user_profiles` avec rôle issu de `raw_user_meta_data`. Conforme.

---

## 🟠 Partiels (3/14)

**7. ⚠️ Validation Zod incomplète** — `athleteSchema` existe et est utilisé dans `athletes/index.tsx` + `athletes/$id.tsx` via `safeParse`. **Mais aucun autre formulaire** (games, federations, clubs, coaches, selections, accreditations, travel_plans, flights, accommodations, transports, message_templates, notifications, admin/users) n'a de schéma Zod. Validation purement HTML/`required` côté client. Risque : insertion de données incohérentes que la DB ne rattrape pas (ex. emails sans format, longueurs non bornées).

**11. ⚠️ Tableaux : tri manquant** — `PagerBar`, `EmptyState`, `TableSkeleton`, recherche et filtres sont en place sur quasiment toutes les listes (athletes, games, coaches, clubs, federations, accreditations, logistics, notifications, admin/users). **Mais aucun tri de colonne (clic header asc/desc)** n'est implémenté. Les listes sont triées en dur côté serveur (`order("last_name")`, etc.).

**13. ⚠️ Schéma SQL — CHECK partiels** — Cohérent globalement (FK, UNIQUE, ENUMs riches, index). 9 contraintes CHECK présentes (dates, quotas, polymorphisme accréditations/passagers/rooming). **Manques notables** :
- Pas de CHECK sur `birth_date < now()` ni `passport_expiry > now()` sur `athletes`.
- Pas de CHECK sur `quota_max >= quota_used` (la valeur courante est calculée via RPC).
- `email`, `phone` sans validation format en DB.
- `cosl_id` sans regex (TEXT libre).

---

## 🔴 Non conformes (3/14)

**9. ❌ Routes `/admin/*` — protection client uniquement** — `admin/users.tsx` vérifie `role === 'admin'` côté composant (`isAdmin`) et affiche un message si refus, **mais la route reste accessible** (montée + données fetchées) avant le check. Pas de garde `beforeLoad` au niveau routeur, pas de layout `_authenticated/_admin.tsx` pour bloquer toute la sous-arborescence. Côté DB, RLS = "tout authentifié peut tout faire" (voir point critique ci-dessous), donc rien n'empêche un `reader` de muter `user_profiles` via la console. **Risque de privilege escalation.**

**10. ❌ Types `any` (générés)** — `rg ': any|as any' src` hors `routeTree.gen.ts` = 0 occurrence. ✅ côté code écrit. **Mais** `routeTree.gen.ts` contient 25 `as any` (généré par TanStack Router, attendu et non modifiable manuellement). À documenter comme exception acceptée.

**12. ❌ Soft-delete athletes — incohérent** — `athletes/$id.tsx` fait bien `update({ is_active: false })` (l. 311) ✅. **Mais** `athlete_relations` (l. 418) et `athlete_documents` (l. 361) sont supprimés en dur. Plus grave : 16 autres tables utilisent `.delete()` direct (games, clubs, federations, coaches, game_sports, game_quotas, delegation_members, accreditation_types, travel_plans, flights, flight_passengers, lodging, transports, message_templates, user_profiles, …). Le CDC v3.1 demande soft-delete uniquement sur `athletes` — donc conforme à la lettre du CDC, mais à confirmer pour `coaches` et `user_profiles` (cascades dangereuses).

---

## 🚨 Trouvailles hors-checklist (critiques)

**A. RLS trop permissif** — `01_init.sql` l. 578-588 : boucle `DO $$ … FOR ALL TO authenticated USING (true) WITH CHECK (true)` sur **toutes** les tables. Tout utilisateur authentifié peut lire/écrire/supprimer n'importe quelle ligne (athletes, user_profiles, accreditations, etc.) directement via l'API REST Supabase. Le contrôle de rôle est uniquement frontend. **Risque maximal** pour un déploiement multi-utilisateurs avec rôles `reader`, `fed_manager`, etc.

**B. Trigger `set_updated_at` orphelin** — La fonction existe et est solide, mais une **seule colonne `updated_at` existe dans tout le schéma** (table `athletes` uniquement) et un seul trigger l'utilise. Toutes les autres tables n'ont pas de `updated_at` → impossible de tracer les modifications (audit, sync, cache). Incohérent avec point 14 du CDC.

**C. Suppression utilisateur incomplète** — `admin/users.tsx` supprime le `user_profiles` mais pas l'entrée `auth.users` (commenté l. 123 : nécessite SERVICE_ROLE_KEY). L'utilisateur peut continuer à se connecter mais perd son profil → état zombie. Nécessite une route serveur `/api/admin/users` (avec vérif rôle) appelant `supabaseAdmin.auth.admin.deleteUser`.

**D. Pas de garde rôle sur opérations sensibles** — Création de Games, désactivation d'athlètes, validation d'accréditations, envoi de messages : aucune vérification `role` côté client OU serveur. Conjugué à (A), n'importe quel `reader` peut tout faire.

---

## Plan de correction recommandé (par priorité)

### P0 — Sécurité (à faire avant prod)
1. Réécrire les RLS policies par table avec `has_role()` (function `SECURITY DEFINER` + table `user_roles` séparée comme préconisé) — au minimum :
   - `user_profiles` : SELECT pour tous, INSERT/UPDATE/DELETE admin uniquement.
   - `athletes`, `selections`, `accreditations` : écriture limitée à `admin`/`games_manager`/`fed_manager` selon contexte.
   - Tables logistique : écriture `admin`/`logistics`.
2. Ajouter `beforeLoad` dans un layout `_authenticated/_admin.tsx` qui redirige vers `/dashboard` si `role !== 'admin'`.
3. Créer une route serveur `/api/admin/users` (POST création, DELETE suppression) qui utilise `supabaseAdmin` + vérifie le rôle de l'appelant via JWT.

### P1 — Intégrité données
4. Étendre Zod à tous les formulaires (générer un schéma par entité dans `src/lib/types.ts`).
5. Ajouter `updated_at` + trigger sur toutes les tables mutables.
6. Ajouter contraintes CHECK manquantes (`birth_date < now()`, `passport_expiry > now()`, regex `cosl_id`).

### P2 — UX
7. Ajouter tri par colonne sur les listes (header cliquable, état local `sortBy`/`sortDir`, passer dans `.order()` Supabase).
8. Décider politique soft-delete : appliquer aussi à `coaches` et `user_profiles` (ajouter colonne `is_active`) ou conserver hard-delete documenté.

### P3 — Cosmétique
9. Documenter dans le README que les `as any` de `routeTree.gen.ts` sont attendus (généré par TanStack).
