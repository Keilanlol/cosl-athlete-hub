# Plan — Création multi-étapes & dual-write Person ↔ legacy

## Décisions retenues (suite aux clarifications)

- Types restent dans `src/lib/persons.ts` (pas de migration vers `src/types/`).
- Pas de couche service/hooks React Query : appels Supabase directs dans les composants (cohérent avec athletes/coaches/clubs).
- On **enrichit** l'existant au lieu de tout réécrire : filtre Actif/Inactif et photo conservés, 7 rôles préservés, mais Dialog passe en 3 étapes.

## Périmètre

3 fichiers touchés. Aucun changement sur `athletes/`, `coaches/`, `clubs/`, `lib/supabase.ts`, `AuthContext`, ni sur la migration SQL 30.

## 1. `src/lib/persons.ts` — ajouts mineurs

Ajouter un alias `ROLE_COLORS = ROLE_BADGE_CLASSES` pour cohérence sémantique, sans casser les imports existants.

## 2. `src/components/persons/PersonCreateDialog.tsx` — refonte en 3 étapes

Remplacer le Dialog actuel (1 écran) par un wizard :

- **Step 1 — Général** : prénom*, nom*, date de naissance, genre, nationalité (défaut LUX), email, téléphone.
- **Step 2 — Rôles** : checkboxes pour les **7 rôles** (`athlete`, `coach`, `federation_member`, `club_member`, `official`, `volunteer`, `staff`) avec description courte. Au moins 1 requis.
- **Step 3 — Profils spécifiques** : sections conditionnelles uniquement pour athlete / coach / fed_member / club_member (les 3 autres rôles n'ont pas de profil dédié, juste l'entrée `person_roles`).
  - Athlète : sport, fédération, club (filtré par fédération), statut, niveau, n° licence, passeport.
  - Coach : fonction, fédération, club.
  - Membre fédération : fédération*, rôle, date début.
  - Membre club : club*, rôle, date début.

Indicateur d'étapes en haut, boutons Précédent/Suivant/Créer en bas. Chargement de sports/federations/clubs au `open=true`.

### Dual-write (logique métier)

Lors de la création (Step 3 → Créer) :

1. `INSERT INTO persons` → récupérer `personId`.
2. `INSERT INTO person_roles` pour chaque rôle coché.
3. Si `athlete` coché :
   - Générer `cosl_id` (`COSL-{year}-{seq:0000}`) en lisant le max existant.
   - `INSERT INTO athletes` (legacy, avec `person_id` pour traçabilité) → récupérer `legacyAthleteId`.
   - `INSERT INTO athlete_profiles` (source de vérité future, avec `legacy_athlete_id`).
   - `INSERT INTO athlete_kyc` (global_status = 'red').
4. Si `coach` coché :
   - `INSERT INTO coaches` (legacy, avec `person_id`) → récupérer `legacyCoachId`.
   - `INSERT INTO coach_profiles` (avec `legacy_coach_id`).
5. Si `federation_member` coché → `INSERT INTO federation_member_profiles` (pas de legacy dual-write demandé).
6. Si `club_member` coché → `INSERT INTO club_member_profiles`.
7. Toasts succès/erreur, fermeture, callback `onCreated(personId)`.

Les rôles `official` / `volunteer` / `staff` créent uniquement la ligne `person_roles` (pas de profil dédié dans le schéma).

## 3. `src/routes/_authenticated/persons/index.tsx` — conservation + petits ajustements

Garder la version actuelle (Select rôle + Select Actif/Inactif + recherche + pagination shadcn maison + photo dans la 1re colonne). Aucune migration vers tabs/compteurs.

Seul changement : passer le `onCreated` au nouveau Dialog (déjà fait), aucune autre modification.

## Détails techniques

- Pas de React Query : `useState` + `await supabase…`, `toast` de `sonner`, `friendlyError` pour les messages.
- Génération `cosl_id` : `SELECT cosl_id FROM athletes WHERE cosl_id ILIKE 'COSL-{year}-%' ORDER BY cosl_id DESC LIMIT 1`, puis `+1` padded sur 4 digits. Tolère collision (très improbable) — affichera l'erreur PG si conflit.
- Tous les profils utilisent `person_id` comme lien vers `persons` (créé par la migration 30).
- Filtrage clubs par fédération dans le Step Athlète (UX).
- Genre stocké via enum PG existante (`'male' | 'female' | 'mixed'`).
- Validation minimale : prénom/nom non vides (Step 1), ≥1 rôle (Step 2). Step 3 sans validation forte — les profils incomplets sont insérés tels quels.

## Hors périmètre

- Édition ultérieure des profils (déjà partiellement gérée dans `$personId.tsx`).
- Sync inverse legacy → persons (les écritures dans `athletes/coaches` faites depuis les anciens écrans ne créent toujours pas de `person`).
- Suppression/archivage cascade.
- Upload photo dans le Dialog (la photo s'ajoute depuis la fiche détail, comme aujourd'hui).
