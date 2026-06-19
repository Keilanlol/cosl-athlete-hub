# Audit des incohérences — Architecture hybride persons/legacy

> **Date** : 2025-01
> **Auteur** : Agent IA (chat "Audit des incohérences")

## Résumé

L'audit a identifié et corrigé les incohérences de données liées à l'architecture hybride du projet : le système `persons` (super-classe unifiée) coexistait avec les tables legacy (`athletes`, `coaches`, `federation_members`, `club_members`) sans synchronisation fiable. Les corrections apportées couvrent : la synchronisation bidirectionnelle des photos, le dual-write lors de la création de personnes avec rôles, la gestion des rôles multiples, et la navigation croisée entre fiches personne et fiches legacy.

## Problèmes identifiés

### 1. Données dupliquées sans synchronisation

Les tables legacy (`athletes`, `coaches`, `federation_members`, `club_members`) contenaient des champs redondants avec `persons` (nom, prénom, email, téléphone, photo, nationalité, etc.) sans aucun mécanisme de synchronisation. Une modification sur une table n'était pas répercutée sur l'autre.

### 2. Photos non synchronisées

- La photo uploadée sur la fiche athlète (`athletes.photo_url`) n'était pas propagée à `persons.photo_url`.
- Inversement, une photo uploadée sur la fiche personne n'était pas répercutée sur les enregistrements legacy liés.
- Le champ `photo_storage_path` était absent de certaines tables legacy.

### 3. Création d'athlètes sans enregistrement `persons`

Le formulaire d'ajout d'athlète (`/athletes` → Dialog) créait directement un enregistrement dans `athletes` sans créer de `persons` ni de `athlete_profiles`. L'athlète n'apparaissait donc pas dans la liste `/persons`.

### 4. Pas de gestion des rôles multiples

Une personne pouvait être à la fois athlète, encadrant et membre de club, mais il n'existait pas de mécanisme pour gérer ces rôles multiples depuis une interface unifiée.

### 5. Lien fiche personne ↔ fiches legacy manquant

Aucune navigation bidirectionnelle n'existait entre `/persons/$personId` et `/athletes/$id`, `/coaches/$id`, etc.

## Corrections apportées

### A. Synchronisation bidirectionnelle des photos

**Fichier créé** : `src/lib/person-photo-sync.ts`

Trois fonctions principales :

| Fonction | Rôle |
|----------|------|
| `syncPhotoFromPerson(personId, fields)` | Met à jour `persons`, puis propage la photo vers tous les enregistrements legacy liés (athletes, coaches, federation_members, club_members). |
| `syncPhotoFromLegacy(personId, fields)` | Met à jour `persons` depuis un enregistrement legacy, puis propage vers les autres enregistrements legacy. |
| `findPersonIdForLegacy(table, column, legacyId)` | Résout le `person_id` à partir d'un ID legacy en interrogeant les tables de profil (`athlete_profiles`, `coach_profiles`, etc.). |

**Flux de résolution des IDs legacy** :

```
getLegacyIds(personId)
  → athlete_profiles.legacy_athlete_id (1:1, maybeSingle)
  → coach_profiles.legacy_coach_id (1:N)
  → federation_member_profiles.legacy_federation_member_id (1:N)
  → club_member_profiles.legacy_club_member_id (1:N)
```

### B. Dual-write lors de la création de personne

**Fichiers concernés** : `src/components/persons/PersonCreateDialog.tsx`, `src/components/persons/AddRoleDialog.tsx`

Le `PersonCreateDialog` est un wizard à 3 étapes :
1. **Informations générales** — prénom, nom, date de naissance, genre, email, téléphone, adresse, nationalité.
2. **Rôles** — sélection multi-rôle (athlete, coach, federation_member, club_member, official, volunteer, staff).
3. **Profils spécifiques** — formulaires conditionnels selon les rôles sélectionnés.

Le `handleSubmit()` effectue un **dual-write** complet :

```
1. INSERT persons → personId
2. INSERT person_roles (un par rôle sélectionné)
3. Si athlete :
   a. INSERT athletes (avec person_id) → legacyAthleteId
   b. INSERT athlete_profiles (person_id + legacy_athlete_id)
   c. INSERT athlete_kyc (global_status: "red")
4. Si coach :
   a. INSERT coaches (avec person_id) → legacyCoachId
   b. INSERT coach_profiles (person_id + legacy_coach_id)
5. Si federation_member :
   a. INSERT federation_member_profiles (person_id)
   b. INSERT federation_members (avec person_id) → legacyFmId
   c. UPDATE federation_member_profiles SET legacy_federation_member_id
6. Si club_member :
   a. INSERT club_member_profiles (person_id)
   b. INSERT club_members (avec person_id) → legacyCmId
   c. UPDATE club_member_profiles SET legacy_club_member_id
```

Le `AddRoleDialog` effectue le même dual-write pour un seul rôle ajouté à une personne existante.

### C. Gestion des rôles (CRUD)

**Fichier** : `src/routes/_authenticated/persons/$personId.tsx`

- **Ajouter un rôle** : ouvre `AddRoleDialog` avec le formulaire spécifique au rôle choisi.
- **Retirer un rôle** : `removeRole(roleType)` :
  - **Athlète** : `UPDATE athletes SET is_active = false` (soft delete) + `DELETE athlete_profiles` + `DELETE person_roles`.
  - **Coach** : `DELETE coaches` + `DELETE coach_profiles` + `DELETE person_roles`.
  - **Federation member** : `DELETE federation_members` + `DELETE federation_member_profiles` + `DELETE person_roles`.
  - **Club member** : `DELETE club_members` + `DELETE club_member_profiles` + `DELETE person_roles`.
- **Supprimer la personne** : `DELETE persons` (les enregistrements legacy ne sont pas supprimés).

### D. Navigation croisée personne ↔ legacy

La fiche personne (`/persons/$personId`) affiche chaque rôle actif avec un lien "Voir la fiche" vers la page legacy correspondante :

| Rôle | Lien legacy |
|------|-------------|
| Athlète | `/athletes/$id` (via `athlete_profile.legacy_athlete_id`) |
| Coach | `/coaches/$id` (via `coach_profile.legacy_coach_id`) |
| Membre fédération | `/federations/members/$memberId` |
| Membre club | `/clubs/members/$memberId` |

Inversement, la fiche athlète (`/athletes/$id`) affiche un bouton "Fiche personne" qui redirige vers `/persons/$personId` si l'athlète a un `person_id`.

### E. Intégration de la synchronisation photos dans les composants

**Fiche personne** (`persons/$personId.tsx`) :
- `EntityImageUpload` avec `entityType="person"` → onUploaded/onDeleted appellent `syncPhotoFromPerson()`.

**Fiche athlète** (`athletes/$id.tsx`) :
- `AthletePhotoUpload` → onUploaded/onDeleted appellent `findPersonIdForLegacy()` puis `syncPhotoFromLegacy()`.

### F. Composant `AddPersonButton`

**Fichier** : `src/components/persons/AddPersonButton.tsx`

Bouton réutilisable offrant deux chemins :
1. **Sélectionner une personne existante** → ouvre `AddRoleDialog` pour ajouter le rôle.
2. **Créer une nouvelle personne** → ouvre `PersonCreateDialog` avec le rôle pré-sélectionné.

Utilisé dans la page `/athletes` (prop `role="athlete"`).

## Fichiers touchés

| Fichier | Type | Description |
|---------|------|-------------|
| `src/lib/person-photo-sync.ts` | Création | Helpers de sync photos persons ↔ legacy |
| `src/lib/persons.ts` | Existant | Types Person, PersonRole, profils liés, v_persons_with_roles |
| `src/components/persons/PersonCreateDialog.tsx` | Création | Wizard 3 étapes de création de personne avec dual-write |
| `src/components/persons/AddRoleDialog.tsx` | Création | Ajout d'un rôle à une personne existante avec dual-write |
| `src/components/persons/AddPersonButton.tsx` | Création | Bouton réutilisable (picker existant + création nouvelle) |
| `src/components/persons/PersonRoleBadge.tsx` | Création | Badge visuel du rôle d'une personne |
| `src/components/EntityImageUpload.tsx` | Existant | Composant upload générique, utilisé pour photos persons |
| `src/components/AthletePhotoUpload.tsx` | Existant | Upload photo athlète, intégration syncPhotoFromLegacy |
| `src/routes/_authenticated/persons/index.tsx` | Existant | Liste des personnes via v_persons_with_roles |
| `src/routes/_authenticated/persons/$personId.tsx` | Existant | Fiche personne : rôles, navigation croisée, sync photos |
| `src/routes/_authenticated/athletes/$id.tsx` | Existant | Fiche athlète : lien vers fiche personne, sync photos |
| `src/routes/_authenticated/athletes/index.tsx` | Existant | Liste athlètes : AddPersonButton remplace ancien bouton ajout |

## Dépendances

### Tables BDD

| Table | Rôle |
|-------|------|
| `persons` | Super-classe (nom, prénom, email, téléphone, photo, etc.) |
| `person_roles` | Rôles multiples d'une personne (role_type, is_active) |
| `athlete_profiles` | Pont persons ↔ athletes (person_id, legacy_athlete_id, cosl_id) |
| `coach_profiles` | Pont persons ↔ coaches (person_id, legacy_coach_id) |
| `federation_member_profiles` | Pont persons ↔ federation_members |
| `club_member_profiles` | Pont persons ↔ club_members |
| `v_persons_with_roles` | Vue PostgreSQL joignant persons + person_roles + profils |
| `athletes`, `coaches`, `federation_members`, `club_members` | Tables legacy (avec colonne `person_id` ajoutée) |
| `athlete_kyc` | Création automatique d'un KYC initial (status "red") lors de la création d'un athlète |

### Composants

- `EntityImageUpload` — upload photo personne
- `AthletePhotoUpload` — upload photo athlète avec sync
- `PersonCombobox` — recherche de personne existante
- `AddressSearch` — autocomplétion d'adresse (API Photon)

## Points d'attention

### Athlètes créés avant l'audit

Les athlètes créés via l'ancien formulaire (`/athletes` → Dialog direct) **n'ont pas** d'enregistrement `persons`. La colonne `athletes.person_id` est `NULL` pour ces enregistrements. La fiche athlète vérifie `person_id` et n'affiche le bouton "Fiche personne" que si un `persons` existe.

### Ordre d'insertion dual-write

L'ordre d'insertion est critique :
1. `persons` d'abord (pour obtenir `personId`)
2. Tables legacy ensuite (avec `person_id` = personId)
3. Tables de profil (avec `person_id` + `legacy_*_id`)
4. `person_roles` en dernier

Si une étape échoue, les enregistrements précédents ne sont pas rollbackés (pas de transaction). L'erreur est remontée via toast.

### Photos : `photo_url` vs `photo_storage_path`

- `persons` a les deux champs (`photo_url`, `photo_storage_path`).
- `athletes` n'a que `photo_url` (pas de `photo_storage_path`).
- `syncPhotoFromPerson()` met à jour `athletes.photo_url` uniquement (pas de `photo_storage_path`).
- Les autres tables legacy (`coaches`, `federation_members`, `club_members`) ont les deux champs.

### Suppression de personne

`DELETE persons` supprime la personne mais **ne supprime pas** les enregistrements legacy. Ce comportement est volontaire (évite de perdre des données sportives) mais peut laisser des enregistrements orphelins avec `person_id` pointant vers une personne supprimée.

### Vue `v_persons_with_roles`

La liste `/persons` interroge `v_persons_with_roles` (vue PostgreSQL). Cette vue doit exister côté BDD et exposer : `id, first_name, last_name, email, phone, photo_url, is_active, roles[] (PersonRoleType[]), legacy_athlete_id, cosl_id`.

## UI

### Page `/persons` (liste)
- Table avec photo, nom, email, téléphone, badges de rôles, statut actif/inactif.
- Filtres : recherche texte, filtrage par rôle, filtrage par statut.
- Bouton "Nouvelle personne" → `PersonCreateDialog`.

### Page `/persons/$personId` (fiche détaillée)
- En-tête avec photo (EntityImageUpload), nom, badges de rôles.
- Coordonnées (email, téléphone, adresse, date de naissance, nationalité).
- Section "Rôles" : liste des rôles actifs avec sous-titre (club/fédération, statut, niveau) et lien "Voir la fiche" vers la page legacy.
- Boutons : "Gérer les rôles" (dialog CRUD), "Modifier" (dialog édition), "Supprimer".