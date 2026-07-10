# Migrations de base de données

## Système de tracking

Le projet utilise un système de tracking manuel des migrations via la table `supabase_migrations.schema_migrations`. Cette table enregistre quelles migrations ont été appliquées et à quel moment.

### Initialisation

Le script `00b_schema_migrations_init.sql` crée la table de tracking et marque les migrations 00 à 38 comme déjà appliquées. Il ne doit être exécuté qu'une seule fois.

### Vérifier l'état des migrations

```sql
SELECT version, name, applied_at
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

## Convention de nommage

```
supabase/sql/
├── 00_fresh_install.sql
├── 00b_schema_migrations_init.sql       ← Init tracking (une seule fois)
├── 01_init.sql
├── ...
├── 38_persons_in_games_view.sql
├── 38b_snapshot_before_39.sql           ← Snapshot avant migration 39
├── 39_up_update_type_items.sql          ← Appliquer la migration 39
└── 39_down_update_type_items.sql        ← Annuler la migration 39
```

| Fichier | Rôle |
|---------|------|
| `NNb_snapshot_before_XX.sql` | Sauvegarde les tables impactées avant une migration destructrice |
| `XX_up_*.sql` | Applique la migration + s'enregistre dans `schema_migrations` |
| `XX_down_*.sql` | Restaure depuis le snapshot + retire l'enregistrement de `schema_migrations` |

## Ordre d'exécution pour une nouvelle migration

1. **Créer le snapshot** — `NNb_snapshot_before_XX.sql`
2. **Appliquer la migration** — `XX_up_*.sql`
3. **Si besoin d'annuler** — `XX_down_*.sql`

## Structure d'une migration Up

```sql
-- ============================================================================
-- XX. Nom de la migration
-- ============================================================================
-- Description de ce que fait la migration.
-- ============================================================================

-- Vos modifications SQL ici...

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('00XX', 'nom_migration')
ON CONFLICT (version) DO NOTHING;
```

## Structure d'une migration Down

```sql
-- ============================================================================
-- XX DOWN. Rollback de la migration XX
-- ============================================================================
-- Restaure l'état précédent depuis le snapshot.
-- ============================================================================

-- Restaurer les données depuis le snapshot
UPDATE ... FROM migration_XX_snapshot_... ;

-- Supprimer les lignes ajoutées par la migration
DELETE FROM ... WHERE ...;

-- Retirer la migration du tracking
DELETE FROM supabase_migrations.schema_migrations WHERE version = '00XX';
```

## Structure d'un Snapshot

```sql
-- Sauvegarder les tables qui seront modifiées
DROP TABLE IF EXISTS migration_XX_snapshot_table_a;
CREATE TABLE migration_XX_snapshot_table_a AS SELECT * FROM public.table_a;

-- Pour les remappings (UPDATE de données existantes) :
-- Sauvegarder uniquement les lignes qui seront modifiées
DROP TABLE IF EXISTS migration_XX_snapshot_table_b;
CREATE TABLE migration_XX_snapshot_table_b AS
  SELECT id, colonne_impactee FROM public.table_b WHERE ...;
```

Le snapshot est **conservé après rollback** (par sécurité). La suppression est manuelle et optionnelle.

## Règles importantes

- **Toujours faire un snapshot** avant une migration qui modifie des données existantes (UPDATE/DELETE).
- Les migrations qui ajoutent uniquement des nouvelles lignes (INSERT) ou créent des tables n'ont pas besoin de snapshot.
- **Pas de `supabase db reset`** pour un rollback ciblé — cela remet TOUT à zéro avec perte de données.
- **Pas de rollback natif** Supabase — le rollback est manuel via le script `down`.
- Le snapshot permet de restaurer les valeurs exactes qui existaient avant la migration.