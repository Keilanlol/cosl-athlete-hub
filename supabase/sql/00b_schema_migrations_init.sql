-- ============================================================================
-- 00b. Initialisation du suivi des migrations
-- ============================================================================
-- À exécuter une seule fois pour mettre en place le tracking.
-- Marque toutes les migrations 00 à 38 comme déjà appliquées.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS supabase_migrations;

CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version     TEXT PRIMARY KEY,
  name        TEXT,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Marquer les migrations déjà appliquées (00 à 38)
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('0000', 'fresh_install'),
  ('0001', 'init'),
  ('0002', 'storage'),
  ('0003', 'seed_auth_users'),
  ('0004', 'palmares'),
  ('0005', 'game_sport_disciplines'),
  ('0006', 'reference_data'),
  ('0007', 'athlete_appointments'),
  ('0008', 'message_recipients'),
  ('0009', 'seed_messages'),
  ('0010', 'documents_bucket'),
  ('0011', 'local_transport_passengers'),
  ('0012', 'rooming_allow_empty'),
  ('0013', 'federation_members'),
  ('0014', 'club_members'),
  ('0015', 'kyc_extended'),
  ('0016', 'age_competition'),
  ('0017', 'athlete_photo'),
  ('0018', 'clubs_address_fields'),
  ('0019', 'extended_address_fields'),
  ('0020', 'relax_athlete_fk'),
  ('0021', 'entity_images'),
  ('0022', 'club_members_photo'),
  ('0023', 'seed_entity_images'),
  ('0024', 'clubs_federation_nullable'),
  ('0025', 'reset_and_reseed'),
  ('0026', 'normalize_member_roles'),
  ('0027', 'reseed_reference_data'),
  ('0028', 'games_logo'),
  ('0029', 'games_real_logos'),
  ('0030', 'persons_superclass'),
  ('0031', 'game_volunteers_and_chief'),
  ('0032', 'sponsors_partners'),
  ('0033', 'admin_user_management'),
  ('0034', 'messages_sent_on_delete_set_null'),
  ('0035', 'fix_admin_create_account_pgcrypto_schema'),
  ('0036', 'username_generation_and_password_visibility'),
  ('0037', 'app_type_items'),
  ('0038', 'persons_in_games_view')
ON CONFLICT (version) DO NOTHING;

-- Vue de vérification
-- SELECT version, name, applied_at FROM supabase_migrations.schema_migrations ORDER BY version;