-- ============================================================================
-- COSLxBloobiz — Migration 09 : Seed enrichi des messages envoyés
-- Re-seed messages_sent avec IDs déterministes + message_recipients liés.
-- À exécuter APRÈS 08_message_recipients.sql et seed.sql.
--   psql -f supabase/sql/09_seed_messages.sql
-- ============================================================================

-- 1) Nettoyage des anciens envois (cascade -> message_recipients)
TRUNCATE public.message_recipients CASCADE;
DELETE FROM public.messages_sent;

-- 2) Réinsertion avec IDs explicites + sent_by
WITH sender AS (
  SELECT id FROM public.user_profiles WHERE username = 'claire.muller' LIMIT 1
),
sender_games AS (
  SELECT id FROM public.user_profiles WHERE username = 'laurent.carnol' LIMIT 1
)
INSERT INTO public.messages_sent
  (id, template_id, game_id, channel, subject, body, audience_segment, recipients_count, sent_by, sent_at)
VALUES
  ('ffffffff-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000001',
   '77777777-0000-0000-0000-000000000001',
   'email',
   'Convocation officielle JPEE 2027',
   E'Bonjour,\n\nNous avons le plaisir de vous convoquer pour les Jeux des Petits États d''Europe 2027 à Andorre. Merci de confirmer votre disponibilité avant le 15 du mois.\n\nL''équipe COSL.',
   E'Délégation Games · JPEE 2027 Andorre',
   30,
   (SELECT id FROM sender_games),
   now() - interval '90 days'),

  ('ffffffff-0000-0000-0000-000000000002',
   'eeeeeeee-0000-0000-0000-000000000004',
   '77777777-0000-0000-0000-000000000001',
   'email',
   'Félicitations ! Votre sélection JPEE 2027 est confirmée',
   E'Bonjour,\n\nFélicitations, votre sélection pour les JPEE 2027 est confirmée. Vous recevrez bientôt les informations logistiques.\n\nL''équipe COSL.',
   E'Délégation Games · JPEE 2027 Andorre',
   15,
   (SELECT id FROM sender_games),
   now() - interval '20 days'),

  ('ffffffff-0000-0000-0000-000000000003',
   'eeeeeeee-0000-0000-0000-000000000003',
   NULL,
   'email',
   'Documents manquants pour votre accréditation',
   E'Bonjour,\n\nIl manque encore certains documents (passeport, certificat médical) pour finaliser votre accréditation. Merci de les transmettre rapidement via votre espace personnel.',
   E'Tous les athlètes',
   8,
   (SELECT id FROM sender),
   now() - interval '10 days'),

  ('ffffffff-0000-0000-0000-000000000004',
   'eeeeeeee-0000-0000-0000-000000000002',
   '77777777-0000-0000-0000-000000000001',
   'email',
   'Briefing pré-départ JPEE 2027 - Informations importantes',
   E'Bonjour,\n\nLe briefing pré-départ JPEE 2027 aura lieu le 20 mai à 18h00 au COSL. Présence obligatoire.\n\nL''équipe COSL.',
   E'Délégation Games · JPEE 2027 Andorre',
   30,
   (SELECT id FROM sender_games),
   now() - interval '5 days'),

  ('ffffffff-0000-0000-0000-000000000005',
   'eeeeeeee-0000-0000-0000-000000000005',
   '77777777-0000-0000-0000-000000000005',
   'email',
   'Bilan et remerciements JOJ 2026',
   E'Bonjour,\n\nMerci pour votre engagement durant les JOJ 2026. Voici un bilan synthétique de la délégation luxembourgeoise.\n\nL''équipe COSL.',
   E'Délégation Games · JOJ 2026',
   12,
   (SELECT id FROM sender_games),
   now() - interval '180 days'),

  ('ffffffff-0000-0000-0000-000000000006',
   NULL,
   NULL,
   'email',
   'Newsletter COSL — Mai 2026',
   E'Bonjour,\n\nDécouvrez l''actualité du COSL ce mois-ci : préparation JPEE, résultats récents, et prochains événements.\n\nBonne lecture !',
   E'Tous les athlètes',
   40,
   (SELECT id FROM sender),
   now() - interval '15 days'),

  ('ffffffff-0000-0000-0000-000000000007',
   NULL,
   NULL,
   'sms',
   'Rappel rendez-vous médical',
   E'Rappel : votre rendez-vous médical de pré-saison est programmé cette semaine. Merci de confirmer votre venue.',
   E'Athlètes fédération · FLA',
   10,
   (SELECT id FROM sender),
   now() - interval '3 days');

-- 3) Liens message <-> athlètes (message_recipients)

-- Msg 1 (Convocation JPEE) : tous les sélectionnés/réserves JPEE 2027
INSERT INTO public.message_recipients (message_id, athlete_id)
SELECT DISTINCT 'ffffffff-0000-0000-0000-000000000001', s.athlete_id
FROM public.selections s
WHERE s.game_id = '77777777-0000-0000-0000-000000000001'
  AND s.status IN ('selected','reserve')
ON CONFLICT DO NOTHING;

-- Msg 2 (Sélection confirmée) : sélectionnés JPEE 2027 uniquement
INSERT INTO public.message_recipients (message_id, athlete_id)
SELECT DISTINCT 'ffffffff-0000-0000-0000-000000000002', s.athlete_id
FROM public.selections s
WHERE s.game_id = '77777777-0000-0000-0000-000000000001'
  AND s.status = 'selected'
ON CONFLICT DO NOTHING;

-- Msg 3 (Documents manquants) : 8 athlètes spécifiques
INSERT INTO public.message_recipients (message_id, athlete_id)
SELECT 'ffffffff-0000-0000-0000-000000000003', a.id
FROM public.athletes a
WHERE a.id IN (
  '66666666-0000-0000-0000-000000000004',
  '66666666-0000-0000-0000-000000000010',
  '66666666-0000-0000-0000-000000000037',
  '66666666-0000-0000-0000-000000000038',
  '66666666-0000-0000-0000-000000000039',
  '66666666-0000-0000-0000-000000000036',
  '66666666-0000-0000-0000-000000000007',
  '66666666-0000-0000-0000-000000000020'
)
ON CONFLICT DO NOTHING;

-- Msg 4 (Briefing pré-départ JPEE) : même audience que msg 1
INSERT INTO public.message_recipients (message_id, athlete_id)
SELECT DISTINCT 'ffffffff-0000-0000-0000-000000000004', s.athlete_id
FROM public.selections s
WHERE s.game_id = '77777777-0000-0000-0000-000000000001'
  AND s.status IN ('selected','reserve')
ON CONFLICT DO NOTHING;

-- Msg 5 (Bilan JOJ 2026) : sélectionnés JOJ 2026
INSERT INTO public.message_recipients (message_id, athlete_id)
SELECT DISTINCT 'ffffffff-0000-0000-0000-000000000005', s.athlete_id
FROM public.selections s
WHERE s.game_id = '77777777-0000-0000-0000-000000000005'
  AND s.status IN ('selected','reserve')
ON CONFLICT DO NOTHING;

-- Msg 6 (Newsletter) : tous les athlètes actifs
INSERT INTO public.message_recipients (message_id, athlete_id)
SELECT 'ffffffff-0000-0000-0000-000000000006', a.id
FROM public.athletes a
WHERE a.is_active = true
ON CONFLICT DO NOTHING;

-- Msg 7 (Rappel médical FLA) : athlètes affiliés à la FLA (Athlétisme)
INSERT INTO public.message_recipients (message_id, athlete_id)
SELECT 'ffffffff-0000-0000-0000-000000000007', a.id
FROM public.athletes a
JOIN public.federations f ON f.id = a.primary_federation_id
WHERE a.is_active = true
  AND (f.code = 'FLA' OR f.name ILIKE '%athlétisme%')
ON CONFLICT DO NOTHING;

-- 4) Synchroniser recipients_count avec le nombre réel de destinataires
UPDATE public.messages_sent m
SET recipients_count = sub.cnt
FROM (
  SELECT message_id, COUNT(*)::int AS cnt
  FROM public.message_recipients
  GROUP BY message_id
) sub
WHERE m.id = sub.message_id;

-- Vérification
SELECT m.subject, m.audience_segment, m.recipients_count, m.sent_at::date
FROM public.messages_sent m
ORDER BY m.sent_at DESC;
