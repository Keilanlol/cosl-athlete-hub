# Audit des référentiels — cosl-athlete-hub

> **Phase 0 — État des lieux chiffré avant refonte.**
> Document en lecture seule : aucune modification applicative n'a été effectuée à ce stade.

---

## Tableau 1 — Inventaire des vocabulaires

Pour chaque notion métier, on indique où elle est définie (table SQL, groupe `app_type_items`, constante TypeScript, enum Postgres, ou nulle part), qui la lit (écrans/queries) et qui l'écrit (forms/inserts).

| # | Notion | Définition SQL | `app_type_items` | Constante TS | Enum Postgres | Qui la lit | Qui l'écrit |
|---|--------|---------------|-------------------|--------------|---------------|-----------|-------------|
| 1 | **Type de document** | `document_types` (table dédiée, migr. 06) — colonnes `code, label, category, sort_order` | Groupe `document_types` (migr. 37+43) — 10 items seeded | — | — | `useDocumentTypes()` (`useReferenceData.ts`) → `persons/$personId.tsx` (formulaire document) ; `conformity-utils.ts` (`fetchDocTypeLabels` — *lit les deux*) ; `accreditations.tsx` (`onUpload` lit `document_types.category`) ; `accreditations/$gameId.tsx` (lit `app_type_items` groupe `document_types`) | `persons/$personId.tsx` (`addDocType` écrit dans `document_types` avec slug préfixé par catégorie) ; admin `types-roles.tsx` écrit dans `app_type_items` groupe `document_types` |
| 2 | **Rôle d'encadrant** | — | Groupe `coach_roles` (migr. 37+39) — 9 items après migr. 39 | `COACH_ROLES` (`types.ts`) — 9 entrées **désynchronisées** de `app_type_items` (codes `mechanic`, `medical`, `press` n'existent plus ; codes `press_v2`, `physio_v2`, `team_manager`, `judge`, `other` absents) | — | `role-labels.ts` (`coachRoleLabel`) utilisé par `delegation.tsx`, `persons/$personId.tsx` ; `accreditations.tsx` (`load()` lit `coach_profiles.role` et l'utilise comme `role_code` pour `accreditation_requirements`) | `persons/$personId.tsx` (Ajouter rôle coach via `AddRoleDialog`) ; CSV import `coachesImportConfig` ; `coaches` table `role` |
| 3 | **Rôle de membre de fédération** | — | Groupe `federation_member_roles` (migr. 37+39) — 7 items après migr. 39 | `FEDERATION_MEMBER_ROLES` (`types.ts`) — 7 entrées **désynchronisées** (`board_member` → renommé `member_ca` en base, mais la constante TS liste `member_ca` correctement ; `delegate` supprimé en base mais absent de la constante ; `staff` présent en base, absent de la constante TS) | — | `role-labels.ts` (`federationMemberRoleLabel`) → `delegation.tsx`, `persons/$personId.tsx` | `persons/$personId.tsx` (AddRoleDialog) ; CSV import `federationMembersImportConfig` ; `federation_members.role`, `federation_member_profiles.role` |
| 4 | **Catégorie d'accréditation** | — | Groupe `accreditation_categories` (migr. 37+39) — 8 items : `athlete`, `coach`, `official`, `medical` (renommé « Dignitaires »), `press`, `vip` (renommé « Juge »), `president`, `secretary_general` | — | Enum `accreditation_category` (migr. 01) — 6 valeurs (`athlete`, `coach`, `official`, `medical`, `press`, `vip`) | `accreditations/$gameId.tsx` (lit `app_type_items` pour configurer les requirements) ; `accreditations.tsx` (lit pour afficher le libellé du rôle dans le tableau) | `accreditations.tsx` (`load()` écrit `role_code` dans `accreditations` — utilise le vocabulaire `coach_roles` au lieu de `accreditation_categories`) ; `accreditations/$gameId.tsx` (écrit `role_code` dans `accreditation_requirements` avec les codes `accreditation_categories`) |
| 5 | **Statut de document** | — | Groupe `document_statuses` (migr. 37) — 5 items : `missing`, `pending`, `valid`, `expired`, `rejected` | `DOCUMENT_STATUSES` (`types.ts`) — 5 entrées identiques | Enum `document_status` (migr. 01) — mêmes 5 valeurs | `persons/$personId.tsx` (Select de statut document) ; `accreditations.tsx` (drawer, `getDocStatusLabel`) ; `conformity-utils.ts` | `persons/$personId.tsx` (update `person_documents.status`) ; `accreditations.tsx` (`setDocStatus`) |
| 6 | **Statut d'accréditation** | — | Groupe `accreditation_statuses` (migr. 37+39) — 4 items après migr. 39 : `draft`, `submitted`, `validated`, `rejected` (`produced`, `delivered` supprimés) | — | Enum `accreditation_status` (migr. 01) — 6 valeurs (incluant `produced`, `delivered` toujours présents dans l'enum) | `accreditations.tsx` (filtre + tableau + drawer) ; `accreditations.tsx` export CSV | `accreditations.tsx` (`setAccredStatus`) |
| 7 | **Statut de sélection** | — | Groupe `selection_statuses` (migr. 37+39) — 4 items : `pre_selected` (« Long List »), `selected` (« Short List »), `reserve` (« Réserve »), `rejected` (« Refusé ») | — | Enum `selection_status` (migr. 01) — mêmes 4 codes | `accreditations.tsx` (`load()` filtre `status IN ['pre_selected','selected','reserve']`) ; `conformity-utils.ts` (mapping manuel `pre_selected → Long List` etc.) ; `persons/$personId.tsx` (mapping manuel identique) ; `accreditations/$gameId.tsx` (`SELECTION_STAGES` constante locale) | `games/$id/selections.tsx` (écrit `selections.status`) |
| 8 | **Catégorie de document** | — | Groupe `document_categories` (migr. 37) — 4 items : `admin`, `medical`, `sportive`, `contractual` | `DOCUMENT_CATEGORIES` (`types.ts`) — 4 entrées identiques | Enum `document_category` (migr. 01) — mêmes 4 valeurs | `persons/$personId.tsx` (`submitDoc` lit `dt?.category`) ; `accreditations.tsx` (`onUpload` lit `document_types.category`) | `persons/$personId.tsx` (écrit `person_documents.category`) |
| 9 | **Niveau d'athlète** | `athlete_levels_ref` (table dédiée, migr. 06) — 4 entrées | Groupe `athlete_levels` (migr. 37) — 4 items | `ATHLETE_LEVELS` (`types.ts`) — 4 entrées | Enum `athlete_level` (migr. 01) — converti en `text` par migr. 06 | `athletes/$id.tsx` (formulaire athlète) ; `persons/$personId.tsx` (subtitle RoleListItem) | `athletes/$id.tsx` ; CSV import (`athletesImportConfig`) |
| 10 | **Statut d'athlète** | — | Groupe `athlete_statuses` (migr. 37+39) — 5 items | `ATHLETE_STATUSES` (`types.ts`) — 5 entrées avec classes CSS | Enum `athlete_status` (migr. 01) | `athletes/$id.tsx` ; `persons/$personId.tsx` (subtitle RoleListItem affiche `athlete_profile.status` brut) | `athletes/$id.tsx` ; CSV import |
| 11 | **Type de jeux** | — | Groupe `game_types` (migr. 37+39) — 10 items (incl. `world_games`) | `GAME_TYPES` (`types.ts`) — 10 entrées avec classes CSS (incl. `world_games`) | Enum `game_type` (migr. 01) — 9 valeurs (**`world_games` absent de l'enum**) | `games/index.tsx`, `games/$id.tsx` ; CSV import | `games/index.tsx` (création/édition Games) |
| 12 | **Statut de jeux** | — | Groupe `game_statuses` (migr. 37) — 4 items | `GAME_STATUSES` (`types.ts`) — 4 entrées avec classes CSS | Enum `game_status` (migr. 01) | `games/index.tsx` ; `games/$id.tsx` ; CSV import | `games/index.tsx` |
| 13 | **Type de transport** | — | Groupe `transport_types` (migr. 46) — 7 items seedés : `navette`, `bus`, `train`, `taxi`, `voiture`, `minibus`, `autre` | — | — | **Personne.** Le code (`transport.tsx`) utilise un `<Input>` texte libre pour `transport_type` | `transport.tsx` (`form.transport_type` écrit en texte libre dans `local_transports.transport_type`) |
| 14 | **Type d'hébergement** | — | Groupe `accommodation_types` (migr. 46) — 6 items : `hotel`, `residence`, `auberge`, `village`, `appartement`, `autre` | — | — | **Personne.** Le code (`lodging.tsx`) utilise un `<Input>` texte libre pour `type` | `lodging.tsx` (`accForm.type` écrit en texte libre dans `accommodations.type`) |
| 15 | **Type de chambre** | — | **Nulle part** — aucun groupe `room_types` n'existe | — | — | `lodging.tsx` (filtre `filterType` construit la liste depuis `rooms.map(r => r.room_type)` — textes libres) | `lodging.tsx` (`roomForm.room_type` écrit en texte libre dans `rooming_assignments.room_type`) |
| 16 | **Round de compétition** | — | Groupe `competition_rounds` (migr. 46) — 9 items : `finale`, `petite_finale`, `demi_finale`, `quart_finale`, `huitieme_finale`, `qualification`, `series`, `poules`, `autre` | `ROUND_OPTIONS` (`types.ts`) — 9 libellés français en dur (« Finale », « Demi-finale »…). **Non utilisé par `competitions.tsx`** qui utilise `useTypeGroup("competition_rounds")` | — | `competitions.tsx` (Select du round utilise `roundsHook.items`) | `competitions.tsx` (écrit `game_competitions.round`) |
| 17 | **Type de notification** | — | **Nulle part** — aucun groupe `notification_types` n'existe | — | — | `communication/notifications.tsx` (filtre `filterType` construit la liste depuis `notifs.map(n => n.notification_type)` — codes bruts) ; badge affiche `n.notification_type` brut | `conformity-utils.ts` (`createConformityNotification` écrit `notification_type: "selection_documents_required"`) ; `persons/$personId.tsx` (écrit `notification_type: "document_action_required"`) |
| 18 | **Rôle utilisateur** | — | Groupe `user_roles` (migr. 37) — 6 items | `USER_ROLES` (`types.ts`) — 6 entrées avec classes CSS | Enum `user_role` (migr. 01) | `admin/types-roles.tsx` ; `admin/users.tsx` ; `useAuth()` ; guards dans plusieurs routes | `admin/users.tsx` (création/modification utilisateur) |
| 19 | **Rôle personne (super-classe)** | — | Groupe `person_role_types` (migr. 37+39) — 6 items : `athlete`, `coach`, `federation_member`, `official`, `volunteer`, `staff` | `PERSON_ROLE_TYPES` (`persons.ts`) — 6 valeurs en dur ; `ROLE_LABELS` (`persons.ts`) — 6 libellés en dur | — | `persons/$personId.tsx` (gestion des rôles) ; `delegation.tsx` | `persons/$personId.tsx` (AddRoleDialog) |
| 20 | **Statut de voyage** | — | Groupe `travel_statuses` (migr. 37) — 4 items | `TRAVEL_STATUSES` (`types.ts`) — 4 entrées avec classes CSS | Enum `travel_status` (migr. 01) | `games/$id/logistics/flights.tsx` (probable) | `flights.tsx` |
| 21 | **Scope de voyage** | — | **Nulle part** — aucun groupe `travel_scopes` n'existe | `TRAVEL_SCOPES` (`types.ts`) — 3 entrées : `global`, `sport`, `individual` | — | `flights.tsx` (probable) | `flights.tsx` |
| 22 | **Statut KYC** | — | Groupe `kyc_statuses` (migr. 37) — 3 items : `green`, `orange`, `red` | `KycStatusValue` type (`types.ts`) | Enum `kyc_status` (migr. 01) | `kyc-utils.ts` ; `athletes/$id.tsx` (KYC) | `athletes/$id.tsx` |
| 23 | **Genre** | — | **Nulle part** — aucun groupe `genders` n'existe | `GENDERS` (`types.ts`) — 3 entrées | Enum `gender` (migr. 01) | `athletes/$id.tsx`, `competitions.tsx`, CSV import | `athletes/$id.tsx`, `competitions.tsx` |
| 24 | **Médaille** | — | **Nulle part** — aucun groupe `medal_types` n'existe | `MEDAL_LABELS` (`types.ts`) — 3 entrées | — | `competitions.tsx` | `competitions.tsx` (écrit `athlete_results.medal`) |

---

## Tableau 2 — Colonnes de type non contraintes

Toutes les colonnes `text` qui stockent un code de référentiel **sans FK ni CHECK**.

| Table | Colonne | Référentiel attendu | Contrainte actuelle | Risque |
|-------|---------|---------------------|---------------------|--------|
| `person_documents` | `doc_type` | `app_type_items(document_types)` ou `document_types.code` | Aucune (text libre) | Codes orphelins, divergence entre `document_types` et `app_type_items` |
| `person_documents` | `category` | `app_type_items(document_categories)` | Aucune | — |
| `person_documents` | `status` | `app_type_items(document_statuses)` | Aucune (était enum, migr. 01 → le type est resté enum sur `athlete_documents` mais `person_documents` est `text`) | — |
| `accreditation_documents` | `doc_type` | `app_type_items(document_types)` | Aucune | Codes orphelins |
| `accreditation_documents` | `status` | `app_type_items(document_statuses)` | Aucune | — |
| `accreditation_documents` | `file_name` | — | Aucune | Recopie au lieu de référencer `person_documents` |
| `accreditation_documents` | `file_url` | — | Aucune | Recopie au lieu de référencer |
| `accreditation_requirements` | `role_code` | `app_type_items(accreditation_categories)` | Aucune | Le code écrit vient tantôt de `coach_roles`, tantôt de `accreditation_categories` |
| `accreditation_requirements` | `doc_type_code` | `app_type_items(document_types)` | Aucune | Codes orphelins |
| `accreditation_requirements` | `selection_stage` | `app_type_items(selection_statuses)` | Aucune, **nullable** | `NULL` autorisé mais la contrainte UNIQUE ne protège pas le cas `NULL` (voir § doublons) |
| `accreditations` | `role_code` | `app_type_items(accreditation_categories)` | Aucune | **Écrit avec le vocabulaire `coach_roles` au lieu de `accreditation_categories`** — c'est le défaut structurel central |
| `accreditations` | `status` | `app_type_items(accreditation_statuses)` | Type `accreditation_status` (enum) mais l'enum contient encore `produced`, `delivered` supprimés du référentiel | Divergence enum vs référentiel |
| `accreditations` | `full_name` | Dénormalisé depuis `persons` | Aucune | Ne suit pas les renommages |
| `coaches` | `role` | `app_type_items(coach_roles)` | Aucune | Codes orphelins (`official`, `press`, `physio` supprimés par migr. 39) |
| `coach_profiles` | `role` | `app_type_items(coach_roles)` | Aucune | Idem |
| `federation_members` | `role` | `app_type_items(federation_member_roles)` | Aucune | `delegate`, `board_member` supprimés par migr. 39 |
| `federation_member_profiles` | `role` | `app_type_items(federation_member_roles)` | Aucune | Idem |
| `athlete_relations` | `relation_role` | `app_type_items(coach_roles)` | Aucune | Codes orphelins |
| `athlete_profiles` | `status` | `app_type_items(athlete_statuses)` | Aucune | — |
| `athlete_profiles` | `level` | `app_type_items(athlete_levels)` | Aucune | — |
| `athletes` | `status` | `app_type_items(athlete_statuses)` | Type `athlete_status` (enum) | — |
| `athletes` | `level` | `app_type_items(athlete_levels)` | `text` (converti par migr. 06) | — |
| `games` | `game_type` | `app_type_items(game_types)` | Type `game_type` (enum) — **`world_games` absent de l'enum** | Insertion de `world_games` échouerait au niveau BDD |
| `games` | `status` | `app_type_items(game_statuses)` | Type `game_status` (enum) | — |
| `game_competitions` | `round` | `app_type_items(competition_rounds)` | Aucune | Contient un mix de codes (migration 46) et d'anciens libellés français (« Finale », « Demi-finale ») |
| `game_competitions` | `gender` | `app_type_items(genders)` (n'existe pas) | Type `gender` (enum) | — |
| `travel_plans` | `scope` | `app_type_items(travel_scopes)` (n'existe pas) | Aucune | — |
| `travel_plans` | `status` | `app_type_items(travel_statuses)` | Type `travel_status` (enum) | — |
| `accommodations` | `type` | `app_type_items(accommodation_types)` | Aucune | Texte libre |
| `rooming_assignments` | `room_type` | `app_type_items(room_types)` (n'existe pas) | Aucune | Texte libre |
| `local_transports` | `transport_type` | `app_type_items(transport_types)` | Aucune | Texte libre |
| `notifications` | `notification_type` | `app_type_items(notification_types)` (n'existe pas) | Aucune | Codes bruts, pas de référentiel |
| `notifications` | `related_doc_type` | `app_type_items(document_types)` | Aucune | — |
| `user_profiles` | `role` | `app_type_items(user_roles)` | Type `user_role` (enum) | — |
| `person_roles` | `role_type` | `app_type_items(person_role_types)` | Aucune | — |
| `selections` | `status` | `app_type_items(selection_statuses)` | Type `selection_status` (enum) | — |
| `messages_sent` | `channel` | — | Aucune | Pas de référentiel prévu |
| `message_templates` | `channel` | — | Aucune | Pas de référentiel prévu |
| `events` | — | — | — | Pas concerné |
| `person_events` | `role` | `app_type_items(?)` | Aucune | Pas de référentiel défini |

---

## Tableau 3 — Codes affichés bruts dans le JSX

Chaque endroit du code où un `code` technique est rendu directement dans le JSX **sans passer par un résolveur de libellé**.

| Fichier | Ligne / zone | Code affiché brut | Contexte |
|---------|-------------|-------------------|---------|
| `games/$id/accreditations.tsx` | Drawer `<dd>{a.role_code}</dd>` | `role_code` (ex. `physio_v2`, `coach`) | Affiché dans la section « Personne » du drawer au lieu du libellé `accreditation_categories` |
| `games/$id/accreditations.tsx` | Drawer `<dd>{a.status}</dd>` | `status` (ex. `draft`, `submitted`) | Affiché brut au lieu du libellé `accreditation_statuses` |
| `games/$id/delegation.tsx` | `getMemberRoleLabel()` → `if (m.member_role) return m.member_role;` | `member_role` (ex. `press_v2`, `member_ca`, `chief_of_mission`) | **Exporté tel quel dans le CSV « liste officielle »** destiné à l'extérieur |
| `games/$id/competitions.tsx` | Tableau `<TableCell>{c.round ?? "—"}</TableCell>` | `round` (ex. `demi_finale`) | Affiche le code au lieu du libellé « Demi-finale » |
| `games/$id/competitions.tsx` | Dialogue détail `<div>{viewComp.round ?? "—"}</div>` | `round` | Idem dans le dialogue |
| `persons/$personId.tsx` | `RoleListItem` subtitle pour athlète | `bundle.athlete_profile.status` (ex. `active`, `injured`) | Affiché brut au lieu du libellé `athlete_statuses` |
| `persons/$personId.tsx` | `RoleListItem` subtitle pour athlète | `bundle.athlete_profile.level` (ex. `elite`) | Affiché brut au lieu du libellé `athlete_levels` |
| `persons/$personId.tsx` | `RoleListItem` subtitle pour coach | `p.role` (ex. `physio_v2`, `chief_of_mission`) | Affiché brut au lieu du libellé `coach_roles` |
| `persons/$personId.tsx` | `RoleListItem` subtitle pour fed member | `p.role` (ex. `member_ca`, `president`) | Affiché brut au lieu du libellé `federation_member_roles` |
| `communication/notifications.tsx` | `<Badge variant="outline">{n.notification_type}</Badge>` | `notification_type` (ex. `selection_documents_required`) | Badge affiche le code brut |
| `communication/notifications.tsx` | `{n.related_doc_type && <div>📄 {n.related_doc_type}</div>}` | `related_doc_type` | Affiché brut |
| `communication/notifications.tsx` | Filtre type `<SelectItem key={t} value={t}>{t}</SelectItem>` | `notification_type` | Liste de filtres construite depuis les données — codes bruts |
| `conformity-utils.ts` | `createConformityNotification()` | `roleCode` brut inséré dans le message | `Documents requis pour ${gameName} — ${roleCode} — ${stageLabel}...` |
| `games/$id/logistics/transport.tsx` | Tableau `<TableCell>{t.transport_type}</TableCell>` | `transport_type` | Texte libre affiché brut |
| `games/$id/logistics/lodging.tsx` | Tableau `<TableCell>{g.items[0]?.room_type ?? "—"}</TableCell>` | `room_type` | Texte libre affiché brut |
| `games/$id/logistics/lodging.tsx` | Filtre type `<SelectItem key={t} value={t}>{t}</SelectItem>` | `room_type` | Filtre construit depuis les données — inclut les fautes de frappe |
| `games/$id/logistics/lodging.tsx` | Filtre sport `<SelectItem key={s} value={s}>{s.slice(0, 8)}</SelectItem>` | `sport_id` (UUID) tronqué à 8 caractères | **Bug : affiche un UUID tronqué au lieu du nom du sport** |
| `games/$id/logistics/lodging.tsx` | Carte hébergement `[a.type, ...].join(" · ")` | `accommodations.type` | Texte libre affiché brut |

---

## Requêtes SQL de diagnostic

Les requêtes suivantes sont à exécuter sur la base Supabase pour quantifier les orphelins et doublons. Elles ne modifient aucune donnée.

### 1. Codes `person_documents.doc_type` absents d'`app_type_items` (groupe `document_types`)

```sql
SELECT DISTINCT pd.doc_type
FROM public.person_documents pd
LEFT JOIN public.app_type_items ati
  ON ati.group_key = 'document_types'
  AND ati.code = pd.doc_type
WHERE ati.id IS NULL
ORDER BY pd.doc_type;
```

### 2. Codes `accreditation_documents.doc_type` absents d'`app_type_items` (groupe `document_types`)

```sql
SELECT DISTINCT ad.doc_type
FROM public.accreditation_documents ad
LEFT JOIN public.app_type_items ati
  ON ati.group_key = 'document_types'
  AND ati.code = ad.doc_type
WHERE ati.id IS NULL
ORDER BY ad.doc_type;
```

### 3. Codes `accreditation_requirements.doc_type_code` absents d'`app_type_items` (groupe `document_types`)

```sql
SELECT DISTINCT ar.doc_type_code
FROM public.accreditation_requirements ar
LEFT JOIN public.app_type_items ati
  ON ati.group_key = 'document_types'
  AND ati.code = ar.doc_type_code
WHERE ati.id IS NULL
ORDER BY ar.doc_type_code;
```

### 4. Codes `accreditations.role_code` absents du groupe `accreditation_categories`

```sql
SELECT DISTINCT a.role_code
FROM public.accreditations a
WHERE a.role_code IS NOT NULL
  AND a.role_code NOT IN (
    SELECT code FROM public.app_type_items WHERE group_key = 'accreditation_categories'
  )
ORDER BY a.role_code;
```

### 5. Codes `coach_profiles.role` absents du groupe `coach_roles`

```sql
SELECT DISTINCT cp.role
FROM public.coach_profiles cp
WHERE cp.role IS NOT NULL
  AND cp.role NOT IN (
    SELECT code FROM public.app_type_items WHERE group_key = 'coach_roles'
  )
ORDER BY cp.role;
```

### 6. Codes `coaches.role` absents du groupe `coach_roles`

```sql
SELECT DISTINCT c.role
FROM public.coaches c
WHERE c.role IS NOT NULL
  AND c.role NOT IN (
    SELECT code FROM public.app_type_items WHERE group_key = 'coach_roles'
  )
ORDER BY c.role;
```

### 7. Accréditations en doublon (même `game_id` + `person_id`)

```sql
SELECT game_id, person_id, count(*) AS nb
FROM public.accreditations
WHERE person_id IS NOT NULL
GROUP BY game_id, person_id
HAVING count(*) > 1
ORDER BY count(*) DESC;
```

### 8. Accréditations avec `athlete_id` non nul et `person_id` nul

```sql
SELECT count(*) AS nb_accreds_sans_person_id
FROM public.accreditations
WHERE athlete_id IS NOT NULL
  AND person_id IS NULL;
```

### 9. Lignes `accreditation_requirements` en doublon sur `(game_id, role_code, doc_type_code)` avec `selection_stage IS NULL`

> La contrainte `UNIQUE(game_id, role_code, doc_type_code, selection_stage)` ne protège pas le cas `NULL`
> car en Postgres `NULL <> NULL`. Deux lignes avec `selection_stage = NULL` ne violent pas la contrainte.

```sql
SELECT game_id, role_code, doc_type_code, count(*) AS nb
FROM public.accreditation_requirements
WHERE selection_stage IS NULL
GROUP BY game_id, role_code, doc_type_code
HAVING count(*) > 1
ORDER BY count(*) DESC;
```

### 10. Codes `document_types` absents d'`app_type_items` (groupe `document_types`)

> Quantifie la divergence entre les deux référentiels concurrents.

```sql
SELECT dt.code, dt.label, dt.category
FROM public.document_types dt
LEFT JOIN public.app_type_items ati
  ON ati.group_key = 'document_types'
  AND ati.code = dt.code
WHERE ati.id IS NULL
ORDER BY dt.code;
```

### 11. Codes `app_type_items` (groupe `document_types`) absents de `document_types`

```sql
SELECT ati.code, ati.label
FROM public.app_type_items ati
LEFT JOIN public.document_types dt ON dt.code = ati.code
WHERE ati.group_key = 'document_types'
  AND dt.id IS NULL
ORDER BY ati.code;
```

### 12. Codes `federation_members.role` / `federation_member_profiles.role` absents du groupe `federation_member_roles`

```sql
SELECT 'federation_members' AS source, role
FROM public.federation_members
WHERE role IS NOT NULL
  AND role NOT IN (
    SELECT code FROM public.app_type_items WHERE group_key = 'federation_member_roles'
  )
UNION
SELECT 'federation_member_profiles' AS source, role
FROM public.federation_member_profiles
WHERE role IS NOT NULL
  AND role NOT IN (
    SELECT code FROM public.app_type_items WHERE group_key = 'federation_member_roles'
  )
ORDER BY source, role;
```

### 13. Doublons de libellé dans `coach_roles`

> La migration 39 a introduit un doublon : `logistics` et `judge` portent tous deux le libellé « Juge ».

```sql
SELECT code, label
FROM public.app_type_items
WHERE group_key = 'coach_roles'
ORDER BY label, code;
```

### 14. `game_competitions.round` contenant encore des libellés français (au lieu de codes)

> Avant la migration 46, `round` stockait des libellés libres (« Finale », « Demi-finale »).
> Après la migration 46, le code écrit des codes (`finale`, `demi_finale`).
> Les anciennes lignes n'ont pas été migrées.

```sql
SELECT DISTINCT round
FROM public.game_competitions
WHERE round IS NOT NULL
  AND round NOT IN (
    SELECT code FROM public.app_type_items WHERE group_key = 'competition_rounds'
  )
ORDER BY round;
```

### 15. Accréditations dont le `role_code` provient du vocabulaire `coach_roles` au lieu de `accreditation_categories`

> Détecte le défaut central : `accreditations.tsx` écrit `role_code` avec les codes de `coach_profiles.role`
> (vocabulaire `coach_roles`) au lieu des `accreditation_categories`.

```sql
SELECT DISTINCT a.role_code,
  CASE
    WHEN a.role_code IN (SELECT code FROM app_type_items WHERE group_key = 'accreditation_categories')
      THEN 'accreditation_categories ✓'
    WHEN a.role_code IN (SELECT code FROM app_type_items WHERE group_key = 'coach_roles')
      THEN 'coach_roles ✗'
    WHEN a.role_code IN (SELECT code FROM app_type_items WHERE group_key = 'federation_member_roles')
      THEN 'federation_member_roles ✗'
    WHEN a.role_code IN (SELECT code FROM app_type_items WHERE group_key = 'person_role_types')
      THEN 'person_role_types ✗'
    ELSE 'unknown ✗'
  END AS vocabulary
FROM public.accreditations a
WHERE a.role_code IS NOT NULL
ORDER BY a.role_code;
```

### 16. `accreditations.full_name` non résolu dans `persons`

> Identifie les accréditations dont le `full_name` dénormalisé ne correspond à aucune personne.

```sql
SELECT a.id, a.full_name, a.person_id
FROM public.accreditations a
LEFT JOIN public.persons p ON p.id = a.person_id
WHERE a.person_id IS NOT NULL
  AND a.full_name IS NOT NULL
  AND a.full_name <> (p.first_name || ' ' || p.last_name)
ORDER BY a.created_at DESC;
```

### 17. `person_documents` référencés par aucune `accreditation_documents` mais potentiellement requis

> Identifie les documents orphelins (non liés à une accréditation) qui pourraient être comptés à tort.

```sql
SELECT pd.id, pd.person_id, pd.doc_type
FROM public.person_documents pd
WHERE NOT EXISTS (
  SELECT 1 FROM public.accreditation_documents ad
  WHERE ad.doc_type = pd.doc_type
    AND ad.file_url = pd.file_url
)
ORDER BY pd.created_at DESC;
```

---

## Observations structurelles complémentaires

### A. `accreditations.tsx` — boucle de création d'accréditations

Le code `load()` dans `games/$id/accreditations.tsx` exécute, **à chaque rendu de page**, une boucle sur toutes les sélections (`for (const sel of selections)`), avec pour chaque sélection :
- 1 requête `athlete_profiles` (si `athlete_id`)
- 1 requête `athletes` (fallback)
- 1 requête `persons` (pour le nom)
- 1 requête `coach_profiles` (si `person_id`)

Soit **jusqu'à 4 requêtes par sélection**, en série. Sur 200 sélectionnés : ~800 allers-retours à chaque affichage.

De plus, `existingPids` n'est pas mis à jour pendant la boucle : une personne présente dans deux sélections est insérée deux fois dans le même lot `toCreate`, créant un doublon.

Le rôle est résolu via `.maybeSingle()` sur `coach_profiles`, qui **échoue** (retourne `null`) dès qu'une personne a plusieurs profils coach actifs, et retombe alors sur `roleCode = "athlete"`.

### B. `completeness()` — état du drawer partagé

La fonction `completeness(a)` dans `accreditations.tsx` lit `drawerRequiredDocs` et `drawerPersonDocs`, qui sont l'état du **tiroir actuellement ouvert**. Elle est appelée dans `exportCsv()` sur toutes les lignes : le CSV attribue donc à tout le monde la complétude de la dernière personne dont le drawer a été ouvert (ou 0 si aucun drawer n'a été ouvert).

Elle compte comme satisfait un `person_documents` **jamais rattaché** à l'accréditation : la barre affiche 100 % alors qu'aucun lien n'existe via `accreditation_documents`.

La colonne « Documents » du tableau affiche `valid/a.docs.length`, un ratio différent de celui du drawer.

### C. `DocTypeRow` — faux type `PersonDocument`

Dans `accreditations.tsx`, `DocTypeRow` construit un objet `selectedDoc: PersonDocument` avec :
- `id: accDoc.id` — un id d'`accreditation_documents` présenté comme un id de `person_documents`
- `person_id: ""` — chaîne vide
- `issued_date: null`, `expiry_date: null`

C'est un **type mensonger** : le composant en aval croit manipuler un `PersonDocument` valide.

### D. `deleteDoc()` — suppression sans vérification d'usage

Dans `persons/$personId.tsx`, `deleteDoc()` supprime le fichier du storage et la ligne `person_documents` sans vérifier si ce document est référencé par une `accreditation_documents`. Si une accréditation pointe vers ce document (via recopie de `file_url`), elle devient orpheline.

### E. `computeRequiredDocs()` — appelé sans `selectionStage`

Dans `accreditations.tsx`, le drawer appelle `computeRequiredDocs(gameId, current.role_code)` **sans `selectionStage`**. Sans filtre, la fonction retourne les lignes des trois étapes cumulées (`pre_selected`, `selected`, `reserve`), avec des doublons de `doc_type_code`. Un athlète en Long List voit donc les exigences de la Short List.

### F. `computeMissingDocs()` — ignore `status` et `expiry_date`

`computeMissingDocs()` dans `conformity-utils.ts` ne filtre les `person_documents` que sur `doc_type`. Un passeport `rejected` ou `expired` compte comme fourni.

### G. `fetchDocTypeLabels()` — double source

`conformity-utils.ts` → `fetchDocTypeLabels()` interroge d'abord `app_type_items` (groupe `document_types`), puis, pour les codes manquants, fallback sur `document_types`. Deux sources, deux vocabulaires divergents.

### H. Slugify incohérent

- `app-types.ts` (admin) : `code.toLowerCase().replace(/[^a-z0-9_]+/g, "_")` — **pas de suppression des accents**. Saisir « Kiné » produit `kin_`.
- `useReferenceData.ts` : NFD + suppression des diacritiques + préfixe de catégorie (`${category}_${label}`).
- Aucune fonction partagée.

### I. `accreditations.full_name` — dénormalisation non synchronisée

La colonne `full_name` est écrite une fois à la création de l'accréditation et ne suit pas les renommages de la personne. Aucun trigger de synchronisation.

### J. `accreditation_requirements` — contrainte UNIQUE loophole

La contrainte `UNIQUE(game_id, role_code, doc_type_code, selection_stage)` ne protège pas les rôles non-athlètes car `selection_stage` est `NULL` pour eux, et `NULL <> NULL` en Postgres. Deux lignes identiques avec `selection_stage = NULL` peuvent coexister.

### K. `accreditations.role_code` — bug latent de vocabulaire croisé

**Bug latent, sans impact en base à ce jour.** Le code `load()` dans `accreditations.tsx` écrit `role_code` avec les codes de `coach_profiles.role` (vocabulaire `coach_roles`), tandis que `accreditations/$gameId.tsx` configure les requirements avec les codes `accreditation_categories`. En pratique, 23 des 24 accréditations existantes sont des athlètes (`roleCode = "athlete"` par défaut) et le cas ne s'est pas encore déclenché. À corriger avant montée en volume : un kiné (`physio_v2` dans `coach_roles`) ne trouverait jamais les requirements configurés pour `coach` (dans `accreditation_categories`).

### K-bis. Cas de corruption sémantique actif : `medical`

L'unique accréditation avec `role_code = 'medical'` est un faux positif du diagnostic d'orphelins : le code `medical` existe bien dans `accreditation_categories`. Mais il y est libellé « Dignitaires », tandis que dans `coach_roles` il est libellé « Medical ». Cette personne, encadrant médical, reçoit donc les exigences documentaires des dignitaires — **c'est le seul cas de corruption sémantique réellement actif en base aujourd'hui.**

### L. Tables RLS permissives (`USING (true)`)

Les tables suivantes ont des policies `FOR ALL TO authenticated USING (true) WITH CHECK (true)` — n'importe quel utilisateur authentifié (y compris `reader`) peut tout lire, modifier et supprimer :

| Table | Migration | Policy |
|-------|-----------|--------|
| `person_documents` | 44 | `person_documents_all` |
| `accreditation_requirements` | 44 | `accreditation_requirements_all` |
| `app_type_items` | 37 | `app_type_items_all` |
| `events` | 40 | `events_all` |
| `person_events` | 40 | `person_events_all` |

Les tables `persons`, `athlete_documents`, `user_profiles` (et sa colonne `plain_password`) n'ont pas été auditées dans le détail pour cette phase mais sont signalées pour la Phase 10.

---

## Récapitulatif des défauts majeurs

1. **Deux référentiels de types de documents** (`document_types` + `app_type_items`) qui ne se croisent jamais.
2. **Quatre vocabulaires de rôles** (`coach_roles`, `federation_member_roles`, `person_role_types`, `accreditation_categories`) comparés par chaînes de caractères sans table de correspondance.
3. **`accreditations.role_code` — bug latent** : le code écrit dans le vocabulaire `coach_roles` au lieu de `accreditation_categories`. Aucune donnée corrompue aujourd'hui (23/24 athlètes), mais le défaut se déclenchera au premier encadrant accrédité. **Un cas de corruption sémantique active existe malgré tout** : l'accréditation `role_code = 'medical'` reçoit les exigences des « Dignitaires » au lieu de l'encadrement médical.
4. **`accreditation_documents` recopie** les champs de `person_documents` au lieu de le référencer.
5. **Constantes TypeScript périmées** (`COACH_ROLES`, `FEDERATION_MEMBER_ROLES`, etc.) désynchronisées de `app_type_items`.
6. **Codes affichés bruts** dans le JSX (rôles, statuts, rounds, types de notification) sans résolveur de libellé.
7. **Boucle de création d'accréditations** dans un `useEffect` de rendu, avec N+1 requêtes et doublons.
8. **Complétude fausse** : lit l'état du drawer, compte des documents non liés, ignore `status` et `expiry_date`.
9. **Référentiels seedés mais inutilisés** (`transport_types`, `accommodation_types`) — la logistique reste en texte libre.
10. **RLS permissive** sur les tables sensibles (`person_documents`, `accreditation_requirements`).
11. **Cascades de suppression destructrices** : les FK `person_id` en `ON DELETE CASCADE` sur `person_documents`, `selections`, `accreditations`, `delegation_members` effacent l'historique en cascade lors de la suppression d'une personne.

---

## Résultats des requêtes de diagnostic (exécutés en base)

| Diagnostic | Résultat | Conséquence |
|---|---|---|
| `doc_type` orphelins dans `person_documents` | **2** | Phase B |
| `doc_type` orphelins dans `accreditation_documents` | **4** | Phase B |
| `doc_type_code` orphelins dans `accreditation_requirements` | **5** | **Bug actif** : 5 exigences impossibles à satisfaire |
| Codes `document_types` absents d'`app_type_items` | **9** | Phase B — divergence confirmée |
| `accreditations.role_code` hors `accreditation_categories` | **0** | **Aucune donnée corrompue** |
| `coach_profiles.role` orphelins | **2** | Phase C (petit volume) |
| `coaches.role` orphelins | **0** | RAS |
| Couples `(game_id, person_id)` en doublon | **3** | Phase F (allégée) |
| Accréditations `athlete_id` sans `person_id` | **15** | Cause mécanique des doublons |
| Doublons `accreditation_requirements` (stage NULL) | **0** | Contrainte à poser, pas de nettoyage |
| `game_competitions.round` hors référentiel | **2** | Phase I |
| `accreditations.full_name` désynchronisé | **0** | Préventif, priorité basse |

**Répartition réelle des `role_code`** (24 accréditations au total) : `athlete` = 23, `medical` = 1. Les deux sont formellement valides dans `accreditation_categories`, mais le cas `medical` est une collision sémantique (voir §K-bis).

---

*Fin de la Phase 0 — aucune modification applicative n'a été effectuée.*