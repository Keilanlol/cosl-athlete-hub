# Plan consolidé — PERSONNE_PHYSIQUE (superclasse + rôles multiples)

## Objectif
Introduire une entité unique `persons` dont héritent athlètes, encadrants, membres de fédération et membres de club. Une personne peut cumuler plusieurs rôles. Migration **100 % additive** : aucune table existante n'est cassée, aucun FK existant n'est invalidé. Les pages actuelles continuent de fonctionner pendant toute la transition.

## Stratégie en 3 phases

### Phase 1 — Migration SQL (non destructive)
Fichier : `supabase/sql/30_persons_superclass.sql`

Ce que la migration crée :
- **Enum** `person_role_type` : athlete, coach, federation_member, club_member, official, volunteer, staff
- **Table mère** `persons` : identité, contact, adresse, photo, contact d'urgence
- **Junction** `person_roles` (person_id, role_type, is_active) — UNIQUE(person_id, role_type)
- **Profils 1:1 ou 1:N** :
  - `athlete_profiles` (1:1, contient cosl_id, sport/féd/club primaires, status, tailles, licences, passeport…)
  - `coach_profiles` (1:N — un encadrant peut intervenir pour plusieurs féd/clubs)
  - `federation_member_profiles` (1:N — UNIQUE person_id+federation_id+role)
  - `club_member_profiles` (1:N — UNIQUE person_id+club_id+role)
- **Colonne `person_id`** ajoutée (nullable, ON DELETE SET NULL) sur `athletes`, `coaches`, `federation_members`, `club_members` → backward compat totale
- **Backfill** des données existantes :
  - Chaque athlète → 1 person + 1 athlete_profile + role 'athlete'
  - Coaches / fed_members / club_members → déduplication par email (réutilise la person si email déjà connu) → ajoute le bon role + profil
- **Vue de confort** `v_persons_with_roles` (snapshot plat pour les listes : agrège roles[] + champs athlète clés)
- **RLS + GRANTS** pour `authenticated` (policy `FOR ALL USING (true)` cohérente avec les autres tables du projet)
- **Triggers** `updated_at` sur `persons` et `athlete_profiles`
- **NOTIFY pgrst** en fin pour recharger le schéma PostgREST

Vérification finale embarquée :
```text
athletes_not_linked = 0
coaches_not_linked = 0
total_persons ≤ somme(rôles)  (égal si aucun cumul détecté par email)
```

### Phase 2 — Couche TypeScript (types + service + hooks)
Fichiers à créer (zéro modification des types existants) :
- `src/types/persons.ts` — `Person`, `PersonRole`, `PersonRoleType`, profils, `PersonWithRoles`, `PersonListItem`, `ROLE_LABELS`, `ROLE_COLORS`
- `src/services/personsService.ts` — `fetchPersons`, `fetchPerson`, `createPerson`, `updatePerson`, `addPersonRole`, `removePersonRole`
- `src/hooks/usePersons.ts` — `usePersonsList`, `usePerson`, `useCreatePerson`, `useUpdatePerson`, `useTogglePersonRole` (React Query, clés `PERSONS_KEYS`)

Lecture liste via la vue `v_persons_with_roles`. Lecture détail via select imbriqué `persons + person_roles + *_profiles`.

### Phase 3 — UI Personnes
Fichiers à créer :
- `src/routes/_authenticated/persons/index.tsx` — Liste avec filtres (rôle, actif, recherche) + badges colorés par rôle
- `src/routes/_authenticated/persons/$personId.tsx` — Fiche détail avec **onglets dynamiques** : un onglet par rôle actif (Athlète, Encadrant, Fédération, Club, …). L'onglet Athlète réutilise les composants KYC/documents existants via `legacy_athlete_id`.
- `src/components/persons/PersonRoleBadge.tsx` — Badge réutilisable
- `src/components/persons/PersonCreateDialog.tsx` — Wizard 3 étapes : (1) infos générales, (2) sélection des rôles, (3) détails par rôle sélectionné

Navigation :
- Ajout d'un item « Personnes » dans `src/components/AppSidebar.tsx` (icône `Users`), placé au-dessus d'Athlètes
- Les pages Athlètes / Encadrants / Membres existantes **restent inchangées** dans cette phase

## Coexistence et migration progressive
- Les tables `athletes`, `coaches`, etc. continuent d'être la source de vérité pour les FKs métier (`selections.athlete_id`, `accreditations.athlete_id`, `flight_passengers.coach_id`…)
- Toute création future passera idéalement par `persons` puis dérivera dans la table legacy via `legacy_*_id` (à traiter dans une phase 4 ultérieure, hors scope)
- Aucune suppression de colonne ni de table dans ce plan

## Détails techniques

### Compatibilité avec le schéma existant
- `persons.gender` réutilise l'enum `public.gender` déjà présent
- `athlete_profiles.status` réutilise `public.athlete_status`
- Trigger `set_updated_at` supposé déjà défini (utilisé ailleurs dans `supabase/sql/`). Si absent, l'ajouter dans la même migration avant les triggers.

### Déploiement (self-hosted)
```text
psql -h <host> -U postgres -d postgres -f supabase/sql/30_persons_superclass.sql
```
Puis recharger le PostgREST (le `NOTIFY pgrst, 'reload schema'` final suffit normalement).

### Risques et mitigations
| Risque | Mitigation |
|---|---|
| Doublons à la déduplication par email | Email NULL → toujours nouvelle person ; pas de fusion forcée |
| `set_updated_at` inexistant | Vérifier dans les migrations 01–29 avant exécution, créer si manquant |
| Conflit unique sur `person_roles` lors de re-runs | `ON CONFLICT DO NOTHING` partout dans les blocs DO |
| Vue `v_persons_with_roles` non rechargée par PostgREST | `NOTIFY pgrst` final + redémarrage PostgREST si besoin |

### Hors scope (phases futures)
- Migration des écritures legacy vers `persons` côté UI Athlètes/Encadrants/Membres
- Suppression à terme des tables legacy une fois toutes les UI bascules
- Rôles « sponsor », rôles famille, liens personne ↔ user_account

## Livrables Phase 1 uniquement (ce que je code en premier après ton OK)
- `supabase/sql/30_persons_superclass.sql` (contenu exact que tu as fourni, après vérification de l'existence de `set_updated_at`)

Phases 2 et 3 enchaînées juste après validation que la migration tourne proprement sur ta base.
