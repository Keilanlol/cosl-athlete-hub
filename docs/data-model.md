# Modèle de données

## Vue d'ensemble

L'application gère le domaine sportif du COSL (Comité Olympique et Sportif Luxembourgeois). Le modèle de données s'articule autour de **personnes** (super-classe), de **rôles** (athlète, encadrant, membre de fédération/club), de **Games** (événements multi-sports), et de toutes les entités liées (logistique, communication, KYC, etc.).

## Entités principales et relations

```
persons (super-classe)
  ├──→ athlete_profiles (1:1) ──→ athletes (legacy)
  ├──→ coach_profiles (1:1) ──→ coaches (legacy)
  ├──→ federation_member_profiles (1:1) ──→ federation_members (legacy)
  └──→ club_member_profiles (1:1) ──→ club_members (legacy)

athletes
  ├──→ athlete_documents (1:N)
  ├──→ athlete_kyc (1:1)
  ├──→ athlete_relations (N:M → coaches)
  ├──→ athlete_results (1:N)
  ├──→ athlete_appointments (1:N)
  ├──→ selections (N:1 → games)
  ├──→ sports (N:1, primary_sport_id)
  ├──→ federations (N:1, primary_federation_id)
  └──→ clubs (N:1, current_club_id)

federations
  ├──→ federation_members (1:N)
  └──→ clubs (1:N)

clubs
  ├──→ club_members (1:N)
  ├──→ federation (N:1, optionnel)
  └──→ athletes (1:N)

games
  ├──→ game_sports (1:N → sports)
  ├──→ game_competitions (1:N)
  ├──→ game_quotas (1:N)
  ├──→ selections (1:N → athletes)
  ├──→ travel_plans (1:N)
  │     └──→ flights (1:N)
  │           └──→ flight_passengers (1:N → athletes/coaches)
  ├──→ accommodations (1:N)
  │     └──→ rooming_assignments (1:N → athletes/coaches)
  ├──→ local_transport (1:N)
  │     └──→ local_transport_passengers (1:N → athletes/coaches)
  ├──→ sponsors (1:N, via games_sponsors)
  └──→ partners (1:N, via games_partners)

user_profiles (auth Supabase)
  ├──→ notifications (target_user_id)
  └──→ kyc_history (changed_by)
```

## Architecture hybride personnes

Le système utilise une **architecture hybride** avec une table `persons` unifiée et des tables legacy :

- **`persons`** — super-classe avec données communes (nom, prénom, email, téléphone, date de naissance, photo, nationalité, etc.).
- **`athlete_profiles`**, **`coach_profiles`**, **`federation_member_profiles`**, **`club_member_profiles`** — tables de liaison qui font le lien entre `persons` et les tables legacy (`athletes`, `coaches`, `federation_members`, `club_members`).
- Les tables legacy (`athletes`, `coaches`, etc.) contiennent les données spécifiques au rôle (statut sportif, niveau, tailles, etc.).
- **`person_roles`** — table des rôles d'une personne (athlete, coach, federation_member, club_member, official, volunteer, staff).
- **`v_persons_with_roles`** — vue PostgreSQL qui joint `persons` + `person_roles` + profils, exposant `roles[]`, `legacy_athlete_id`, `cosl_id`.

### Synchronisation des photos

`src/lib/person-photo-sync.ts` gère la propagation des photos entre `persons` et les tables legacy :
- `syncPhotoFromPerson(personId, fields)` — met à jour la photo sur tous les enregistrements legacy liés.
- `syncPhotoFromLegacy(personId, fields)` — met à jour `persons` puis propage aux autres legacy.
- `findPersonIdForLegacy(table, column, legacyId)` — retrouve le `person_id` à partir d'un ID legacy.

## Détail des entités

### Athlète (`athletes`)

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | PK |
| `cosl_id` | string | ID unique format `COSL-AAAA-NNNN` (auto-généré) |
| `first_name`, `last_name` | string | Nom |
| `birth_date` | date | Date de naissance |
| `birth_place` | string? | Lieu de naissance |
| `gender` | `male\|female\|mixed` | Genre |
| `nationality` | string(2-3) | Code ISO pays |
| `sport_nationality` | string? | Nationalité sportive |
| `primary_sport_id` | UUID? | FK → sports |
| `primary_federation_id` | UUID? | FK → federations |
| `current_club_id` | UUID? | FK → clubs |
| `status` | `active\|injured\|suspended\|retired\|ambassador` | Statut sportif |
| `level` | string? | Niveau (elite, promotion, espoir, olympic_contract — via `athlete_levels_ref`) |
| `size_clothing/shoes/gloves` | string? | Tailles équipement |
| `license_number` | string? | N° licence |
| `ada_number` | string? | N° ADAMS (antidopage) |
| `passport_number`, `passport_expiry` | string? | Passeport |
| `is_active` | boolean | Soft delete (désactivation) |
| `photo_url` | string? | URL photo (signed URL Supabase Storage) |

**Génération COSL ID** : `generateCoslId(existing)` dans `types.ts` — calcule `COSL-{année}-{séquentiel 4 chiffres}`.

### KYC Athlète (`athlete_kyc`)

7 axes de conformité, chacun avec statut green/orange/red :

| Axe | Champs clés | Logique |
|-----|-------------|---------|
| 1. Identité | `identity_verified`, `passport_doc_id`, `ci_doc_id` | Booléen + lien vers document |
| 2. Nationalité | `nationality_verified`, `sport_nationality`, `eligibility_federation` | Booléen + fédération intl |
| 3. Âge | `age_eligibility_ok`, `min_age_ok`, `max_age_ok` | Calculé par épreuve (competition min/max age) |
| 4. Antidopage | `antidoping_status`, `adams_number`, `antidoping_whereabouts_ok` | green/orange/red + ADAMS |
| 5. E-learning | `elearning_antidoping_completed`, `elearning_completed_at` | Booléen + date + certificat URL |
| 6. Charte éthique | `ethics_charter_signed`, `ethics_charter_signed_at`, `ethics_charter_doc_id` | Booléen + date + doc lié |
| 7. Règle 40 CIO | `rule40_signed`, `rule40_signed_at`, `rule40_doc_id` | Booléen + date + doc lié |

**Statut global** calculé par `computeKycGlobalStatus()` dans `kyc-utils.ts` :
- Rouge si identité non vérifiée OU nationalité non vérifiée OU antidopage rouge
- Vert si les 6 axes (identité, nationalité, antidopage, e-learning, charte, règle 40) sont validés
- Orange sinon

**Historique** : `kyc_history` trace chaque changement de statut avec `changed_by`, `previous_status`, `new_status`, `axis`.

### Encadrant (`coaches`)

Rôles : `coach`, `manager`, `medical`, `official`, `chief_of_mission`, `press`, `physio`, `logistics`.
Relations avec athlètes via `athlete_relations` (table de liaison avec `relation_role`).

### Fédération (`federations`)

| Champ | Description |
|-------|-------------|
| `acronym`, `name` | Identification |
| `president_name` | Président |
| `contact_email`, `contact_phone` | Contact |
| `international_federation` | Fédération internationale |
| `is_olympic` | Fédération olympique ? |
| `logo_url`, `logo_storage_path` | Logo |

Membres via `federation_members` avec rôles : président, vice-président, secrétaire général, trésorier, membre du bureau, délégué, autre.

### Club (`clubs`)

Adresse complète (rue, CP, ville, pays). Lié à une fédération (optionnel). Membres via `club_members`.

### Games (`games`)

| Champ | Description |
|-------|-------------|
| `name`, `short_name` | Nom et acronyme |
| `game_type` | `jo_summer`, `jo_winter`, `joj_summer`, `joj_winter`, `jpee`, `european_games`, `eyof_summer`, `eyof_winter`, `other` |
| `edition_year` | Année de l'édition |
| `host_country`, `host_city` | Lieu d'organisation |
| `competition_start`, `competition_end` | Dates de compétition |
| `status` | `preparation`, `in_progress`, `finished`, `archived` |
| `logo_url`, `logo_storage_path` | Logo du Games |

Tables liées : `game_sports`, `game_competitions` (épreuves avec min/max age, genre, lieu), `game_quotas`, `selections`.

### Logistique

| Entité | Table | Description |
|--------|-------|-------------|
| Travel plan | `travel_plans` | Plan de voyage (scope: global/sport/individual, statut: planned/confirmed/modified/cancelled) |
| Flight | `flights` | Vol (numéro, aéroports, horaires, outbound/return) |
| Flight passenger | `flight_passengers` | Passager (athlete_id OU coach_id, siège, bagages) |
| Accommodation | `accommodations` | Hébergement (nom, adresse, type, nb chambres) |
| Rooming | `rooming_assignments` | Attribution chambre (numéro, type, athlete/coach, check-in/out) |
| Local transport | `local_transport` | Navette (type, pickup/dropoff, heure, capacité) |
| Transport passenger | `local_transport_passengers` | Passager navette |

### Communication

| Entité | Table | Description |
|--------|-------|-------------|
| Template | `message_templates` | Modèle de message (canal, sujet, corps) |
| Message sent | `messages_sent` | Message envoyé (comptage destinataires) |
| Message recipient | `message_recipients` | Destinataires (lien athlete_id) |
| Notification | `notifications` | Alertes système (type, message, target_user_id, is_read) |

### Utilisateurs (`user_profiles`)

| Champ | Description |
|-------|-------------|
| `username` | Nom d'utilisateur (login via username converti en email) |
| `full_name` | Nom complet |
| `email` | Email (pour Supabase Auth) |
| `role` | `admin`, `games_manager`, `fed_manager`, `logistics`, `communication`, `reader` |
| `plain_password` | Mot de passe en clair (visible admin uniquement) |

## Tables de référence

| Table | Description | Hook |
|-------|-------------|------|
| `sports` | Liste des sports (id, name, is_olympic, is_summer) | `useSports()` |
| `athlete_levels_ref` | Niveaux d'athlète (code, label, sort_order) | `useAthleteLevels()` |
| `document_types` | Types de documents (code, label, category, sort_order) | `useDocumentTypes()` |
| `disciplines` | Disciplines par sport (sport_id, name, gender, age_category) | fetch direct |

## Storage Supabase

Bucket **`documents`** : stocke les fichiers uploadés (photos d'identité, documents athlètes, logos).
- Chemin pattern : `athletes/{athleteId}/photo/photo_identite.{ext}` ou `athletes/{id}/{category}/{timestamp}_{filename}`
- URLs signées avec expiration (1 an pour les photos, par défaut pour les autres).
- `FileUpload` et `EntityImageUpload` gèrent l'upload + signed URL.
- `pathFromSignedUrl()` dans `FileUpload.tsx` extrait le path storage depuis une signed URL pour suppression.