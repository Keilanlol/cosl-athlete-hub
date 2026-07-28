-- ============================================================================
-- 50 UP. Correction des divergences enum Postgres / référentiel app_type_items
-- ============================================================================
-- 1. game_type : ajouter 'world_games' (présent dans app_type_items mais
--    absent de l'enum → toute création d'un Games de ce type échoue)
-- 2. accreditation_category : ajouter 'president' et 'secretary_general'
--    (ajoutés dans app_type_items par la migration 39 mais absents de l'enum)
-- 3. accreditation_status : l'enum contient 'produced' et 'delivered'
--    (supprimés du référentiel par la migration 39). Postgres ne permet pas
--    de retirer une valeur d'un enum. On convertit la colonne en text.
-- ============================================================================

-- ── 1. Ajouter 'world_games' à l'enum game_type ─────────────────────────────
ALTER TYPE public.game_type ADD VALUE IF NOT EXISTS 'world_games';

-- ── 2. Ajouter 'president' et 'secretary_general' à accreditation_category ──
ALTER TYPE public.accreditation_category ADD VALUE IF NOT EXISTS 'president';
ALTER TYPE public.accreditation_category ADD VALUE IF NOT EXISTS 'secretary_general';

-- ── 3. Convertir accreditations.status de enum vers text ────────────────────
-- L'enum accreditation_status contient 'produced' et 'delivered' qui ne sont
-- plus dans le référentiel. Postgres ne permet pas de retirer des valeurs
-- d'un enum. On convertit la colonne en text pour utiliser le référentiel
-- app_type_items comme unique source de vérité.
ALTER TABLE public.accreditations ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.accreditations ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.accreditations ALTER COLUMN status SET DEFAULT 'draft';

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0050', 'fix_enum_divergences')
ON CONFLICT (version) DO NOTHING;