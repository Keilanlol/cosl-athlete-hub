-- ============================================================================
-- COSLxBloobiz — Seed mockup réaliste
-- À appliquer après 01_init.sql et 02_storage.sql
--   psql -f supabase/seed.sql
-- ============================================================================
-- IDs préfixés par type pour faciliter les références :
--   1xxx = federations, 2xxx = sports, 3xxx = disciplines, 4xxx = clubs,
--   5xxx = coaches,     6xxx = athletes, 7xxx = games,
--   8xxx = accred_types, 9xxx = accreditations,
--   axxx = delegations, bxxx = travel_plans, cxxx = flights,
--   dxxx = accommodations, exxx = message_templates
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. USER PROFILES (seulement si auth.users existe déjà pour ces emails)
-- ============================================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('felix.retter','Felix Retter','admin'),
    ('laurent.carnol','Laurent Carnol','games_manager'),
    ('sophie.weber','Sophie Weber','fed_manager'),
    ('marc.dupont','Marc Dupont','logistics'),
    ('claire.muller','Claire Muller','communication')
  ) AS t(username, full_name, role) LOOP
    INSERT INTO public.user_profiles (id, username, full_name, email, role)
    SELECT u.id, r.username, r.full_name, u.email, r.role::public.user_role
    FROM auth.users u
    WHERE u.email = r.username || '@coslbloobiz.local'
    ON CONFLICT (id) DO UPDATE
      SET role = EXCLUDED.role,
          full_name = EXCLUDED.full_name,
          username = EXCLUDED.username;
  END LOOP;
END $$;

-- ============================================================================
-- 2. SPORTS
-- ============================================================================
INSERT INTO public.sports (id, name, is_olympic, is_summer) VALUES
  ('22222222-0000-0000-0000-000000000001','Athlétisme',     true, true),
  ('22222222-0000-0000-0000-000000000002','Natation',       true, true),
  ('22222222-0000-0000-0000-000000000003','Cyclisme',       true, true),
  ('22222222-0000-0000-0000-000000000004','Judo',           true, true),
  ('22222222-0000-0000-0000-000000000005','Tennis',         true, true),
  ('22222222-0000-0000-0000-000000000006','Tir à l''Arc',   true, true),
  ('22222222-0000-0000-0000-000000000007','Triathlon',      true, true),
  ('22222222-0000-0000-0000-000000000008','Ski Alpin',      true, false),
  ('22222222-0000-0000-0000-000000000009','Patinage',       true, false),
  ('22222222-0000-0000-0000-000000000010','Tennis de Table',true, true);

-- ============================================================================
-- 3. DISCIPLINES (33)
-- ============================================================================
INSERT INTO public.disciplines (id, sport_id, name, gender) VALUES
  -- Athlétisme
  ('33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','100m','male'),
  ('33333333-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001','100m','female'),
  ('33333333-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000001','200m','male'),
  ('33333333-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000001','200m','female'),
  ('33333333-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000001','5000m','male'),
  ('33333333-0000-0000-0000-000000000006','22222222-0000-0000-0000-000000000001','5000m','female'),
  ('33333333-0000-0000-0000-000000000007','22222222-0000-0000-0000-000000000001','Marathon','male'),
  ('33333333-0000-0000-0000-000000000008','22222222-0000-0000-0000-000000000001','Marathon','female'),
  ('33333333-0000-0000-0000-000000000009','22222222-0000-0000-0000-000000000001','Saut en hauteur','male'),
  ('33333333-0000-0000-0000-000000000010','22222222-0000-0000-0000-000000000001','Saut en hauteur','female'),
  -- Natation
  ('33333333-0000-0000-0000-000000000011','22222222-0000-0000-0000-000000000002','50m libre','male'),
  ('33333333-0000-0000-0000-000000000012','22222222-0000-0000-0000-000000000002','50m libre','female'),
  ('33333333-0000-0000-0000-000000000013','22222222-0000-0000-0000-000000000002','100m libre','male'),
  ('33333333-0000-0000-0000-000000000014','22222222-0000-0000-0000-000000000002','100m libre','female'),
  ('33333333-0000-0000-0000-000000000015','22222222-0000-0000-0000-000000000002','200m papillon','male'),
  ('33333333-0000-0000-0000-000000000016','22222222-0000-0000-0000-000000000002','200m papillon','female'),
  ('33333333-0000-0000-0000-000000000017','22222222-0000-0000-0000-000000000002','4x100m relais','mixed'),
  -- Cyclisme
  ('33333333-0000-0000-0000-000000000018','22222222-0000-0000-0000-000000000003','Course en ligne','male'),
  ('33333333-0000-0000-0000-000000000019','22222222-0000-0000-0000-000000000003','Course en ligne','female'),
  ('33333333-0000-0000-0000-000000000020','22222222-0000-0000-0000-000000000003','Contre-la-montre','male'),
  ('33333333-0000-0000-0000-000000000021','22222222-0000-0000-0000-000000000003','Contre-la-montre','female'),
  -- Judo
  ('33333333-0000-0000-0000-000000000022','22222222-0000-0000-0000-000000000004','-60kg','male'),
  ('33333333-0000-0000-0000-000000000023','22222222-0000-0000-0000-000000000004','-73kg','male'),
  ('33333333-0000-0000-0000-000000000024','22222222-0000-0000-0000-000000000004','-90kg','male'),
  ('33333333-0000-0000-0000-000000000025','22222222-0000-0000-0000-000000000004','-52kg','female'),
  ('33333333-0000-0000-0000-000000000026','22222222-0000-0000-0000-000000000004','-63kg','female'),
  ('33333333-0000-0000-0000-000000000027','22222222-0000-0000-0000-000000000004','-78kg','female'),
  -- Tennis
  ('33333333-0000-0000-0000-000000000028','22222222-0000-0000-0000-000000000005','Simple','male'),
  ('33333333-0000-0000-0000-000000000029','22222222-0000-0000-0000-000000000005','Simple','female'),
  ('33333333-0000-0000-0000-000000000030','22222222-0000-0000-0000-000000000005','Double mixte','mixed'),
  -- Triathlon
  ('33333333-0000-0000-0000-000000000031','22222222-0000-0000-0000-000000000007','Individuel','male'),
  ('33333333-0000-0000-0000-000000000032','22222222-0000-0000-0000-000000000007','Individuel','female'),
  ('33333333-0000-0000-0000-000000000033','22222222-0000-0000-0000-000000000007','Relais mixte','mixed');

-- ============================================================================
-- 4. FÉDÉRATIONS (15)
-- ============================================================================
INSERT INTO public.federations (id, acronym, name, president_name, contact_email, contact_phone, is_olympic) VALUES
  ('11111111-0000-0000-0000-000000000001','FLA',   'Fédération Luxembourgeoise d''Athlétisme',                'Pol Mellina',         'pol.mellina@fla.lu',         '+352 27 12 34 01', true),
  ('11111111-0000-0000-0000-000000000002','FLNS',  'Fédération Luxembourgeoise de Natation et de Sauvetage',  'Marc Hostert',        'contact@flns.lu',            '+352 27 12 34 02', true),
  ('11111111-0000-0000-0000-000000000003','FSCL',  'Fédération du Sport Cycliste Luxembourgeois',             'Camille Schwartz',    'info@fscl.lu',               '+352 27 12 34 03', true),
  ('11111111-0000-0000-0000-000000000004','FLJudo','Fédération Luxembourgeoise de Judo',                      'Jeannot Reuter',      'contact@fljudo.lu',          '+352 27 12 34 04', true),
  ('11111111-0000-0000-0000-000000000005','FLT',   'Fédération Luxembourgeoise de Tennis',                    'Pascale Hoffmann',    'info@flt.lu',                '+352 27 12 34 05', true),
  ('11111111-0000-0000-0000-000000000006','FLTA',  'Fédération Luxembourgeoise de Tir à l''Arc',              'Jean-Marc Bertemes',  'contact@flta.lu',            '+352 27 12 34 06', true),
  ('11111111-0000-0000-0000-000000000007','FLTRI', 'Fédération Luxembourgeoise de Triathlon',                 'Sophie Klein',        'info@fltri.lu',              '+352 27 12 34 07', true),
  ('11111111-0000-0000-0000-000000000008','FLS',   'Fédération Luxembourgeoise de Ski',                       'Romain Wagner',       'contact@fls.lu',             '+352 27 12 34 08', true),
  ('11111111-0000-0000-0000-000000000009','FLSG',  'Fédération Luxembourgeoise des Sports de Glace',          'Tania Folscheid',     'info@flsg.lu',               '+352 27 12 34 09', true),
  ('11111111-0000-0000-0000-000000000010','FLTT',  'Fédération Luxembourgeoise de Tennis de Table',           'Luc Theis',           'contact@fltt.lu',            '+352 27 12 34 10', true),
  ('11111111-0000-0000-0000-000000000011','FLBB',  'Fédération Luxembourgeoise de Basketball',                'Patrick Frising',     'info@flbb.lu',               '+352 27 12 34 11', true),
  ('11111111-0000-0000-0000-000000000012','FLF',   'Fédération Luxembourgeoise du Football',                  'Paul Philipp',        'contact@flf.lu',             '+352 27 12 34 12', true),
  ('11111111-0000-0000-0000-000000000013','FLVB',  'Fédération Luxembourgeoise de Volleyball',                'Marc Dax',            'info@flvb.lu',               '+352 27 12 34 13', true),
  ('11111111-0000-0000-0000-000000000014','FLH',   'Fédération Luxembourgeoise de Handball',                  'Romain Hoffmann',     'contact@flh.lu',             '+352 27 12 34 14', true),
  ('11111111-0000-0000-0000-000000000015','FLGYM', 'Fédération Luxembourgeoise de Gymnastique',               'Charel Stelmes',      'info@flgym.lu',              '+352 27 12 34 15', true);

-- ============================================================================
-- 5. CLUBS (30)
-- ============================================================================
INSERT INTO public.clubs (id, name, federation_id, city, email, phone) VALUES
  ('44444444-0000-0000-0000-000000000001','CSL Luxembourg-Ville',           '11111111-0000-0000-0000-000000000001','Luxembourg',         'contact@csl.lu',         '+352 26 11 01 01'),
  ('44444444-0000-0000-0000-000000000002','Athletic Club Luxembourg',       '11111111-0000-0000-0000-000000000001','Luxembourg',         'info@acl.lu',            '+352 26 11 01 02'),
  ('44444444-0000-0000-0000-000000000003','CAEG Schifflange',               '11111111-0000-0000-0000-000000000001','Schifflange',        'contact@caeg.lu',        '+352 26 11 01 03'),
  ('44444444-0000-0000-0000-000000000004','Cercle Nautique Luxembourgeois', '11111111-0000-0000-0000-000000000002','Luxembourg',         'contact@cnl.lu',         '+352 26 11 02 01'),
  ('44444444-0000-0000-0000-000000000005','Schwammclub Esch',               '11111111-0000-0000-0000-000000000002','Esch-sur-Alzette',   'info@scesch.lu',         '+352 26 11 02 02'),
  ('44444444-0000-0000-0000-000000000006','SC Le Dauphin',                  '11111111-0000-0000-0000-000000000002','Diekirch',           'contact@dauphin.lu',     '+352 26 11 02 03'),
  ('44444444-0000-0000-0000-000000000007','ACC Contern',                    '11111111-0000-0000-0000-000000000003','Contern',            'info@accontern.lu',      '+352 26 11 03 01'),
  ('44444444-0000-0000-0000-000000000008','LC Tétange',                     '11111111-0000-0000-0000-000000000003','Tétange',            'contact@lctetange.lu',   '+352 26 11 03 02'),
  ('44444444-0000-0000-0000-000000000009','VC Diekirch',                    '11111111-0000-0000-0000-000000000003','Diekirch',           'info@vcdiekirch.lu',     '+352 26 11 03 03'),
  ('44444444-0000-0000-0000-000000000010','Judo Club Schifflange',          '11111111-0000-0000-0000-000000000004','Schifflange',        'contact@jcschiff.lu',    '+352 26 11 04 01'),
  ('44444444-0000-0000-0000-000000000011','Judo Strassen',                  '11111111-0000-0000-0000-000000000004','Strassen',           'info@judostrassen.lu',   '+352 26 11 04 02'),
  ('44444444-0000-0000-0000-000000000012','Judo Club Esch',                 '11111111-0000-0000-0000-000000000004','Esch-sur-Alzette',   'contact@jcesch.lu',      '+352 26 11 04 03'),
  ('44444444-0000-0000-0000-000000000013','TC Howald',                      '11111111-0000-0000-0000-000000000005','Howald',             'info@tchowald.lu',       '+352 26 11 05 01'),
  ('44444444-0000-0000-0000-000000000014','TC Esch',                        '11111111-0000-0000-0000-000000000005','Esch-sur-Alzette',   'contact@tcesch.lu',      '+352 26 11 05 02'),
  ('44444444-0000-0000-0000-000000000015','Tennis Club Mamer',              '11111111-0000-0000-0000-000000000005','Mamer',              'info@tcmamer.lu',        '+352 26 11 05 03'),
  ('44444444-0000-0000-0000-000000000016','Archery Club Mamer',             '11111111-0000-0000-0000-000000000006','Mamer',              'contact@acmamer.lu',     '+352 26 11 06 01'),
  ('44444444-0000-0000-0000-000000000017','Compagnie d''Arc Luxembourg',    '11111111-0000-0000-0000-000000000006','Luxembourg',         'info@cal.lu',            '+352 26 11 06 02'),
  ('44444444-0000-0000-0000-000000000018','Tri Lux Diekirch',               '11111111-0000-0000-0000-000000000007','Diekirch',           'contact@trilux.lu',      '+352 26 11 07 01'),
  ('44444444-0000-0000-0000-000000000019','Tri Esch',                       '11111111-0000-0000-0000-000000000007','Esch-sur-Alzette',   'info@triesch.lu',        '+352 26 11 07 02'),
  ('44444444-0000-0000-0000-000000000020','Ski Club Luxembourg',            '11111111-0000-0000-0000-000000000008','Luxembourg',         'contact@scl.lu',         '+352 26 11 08 01'),
  ('44444444-0000-0000-0000-000000000021','Ski Club Differdange',           '11111111-0000-0000-0000-000000000008','Differdange',        'info@scdiff.lu',         '+352 26 11 08 02'),
  ('44444444-0000-0000-0000-000000000022','Patinage Club Kockelscheuer',    '11111111-0000-0000-0000-000000000009','Kockelscheuer',      'contact@pck.lu',         '+352 26 11 09 01'),
  ('44444444-0000-0000-0000-000000000023','Tennis de Table Bettembourg',    '11111111-0000-0000-0000-000000000010','Bettembourg',        'info@ttbett.lu',         '+352 26 11 10 01'),
  ('44444444-0000-0000-0000-000000000024','DT Echternach',                  '11111111-0000-0000-0000-000000000010','Echternach',         'contact@dtech.lu',       '+352 26 11 10 02'),
  ('44444444-0000-0000-0000-000000000025','Basket Esch',                    '11111111-0000-0000-0000-000000000011','Esch-sur-Alzette',   'info@basketesch.lu',     '+352 26 11 11 01'),
  ('44444444-0000-0000-0000-000000000026','F91 Dudelange',                  '11111111-0000-0000-0000-000000000012','Dudelange',          'contact@f91.lu',         '+352 26 11 12 01'),
  ('44444444-0000-0000-0000-000000000027','Volley Strassen',                '11111111-0000-0000-0000-000000000013','Strassen',           'info@vstrassen.lu',      '+352 26 11 13 01'),
  ('44444444-0000-0000-0000-000000000028','HB Käerjeng',                    '11111111-0000-0000-0000-000000000014','Bascharage',         'contact@hbkaer.lu',      '+352 26 11 14 01'),
  ('44444444-0000-0000-0000-000000000029','Gym Club Strassen',              '11111111-0000-0000-0000-000000000015','Strassen',           'info@gcstrassen.lu',     '+352 26 11 15 01'),
  ('44444444-0000-0000-0000-000000000030','CGD Bonnevoie',                  '11111111-0000-0000-0000-000000000015','Luxembourg',         'contact@cgd.lu',         '+352 26 11 15 02');

-- ============================================================================
-- 6. COACHES (22)
-- ============================================================================
INSERT INTO public.coaches (id, first_name, last_name, email, phone, role, federation_id, club_id) VALUES
  ('55555555-0000-0000-0000-000000000001','Marc',     'Lambert',   'marc.lambert@fla.lu',     '+352 621 11 01 01','coach',     '11111111-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000002'),
  ('55555555-0000-0000-0000-000000000002','Claude',   'Reinesch',  'claude.r@fla.lu',         '+352 621 11 01 02','coach',     '11111111-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000001'),
  ('55555555-0000-0000-0000-000000000003','Pierre',   'Schmitt',   'pierre.s@fljudo.lu',      '+352 621 11 04 01','coach',     '11111111-0000-0000-0000-000000000004','44444444-0000-0000-0000-000000000010'),
  ('55555555-0000-0000-0000-000000000004','Anne',     'Dubois',    'anne.dubois@flns.lu',     '+352 621 11 02 01','medical',   '11111111-0000-0000-0000-000000000002','44444444-0000-0000-0000-000000000004'),
  ('55555555-0000-0000-0000-000000000005','François', 'Klein',     'francois.k@flns.lu',      '+352 621 11 02 02','coach',     '11111111-0000-0000-0000-000000000002','44444444-0000-0000-0000-000000000005'),
  ('55555555-0000-0000-0000-000000000006','Jean-Paul','Mertens',   'jp.mertens@fscl.lu',      '+352 621 11 03 01','coach',     '11111111-0000-0000-0000-000000000003','44444444-0000-0000-0000-000000000007'),
  ('55555555-0000-0000-0000-000000000007','Sandra',   'Reuter',    's.reuter@fscl.lu',        '+352 621 11 03 02','coach',     '11111111-0000-0000-0000-000000000003','44444444-0000-0000-0000-000000000008'),
  ('55555555-0000-0000-0000-000000000008','Tom',      'Hoffmann',  'tom.h@flt.lu',            '+352 621 11 05 01','coach',     '11111111-0000-0000-0000-000000000005','44444444-0000-0000-0000-000000000013'),
  ('55555555-0000-0000-0000-000000000009','Patricia', 'Wagner',    'p.wagner@flt.lu',         '+352 621 11 05 02','coach',     '11111111-0000-0000-0000-000000000005','44444444-0000-0000-0000-000000000014'),
  ('55555555-0000-0000-0000-000000000010','Roland',   'Bertemes',  'r.bertemes@flta.lu',      '+352 621 11 06 01','coach',     '11111111-0000-0000-0000-000000000006','44444444-0000-0000-0000-000000000016'),
  ('55555555-0000-0000-0000-000000000011','Emmanuel', 'Folscheid', 'e.folscheid@fltri.lu',    '+352 621 11 07 01','coach',     '11111111-0000-0000-0000-000000000007','44444444-0000-0000-0000-000000000018'),
  ('55555555-0000-0000-0000-000000000012','Martine',  'Schneider', 'm.schneider@fls.lu',      '+352 621 11 08 01','coach',     '11111111-0000-0000-0000-000000000008','44444444-0000-0000-0000-000000000020'),
  ('55555555-0000-0000-0000-000000000013','Yves',     'Klein',     'yves.k@flsg.lu',          '+352 621 11 09 01','coach',     '11111111-0000-0000-0000-000000000009','44444444-0000-0000-0000-000000000022'),
  ('55555555-0000-0000-0000-000000000014','Nathalie', 'Theis',     'n.theis@fltt.lu',         '+352 621 11 10 01','coach',     '11111111-0000-0000-0000-000000000010','44444444-0000-0000-0000-000000000023'),
  ('55555555-0000-0000-0000-000000000015','Dr. Henri','Becker',    'h.becker@cosl.lu',        '+352 621 11 99 01','medical',   '11111111-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000001'),
  ('55555555-0000-0000-0000-000000000016','Dr. Lucie','Vogel',     'l.vogel@cosl.lu',         '+352 621 11 99 02','medical',   '11111111-0000-0000-0000-000000000004','44444444-0000-0000-0000-000000000010'),
  ('55555555-0000-0000-0000-000000000017','Georges',  'Mathay',    'g.mathay@cosl.lu',        '+352 621 11 99 03','chief_of_mission', '11111111-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000001'),
  ('55555555-0000-0000-0000-000000000018','Isabelle', 'Origer',    'i.origer@cosl.lu',        '+352 621 11 99 04','press',     '11111111-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000001'),
  ('55555555-0000-0000-0000-000000000019','Frank',    'Goebel',    'f.goebel@cosl.lu',        '+352 621 11 99 05','manager',   '11111111-0000-0000-0000-000000000005','44444444-0000-0000-0000-000000000013'),
  ('55555555-0000-0000-0000-000000000020','Carine',   'Muller',    'c.muller@flgym.lu',       '+352 621 11 15 01','coach',     '11111111-0000-0000-0000-000000000015','44444444-0000-0000-0000-000000000029'),
  ('55555555-0000-0000-0000-000000000021','Sven',     'Eischen',   's.eischen@cosl.lu',       '+352 621 11 99 06','official',  '11111111-0000-0000-0000-000000000003','44444444-0000-0000-0000-000000000007'),
  ('55555555-0000-0000-0000-000000000022','Gilles',   'Reding',    'g.reding@cosl.lu',        '+352 621 11 99 07','coach',     '11111111-0000-0000-0000-000000000002','44444444-0000-0000-0000-000000000004');

-- ============================================================================
-- 7. ATHLETES (40)
--   a01-a08 Athlétisme | a09-a14 Natation | a15-a20 Cyclisme | a21-a26 Judo
--   a27-a30 Tennis     | a31-a32 Tir Arc  | a33-a35 Triathlon | a36-a37 Ski
--   a38 Patinage       | a39-a40 TT
--   Niveaux : a01-a05 olympic_contract | a06-a13 elite | a14-a28 promotion | a29-a40 espoir
--   Statuts : majoritairement active, a08 injured, a14 injured, a37 retired, a01 ambassador, a40 retired
-- ============================================================================
INSERT INTO public.athletes (id, cosl_id, first_name, last_name, birth_date, gender, nationality, sport_nationality, email, phone, photo_url, primary_sport_id, primary_federation_id, current_club_id, status, level, size_clothing, size_shoes, license_number, passport_number, passport_expiry, is_active) VALUES
  ('66666666-0000-0000-0000-000000000001','COSL-2026-0001','Charel',  'Schmit',     '1995-03-12','male',  'LUX','LUX','charel.schmit@athletes.lu','+352 621 00 00 01','https://i.pravatar.cc/150?u=cosl1','22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000001','ambassador','olympic_contract','M','42','LIC-A001','LU1234501','2030-06-30',true),
  ('66666666-0000-0000-0000-000000000002','COSL-2026-0002','Bob',     'Jungers',    '1997-07-04','male',  'LUX','LUX','bob.jungers@athletes.lu','+352 621 00 00 02','https://i.pravatar.cc/150?u=cosl2','22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000002','active','olympic_contract','L','44','LIC-A002','LU1234502','2029-08-15',true),
  ('66666666-0000-0000-0000-000000000003','COSL-2026-0003','Yann',    'Hoffmann',   '1999-11-21','male',  'LUX','LUX','yann.hoffmann@athletes.lu','+352 621 00 00 03','https://i.pravatar.cc/150?u=cosl3','22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000003','active','olympic_contract','M','43','LIC-A003','LU1234503','2031-01-10',true),
  ('66666666-0000-0000-0000-000000000004','COSL-2026-0004','Tom',     'Bertemes',   '2001-02-18','male',  'LUX','LUX','tom.bertemes@athletes.lu','+352 621 00 00 04','https://i.pravatar.cc/150?u=cosl4','22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000001','active','olympic_contract','M','42','LIC-A004','LU1234504','2030-03-22',true),
  ('66666666-0000-0000-0000-000000000005','COSL-2026-0005','Anouk',   'Schmit',     '1996-09-30','female','LUX','LUX','anouk.schmit@athletes.lu','+352 621 00 00 05','https://i.pravatar.cc/150?u=cosl5','22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000002','active','olympic_contract','S','38','LIC-A005','LU1234505','2029-11-05',true),
  ('66666666-0000-0000-0000-000000000006','COSL-2026-0006','Sarah',   'Lentz',      '1998-06-14','female','LUX','LUX','sarah.lentz@athletes.lu','+352 621 00 00 06','https://i.pravatar.cc/150?u=cosl6','22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000003','active','elite','M','39','LIC-A006','LU1234506','2030-09-12',true),
  ('66666666-0000-0000-0000-000000000007','COSL-2026-0007','Lisa',    'Bertemes',   '2000-04-25','female','LUX','LUX','lisa.bertemes@athletes.lu','+352 621 00 00 07','https://i.pravatar.cc/150?u=cosl7','22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000001','active','elite','S','37','LIC-A007','LU1234507','2031-04-18',true),
  ('66666666-0000-0000-0000-000000000008','COSL-2026-0008','Julie',   'Hoffmann',   '2002-08-07','female','LUX','FRA','julie.hoffmann@athletes.lu','+352 621 00 00 08','https://i.pravatar.cc/150?u=cosl8','22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000002','injured','elite','M','38','LIC-A008','LU1234508','2030-12-01',true),
  -- Natation
  ('66666666-0000-0000-0000-000000000009','COSL-2026-0009','Luc',     'Wagner',     '1998-05-19','male',  'LUX','LUX','luc.wagner@athletes.lu','+352 621 00 00 09','https://i.pravatar.cc/150?u=cosl9','22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000002','44444444-0000-0000-0000-000000000004','active','elite','L','44','LIC-A009','LU1234509','2029-07-23',true),
  ('66666666-0000-0000-0000-000000000010','COSL-2026-0010','Mike',    'Folkmer',    '1999-12-02','male',  'LUX','LUX','mike.folkmer@athletes.lu','+352 621 00 00 10','https://i.pravatar.cc/150?u=cosl10','22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000002','44444444-0000-0000-0000-000000000005','active','elite','L','45','LIC-A010','LU1234510','2030-02-14',true),
  ('66666666-0000-0000-0000-000000000011','COSL-2026-0011','Pol',     'Reuter',     '2001-03-08','male',  'LUX','BEL','pol.reuter@athletes.lu','+352 621 00 00 11','https://i.pravatar.cc/150?u=cosl11','22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000002','44444444-0000-0000-0000-000000000006','active','promotion','M','43','LIC-A011','LU1234511','2031-05-30',true),
  ('66666666-0000-0000-0000-000000000012','COSL-2026-0012','Charlotte','Wagner',    '1997-10-16','female','LUX','LUX','charlotte.wagner@athletes.lu','+352 621 00 00 12','https://i.pravatar.cc/150?u=cosl12','22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000002','44444444-0000-0000-0000-000000000004','active','elite','S','38','LIC-A012','LU1234512','2029-09-09',true),
  ('66666666-0000-0000-0000-000000000013','COSL-2026-0013','Amélie',  'Folkmer',    '2000-01-27','female','LUX','LUX','amelie.folkmer@athletes.lu','+352 621 00 00 13','https://i.pravatar.cc/150?u=cosl13','22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000002','44444444-0000-0000-0000-000000000005','active','elite','M','39','LIC-A013','LU1234513','2030-06-12',true),
  ('66666666-0000-0000-0000-000000000014','COSL-2026-0014','Léa',     'Reuter',     '2003-07-19','female','LUX','LUX','lea.reuter@athletes.lu','+352 621 00 00 14','https://i.pravatar.cc/150?u=cosl14','22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000002','44444444-0000-0000-0000-000000000006','injured','promotion','S','37','LIC-A014','LU1234514','2031-08-21',true),
  -- Cyclisme
  ('66666666-0000-0000-0000-000000000015','COSL-2026-0015','Romain',  'Schneider',  '1994-04-11','male',  'LUX','LUX','romain.schneider@athletes.lu','+352 621 00 00 15','https://i.pravatar.cc/150?u=cosl15','22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000003','44444444-0000-0000-0000-000000000007','active','elite','M','43','LIC-A015','LU1234515','2029-12-05',true),
  ('66666666-0000-0000-0000-000000000016','COSL-2026-0016','Felix',   'Klein',      '1996-08-22','male',  'LUX','LUX','felix.klein@athletes.lu','+352 621 00 00 16','https://i.pravatar.cc/150?u=cosl16','22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000003','44444444-0000-0000-0000-000000000008','active','promotion','M','42','LIC-A016','LU1234516','2030-04-14',true),
  ('66666666-0000-0000-0000-000000000017','COSL-2026-0017','Marc',    'Wilmes',     '1999-02-09','male',  'LUX','POR','marc.wilmes@athletes.lu','+352 621 00 00 17','https://i.pravatar.cc/150?u=cosl17','22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000003','44444444-0000-0000-0000-000000000009','active','promotion','L','44','LIC-A017','LU1234517','2031-02-28',true),
  ('66666666-0000-0000-0000-000000000018','COSL-2026-0018','Camille', 'Schneider',  '1997-06-03','female','LUX','LUX','camille.schneider@athletes.lu','+352 621 00 00 18','https://i.pravatar.cc/150?u=cosl18','22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000003','44444444-0000-0000-0000-000000000007','active','elite','M','39','LIC-A018','LU1234518','2029-10-19',true),
  ('66666666-0000-0000-0000-000000000019','COSL-2026-0019','Clara',   'Klein',      '2000-11-28','female','LUX','LUX','clara.klein@athletes.lu','+352 621 00 00 19','https://i.pravatar.cc/150?u=cosl19','22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000003','44444444-0000-0000-0000-000000000008','active','promotion','S','38','LIC-A019','LU1234519','2030-08-08',true),
  ('66666666-0000-0000-0000-000000000020','COSL-2026-0020','Sophie',  'Wilmes',     '2002-05-15','female','LUX','LUX','sophie.wilmes@athletes.lu','+352 621 00 00 20','https://i.pravatar.cc/150?u=cosl20','22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000003','44444444-0000-0000-0000-000000000009','active','promotion','S','37','LIC-A020','LU1234520','2031-06-02',true),
  -- Judo
  ('66666666-0000-0000-0000-000000000021','COSL-2026-0021','Patrick', 'Schmitt',    '1995-09-17','male',  'LUX','LUX','patrick.schmitt@athletes.lu','+352 621 00 00 21','https://i.pravatar.cc/150?u=cosl21','22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000004','44444444-0000-0000-0000-000000000010','active','elite','M','42','LIC-A021','LU1234521','2029-11-23',true),
  ('66666666-0000-0000-0000-000000000022','COSL-2026-0022','Christophe','Wagner',   '1998-12-05','male',  'LUX','LUX','christophe.wagner@athletes.lu','+352 621 00 00 22','https://i.pravatar.cc/150?u=cosl22','22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000004','44444444-0000-0000-0000-000000000011','active','promotion','L','44','LIC-A022','LU1234522','2030-05-17',true),
  ('66666666-0000-0000-0000-000000000023','COSL-2026-0023','Nicolas', 'Reuter',     '2001-04-29','male',  'LUX','LUX','nicolas.reuter@athletes.lu','+352 621 00 00 23','https://i.pravatar.cc/150?u=cosl23','22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000004','44444444-0000-0000-0000-000000000012','active','promotion','L','45','LIC-A023','LU1234523','2031-03-13',true),
  ('66666666-0000-0000-0000-000000000024','COSL-2026-0024','Emma',    'Schmitt',    '1996-07-08','female','LUX','LUX','emma.schmitt@athletes.lu','+352 621 00 00 24','https://i.pravatar.cc/150?u=cosl24','22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000004','44444444-0000-0000-0000-000000000010','active','promotion','S','38','LIC-A024','LU1234524','2029-12-30',true),
  ('66666666-0000-0000-0000-000000000025','COSL-2026-0025','Laura',   'Wagner',     '1999-10-12','female','LUX','LUX','laura.wagner@athletes.lu','+352 621 00 00 25','https://i.pravatar.cc/150?u=cosl25','22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000004','44444444-0000-0000-0000-000000000011','active','promotion','M','39','LIC-A025','LU1234525','2030-07-25',true),
  ('66666666-0000-0000-0000-000000000026','COSL-2026-0026','Mia',     'Reuter',     '2002-01-03','female','LUX','LUX','mia.reuter@athletes.lu','+352 621 00 00 26','https://i.pravatar.cc/150?u=cosl26','22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000004','44444444-0000-0000-0000-000000000012','active','promotion','S','38','LIC-A026','LU1234526','2031-04-04',true),
  -- Tennis
  ('66666666-0000-0000-0000-000000000027','COSL-2026-0027','Alex',    'Folkmer',    '1997-03-21','male',  'LUX','LUX','alex.folkmer@athletes.lu','+352 621 00 00 27','https://i.pravatar.cc/150?u=cosl27','22222222-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000005','44444444-0000-0000-0000-000000000013','active','promotion','M','43','LIC-A027','LU1234527','2030-01-19',true),
  ('66666666-0000-0000-0000-000000000028','COSL-2026-0028','Jo',      'Schaeffer',  '2000-06-26','male',  'LUX','LUX','jo.schaeffer@athletes.lu','+352 621 00 00 28','https://i.pravatar.cc/150?u=cosl28','22222222-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000005','44444444-0000-0000-0000-000000000014','active','promotion','M','42','LIC-A028','LU1234528','2031-09-11',true),
  ('66666666-0000-0000-0000-000000000029','COSL-2026-0029','Eva',     'Hoffmann',   '1998-09-04','female','LUX','LUX','eva.hoffmann@athletes.lu','+352 621 00 00 29','https://i.pravatar.cc/150?u=cosl29','22222222-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000005','44444444-0000-0000-0000-000000000013','active','espoir','S','38','LIC-A029','LU1234529','2030-03-07',true),
  ('66666666-0000-0000-0000-000000000030','COSL-2026-0030','Maya',    'Wagner',     '2001-11-15','female','LUX','LUX','maya.wagner@athletes.lu','+352 621 00 00 30','https://i.pravatar.cc/150?u=cosl30','22222222-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000005','44444444-0000-0000-0000-000000000015','active','espoir','S','37','LIC-A030','LU1234530','2031-12-22',true),
  -- Tir Arc
  ('66666666-0000-0000-0000-000000000031','COSL-2026-0031','Jeff',    'Bertemes',   '1996-02-14','male',  'LUX','LUX','jeff.bertemes@athletes.lu','+352 621 00 00 31','https://i.pravatar.cc/150?u=cosl31','22222222-0000-0000-0000-000000000006','11111111-0000-0000-0000-000000000006','44444444-0000-0000-0000-000000000016','active','espoir','M','42','LIC-A031','LU1234531','2029-08-30',true),
  ('66666666-0000-0000-0000-000000000032','COSL-2026-0032','Liz',     'Origer',     '1999-05-08','female','LUX','LUX','liz.origer@athletes.lu','+352 621 00 00 32','https://i.pravatar.cc/150?u=cosl32','22222222-0000-0000-0000-000000000006','11111111-0000-0000-0000-000000000006','44444444-0000-0000-0000-000000000017','active','espoir','S','38','LIC-A032','LU1234532','2030-10-04',true),
  -- Triathlon
  ('66666666-0000-0000-0000-000000000033','COSL-2026-0033','Ben',     'Theis',      '1998-08-29','male',  'LUX','LUX','ben.theis@athletes.lu','+352 621 00 00 33','https://i.pravatar.cc/150?u=cosl33','22222222-0000-0000-0000-000000000007','11111111-0000-0000-0000-000000000007','44444444-0000-0000-0000-000000000018','active','espoir','M','43','LIC-A033','LU1234533','2030-11-11',true),
  ('66666666-0000-0000-0000-000000000034','COSL-2026-0034','Tim',     'Folscheid',  '2000-12-17','male',  'LUX','LUX','tim.folscheid@athletes.lu','+352 621 00 00 34','https://i.pravatar.cc/150?u=cosl34','22222222-0000-0000-0000-000000000007','11111111-0000-0000-0000-000000000007','44444444-0000-0000-0000-000000000019','active','espoir','M','42','LIC-A034','LU1234534','2031-07-19',true),
  ('66666666-0000-0000-0000-000000000035','COSL-2026-0035','Nora',    'Schmit',     '2003-04-22','female','LUX','LUX','nora.schmit@athletes.lu','+352 621 00 00 35','https://i.pravatar.cc/150?u=cosl35','22222222-0000-0000-0000-000000000007','11111111-0000-0000-0000-000000000007','44444444-0000-0000-0000-000000000018','active','espoir','S','38','LIC-A035','LU1234535','2030-09-26',true),
  -- Ski
  ('66666666-0000-0000-0000-000000000036','COSL-2026-0036','Gilles',  'Wagner',     '1995-01-30','male',  'LUX','LUX','gilles.wagner@athletes.lu','+352 621 00 00 36','https://i.pravatar.cc/150?u=cosl36','22222222-0000-0000-0000-000000000008','11111111-0000-0000-0000-000000000008','44444444-0000-0000-0000-000000000020','active','espoir','M','43','LIC-A036','LU1234536','2030-02-09',true),
  ('66666666-0000-0000-0000-000000000037','COSL-2026-0037','Manon',   'Reuter',     '1991-09-13','female','LUX','LUX','manon.reuter@athletes.lu','+352 621 00 00 37','https://i.pravatar.cc/150?u=cosl37','22222222-0000-0000-0000-000000000008','11111111-0000-0000-0000-000000000008','44444444-0000-0000-0000-000000000021','retired','espoir','S','38','LIC-A037','LU1234537','2027-05-15',false),
  -- Patinage
  ('66666666-0000-0000-0000-000000000038','COSL-2026-0038','Lou',     'Klein',      '2004-06-07','female','LUX','LUX','lou.klein@athletes.lu','+352 621 00 00 38','https://i.pravatar.cc/150?u=cosl38','22222222-0000-0000-0000-000000000009','11111111-0000-0000-0000-000000000009','44444444-0000-0000-0000-000000000022','active','espoir','XS','36','LIC-A038','LU1234538','2031-11-28',true),
  -- Tennis Table
  ('66666666-0000-0000-0000-000000000039','COSL-2026-0039','Eric',    'Theis',      '2005-03-04','male',  'LUX','LUX','eric.theis@athletes.lu','+352 621 00 00 39','https://i.pravatar.cc/150?u=cosl39','22222222-0000-0000-0000-000000000010','11111111-0000-0000-0000-000000000010','44444444-0000-0000-0000-000000000023','active','espoir','M','41','LIC-A039','LU1234539','2032-03-04',true),
  ('66666666-0000-0000-0000-000000000040','COSL-2026-0040','Lynn',    'Theis',      '2007-10-22','female','LUX','LUX','lynn.theis@athletes.lu','+352 621 00 00 40','https://i.pravatar.cc/150?u=cosl40','22222222-0000-0000-0000-000000000010','11111111-0000-0000-0000-000000000010','44444444-0000-0000-0000-000000000024','retired','espoir','XS','36','LIC-A040','LU1234540','2032-10-22',false);

-- ============================================================================
-- 7b. ATHLETE_KYC : 25 green (a01-a25), 10 orange (a26-a35), 5 red (a36-a40)
-- ============================================================================
INSERT INTO public.athlete_kyc (athlete_id, identity_verified, nationality_verified, age_eligibility_ok, antidoping_status, ethics_charter_signed_at, rule40_signed_at, global_status, last_check_at)
SELECT a.id, true, true, true, 'green', now() - interval '90 days', now() - interval '60 days', 'green', now() - interval '7 days'
FROM public.athletes a
WHERE substring(a.cosl_id from 11)::int BETWEEN 1 AND 25;

INSERT INTO public.athlete_kyc (athlete_id, identity_verified, nationality_verified, age_eligibility_ok, antidoping_status, ethics_charter_signed_at, global_status, last_check_at, notes)
SELECT a.id, true, true, false, 'orange', now() - interval '40 days', 'orange', now() - interval '14 days', 'Certificat médical en attente'
FROM public.athletes a
WHERE substring(a.cosl_id from 11)::int BETWEEN 26 AND 35;

INSERT INTO public.athlete_kyc (athlete_id, identity_verified, nationality_verified, age_eligibility_ok, antidoping_status, global_status, last_check_at, notes)
SELECT a.id, false, false, false, 'red', 'red', now() - interval '2 days', 'Documents manquants — relance envoyée'
FROM public.athletes a
WHERE substring(a.cosl_id from 11)::int BETWEEN 36 AND 40;

-- ============================================================================
-- 8. ATHLETE_DOCUMENTS (3 docs par athlète = 120 documents)
-- ============================================================================
-- passeport
INSERT INTO public.athlete_documents (athlete_id, category, doc_type, file_name, issued_date, expiry_date, status)
SELECT a.id, 'admin', 'passport', 'passport_'||a.cosl_id||'.pdf',
       CURRENT_DATE - interval '2 years',
       a.passport_expiry,
       (CASE
          WHEN substring(a.cosl_id from 11)::int <= 28 THEN 'valid'
          WHEN substring(a.cosl_id from 11)::int <= 34 THEN 'pending'
          WHEN substring(a.cosl_id from 11)::int <= 38 THEN 'expired'
          ELSE 'missing'
        END)::public.document_status
FROM public.athletes a;

-- carte d'identité
INSERT INTO public.athlete_documents (athlete_id, category, doc_type, file_name, issued_date, expiry_date, status)
SELECT a.id, 'admin', 'id_card', 'id_card_'||a.cosl_id||'.pdf',
       CURRENT_DATE - interval '3 years',
       CURRENT_DATE + interval '7 years',
       (CASE
          WHEN substring(a.cosl_id from 11)::int <= 30 THEN 'valid'
          WHEN substring(a.cosl_id from 11)::int <= 36 THEN 'pending'
          ELSE 'missing'
        END)::public.document_status
FROM public.athletes a;

-- certificat médical (1 an de validité)
INSERT INTO public.athlete_documents (athlete_id, category, doc_type, file_name, issued_date, expiry_date, status)
SELECT a.id, 'medical', 'medical_certificate', 'medical_'||a.cosl_id||'.pdf',
       CURRENT_DATE - interval '6 months',
       CURRENT_DATE + interval '6 months',
       (CASE
          WHEN substring(a.cosl_id from 11)::int <= 26 THEN 'valid'
          WHEN substring(a.cosl_id from 11)::int <= 32 THEN 'pending'
          WHEN substring(a.cosl_id from 11)::int <= 38 THEN 'expired'
          ELSE 'missing'
        END)::public.document_status
FROM public.athletes a;

-- autorisation parentale pour mineurs (nés après 2008-05-12)
INSERT INTO public.athlete_documents (athlete_id, category, doc_type, file_name, issued_date, status)
SELECT a.id, 'admin', 'parental_authorization', 'parental_'||a.cosl_id||'.pdf',
       CURRENT_DATE - interval '3 months', 'valid'
FROM public.athletes a
WHERE a.birth_date > CURRENT_DATE - interval '18 years';

-- ============================================================================
-- 9. ATHLETE_RELATIONS (40 relations coach principales)
-- ============================================================================
-- Athlétisme → coaches 1, 2
INSERT INTO public.athlete_relations (athlete_id, coach_id, relation_role, start_date)
SELECT a.id,
       CASE WHEN substring(a.cosl_id from 11)::int % 2 = 0
            THEN '55555555-0000-0000-0000-000000000001'::uuid
            ELSE '55555555-0000-0000-0000-000000000002'::uuid END,
       'coach', CURRENT_DATE - interval '18 months'
FROM public.athletes a WHERE a.primary_sport_id = '22222222-0000-0000-0000-000000000001';

-- Natation → coach 5, médical 4
INSERT INTO public.athlete_relations (athlete_id, coach_id, relation_role, start_date)
SELECT a.id, '55555555-0000-0000-0000-000000000005'::uuid, 'coach', CURRENT_DATE - interval '12 months'
FROM public.athletes a WHERE a.primary_sport_id = '22222222-0000-0000-0000-000000000002';

INSERT INTO public.athlete_relations (athlete_id, coach_id, relation_role, start_date)
SELECT a.id, '55555555-0000-0000-0000-000000000004'::uuid, 'medical', CURRENT_DATE - interval '8 months'
FROM public.athletes a WHERE a.primary_sport_id = '22222222-0000-0000-0000-000000000002' LIMIT 3;

-- Cyclisme → coaches 6, 7
INSERT INTO public.athlete_relations (athlete_id, coach_id, relation_role, start_date)
SELECT a.id,
       CASE WHEN substring(a.cosl_id from 11)::int % 2 = 0
            THEN '55555555-0000-0000-0000-000000000006'::uuid
            ELSE '55555555-0000-0000-0000-000000000007'::uuid END,
       'coach', CURRENT_DATE - interval '14 months'
FROM public.athletes a WHERE a.primary_sport_id = '22222222-0000-0000-0000-000000000003';

-- Judo → coach 3
INSERT INTO public.athlete_relations (athlete_id, coach_id, relation_role, start_date)
SELECT a.id, '55555555-0000-0000-0000-000000000003'::uuid, 'coach', CURRENT_DATE - interval '20 months'
FROM public.athletes a WHERE a.primary_sport_id = '22222222-0000-0000-0000-000000000004';

-- Tennis → coaches 8, 9 + manager 19
INSERT INTO public.athlete_relations (athlete_id, coach_id, relation_role, start_date)
SELECT a.id,
       CASE WHEN substring(a.cosl_id from 11)::int % 2 = 0
            THEN '55555555-0000-0000-0000-000000000008'::uuid
            ELSE '55555555-0000-0000-0000-000000000009'::uuid END,
       'coach', CURRENT_DATE - interval '10 months'
FROM public.athletes a WHERE a.primary_sport_id = '22222222-0000-0000-0000-000000000005';

INSERT INTO public.athlete_relations (athlete_id, coach_id, relation_role, start_date)
SELECT a.id, '55555555-0000-0000-0000-000000000019'::uuid, 'manager', CURRENT_DATE - interval '6 months'
FROM public.athletes a WHERE a.primary_sport_id = '22222222-0000-0000-0000-000000000005' LIMIT 2;

-- Tir Arc → coach 10
INSERT INTO public.athlete_relations (athlete_id, coach_id, relation_role, start_date)
SELECT a.id, '55555555-0000-0000-0000-000000000010'::uuid, 'coach', CURRENT_DATE - interval '15 months'
FROM public.athletes a WHERE a.primary_sport_id = '22222222-0000-0000-0000-000000000006';

-- Triathlon → coach 11
INSERT INTO public.athlete_relations (athlete_id, coach_id, relation_role, start_date)
SELECT a.id, '55555555-0000-0000-0000-000000000011'::uuid, 'coach', CURRENT_DATE - interval '11 months'
FROM public.athletes a WHERE a.primary_sport_id = '22222222-0000-0000-0000-000000000007';

-- ============================================================================
-- 10. GAMES (5)
-- ============================================================================
INSERT INTO public.games (id, name, short_name, game_type, edition_year, host_country, host_city, organizer, preparation_start, competition_start, competition_end, status) VALUES
  ('77777777-0000-0000-0000-000000000001','JPEE 2027 Andorre',          'JPEE 2027','jpee',         2027,'Andorre',           'Andorre-la-Vieille','Comité Organisateur JPEE','2026-09-01','2027-05-29','2027-06-04','preparation'),
  ('77777777-0000-0000-0000-000000000002','JO Été 2028 Los Angeles',    'LA 2028',  'jo_summer',    2028,'USA',               'Los Angeles',        'CIO',                      '2026-06-01','2028-07-14','2028-07-30','preparation'),
  ('77777777-0000-0000-0000-000000000003','JO Hiver 2030 Alpes',        'Alpes 2030','jo_winter',   2030,'France',            'Alpes françaises',   'CIO',                      '2027-09-01','2030-02-01','2030-02-17','preparation'),
  ('77777777-0000-0000-0000-000000000004','EYOF Été 2027 Skopje',       'EYOF 2027','eyof_summer',  2027,'Macédoine du Nord', 'Skopje',             'COE',                      '2026-11-01','2027-07-25','2027-07-31','preparation'),
  ('77777777-0000-0000-0000-000000000005','JOJ Été 2026 Dakar',         'JOJ 2026', 'joj_summer',   2026,'Sénégal',           'Dakar',              'CIO',                      '2025-09-01','2026-09-04','2026-09-19','finished');

-- ============================================================================
-- 11. GAME_SPORTS
-- ============================================================================
-- JPEE 2027
INSERT INTO public.game_sports (game_id, sport_id) VALUES
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000003'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000004'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000005'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000006'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000007'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000010'),
-- LA 2028
  ('77777777-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001'),
  ('77777777-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000002'),
  ('77777777-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000003'),
  ('77777777-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000004'),
  ('77777777-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000005'),
  ('77777777-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000007'),
  ('77777777-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000010'),
-- JO Hiver 2030
  ('77777777-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000008'),
  ('77777777-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000009'),
-- EYOF 2027
  ('77777777-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000001'),
  ('77777777-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000002'),
  ('77777777-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000003'),
  ('77777777-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000004'),
-- JOJ Dakar 2026
  ('77777777-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000001'),
  ('77777777-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000002'),
  ('77777777-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000004');

-- ============================================================================
-- 12. GAME_QUOTAS (22 quotas pour JPEE 2027 + 5 pour LA 2028)
-- ============================================================================
INSERT INTO public.game_quotas (game_id, sport_id, discipline_id, gender, quota_max, qualification_deadline, qualification_criteria) VALUES
  -- JPEE 2027 — Athlétisme
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001','male',  2,'2027-03-29','Minima 10s50 sur 100m officiel'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000002','female',2,'2027-03-29','Minima 11s80 sur 100m officiel'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000003','male',  2,'2027-03-29','Minima 21s00 sur 200m'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000005','male',  2,'2027-03-29','Minima 14:30 sur 5000m'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000007','male',  3,'2027-03-29','Minima 2h25 sur Marathon homologué'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000008','female',2,'2027-03-29','Minima 2h45 sur Marathon homologué'),
  -- JPEE 2027 — Natation
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000011','male',  2,'2027-03-29','Minima FINA points 750+'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000012','female',2,'2027-03-29','Minima FINA points 750+'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000013','male',  2,'2027-03-29','Minima FINA points 780+'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000014','female',2,'2027-03-29','Minima FINA points 780+'),
  -- JPEE 2027 — Cyclisme
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000018','male',  4,'2027-03-29','Sélection nationale FSCL'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000019','female',4,'2027-03-29','Sélection nationale FSCL'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000020','male',  2,'2027-03-29','Top 10 championnats nationaux CLM'),
  -- JPEE 2027 — Judo
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000022','male',  1,'2027-03-29','Quota IJF 1 par catégorie'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000023','male',  1,'2027-03-29','Quota IJF 1 par catégorie'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000024','male',  1,'2027-03-29','Quota IJF 1 par catégorie'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000025','female',1,'2027-03-29','Quota IJF 1 par catégorie'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000026','female',1,'2027-03-29','Quota IJF 1 par catégorie'),
  -- JPEE 2027 — Tennis
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000005','33333333-0000-0000-0000-000000000028','male',  2,'2027-03-29','Top ATP 800'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000005','33333333-0000-0000-0000-000000000029','female',2,'2027-03-29','Top WTA 800'),
  -- JPEE 2027 — Triathlon
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000007','33333333-0000-0000-0000-000000000031','male',  2,'2027-03-29','Sélection FLTRI'),
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000007','33333333-0000-0000-0000-000000000032','female',2,'2027-03-29','Sélection FLTRI'),
  -- LA 2028
  ('77777777-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000007','male',  2,'2028-05-14','Minima World Athletics 2h11'),
  ('77777777-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000013','male',  2,'2028-05-14','Minima OST FINA'),
  ('77777777-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000018','male',  3,'2028-05-14','Quota UCI'),
  ('77777777-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000023','male',  1,'2028-05-14','Quota IJF'),
  ('77777777-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000005','33333333-0000-0000-0000-000000000028','male',  1,'2028-05-14','Top ATP 100');

-- ============================================================================
-- 13. SELECTIONS sur JPEE 2027 — 25 sélections (15 selected + 5 pre + 3 reserve + 2 rejected)
--   Selected (15) : a01..a07 (athlé), a09,a10,a12,a13 (nat), a15,a16,a18 (cycl), a21 (judo) — tous KYC vert
--   Pre-selected (5) : a17 (cycl), a19,a20 (cycl), a23 (judo), a24 (judo)
--   Reserve (3) : a02 (athlé H 100m fallback) — non, Reserve doit être différent.
--     Reserve : a04 reserve sur 200m H, a07 reserve sur 100m F, a18 reserve sur CLM F
--     Mais a04, a07, a18 déjà en 'selected' → UNIQUE (game_id, athlete_id, discipline_id) → différentes disciplines OK
--   Rejected (2) : a25 (judo), a13 (natation papillon F)
-- ============================================================================
INSERT INTO public.selections (game_id, athlete_id, sport_id, discipline_id, status, decided_at, comment) VALUES
  -- selected (15)
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001','selected', now() - interval '20 days','Champion national 100m H'),
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000003','selected', now() - interval '20 days','Vice-champion 200m H'),
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000005','selected', now() - interval '19 days','Minima 5000m'),
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000007','selected', now() - interval '18 days','Minima Marathon'),
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000002','selected', now() - interval '18 days','Championne nationale 100m F'),
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000006','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000004','selected', now() - interval '17 days','Vice-championne 200m F'),
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000007','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000008','selected', now() - interval '17 days','Minima Marathon F'),
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000009','22222222-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000011','selected', now() - interval '15 days','FINA 765 pts'),
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000010','22222222-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000013','selected', now() - interval '15 days','FINA 790 pts'),
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000012','22222222-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000012','selected', now() - interval '15 days','FINA 770 pts'),
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000013','22222222-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000014','selected', now() - interval '14 days','FINA 800 pts'),
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000015','22222222-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000018','selected', now() - interval '12 days','Sélection FSCL'),
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000016','22222222-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000018','selected', now() - interval '12 days','Sélection FSCL'),
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000018','22222222-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000019','selected', now() - interval '11 days','Sélection FSCL F'),
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000021','22222222-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000023','selected', now() - interval '10 days','Quota IJF -73kg'),
  -- pre_selected (5)
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000017','22222222-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000020','pre_selected', now() - interval '5 days','En attente CLM final'),
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000019','22222222-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000019','pre_selected', now() - interval '5 days','Sous réserve championnats'),
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000020','22222222-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000021','pre_selected', now() - interval '4 days','Pré-sélection CLM F'),
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000023','22222222-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000024','pre_selected', now() - interval '4 days','Pré-sélection -90kg'),
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000024','22222222-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000025','pre_selected', now() - interval '3 days','Pré-sélection -52kg'),
  -- reserve (3) sur disciplines différentes
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000003','reserve', now() - interval '6 days','Réserve 200m H'),
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000007','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000002','reserve', now() - interval '6 days','Réserve 100m F'),
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000018','22222222-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000021','reserve', now() - interval '5 days','Réserve CLM F'),
  -- rejected (2)
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000025','22222222-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000026','rejected', now() - interval '7 days','Quota -63kg déjà attribué'),
  ('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000013','22222222-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000016','rejected', now() - interval '8 days','Pas de minima sur 200m papillon F');

-- LA 2028 — 6 pré-sélections
INSERT INTO public.selections (game_id, athlete_id, sport_id, discipline_id, status, decided_at, comment) VALUES
  ('77777777-0000-0000-0000-000000000002','66666666-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000007','pre_selected', now() - interval '60 days','Programme LA 2028'),
  ('77777777-0000-0000-0000-000000000002','66666666-0000-0000-0000-000000000010','22222222-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000013','pre_selected', now() - interval '60 days','Programme LA 2028'),
  ('77777777-0000-0000-0000-000000000002','66666666-0000-0000-0000-000000000015','22222222-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000018','pre_selected', now() - interval '58 days','Programme LA 2028'),
  ('77777777-0000-0000-0000-000000000002','66666666-0000-0000-0000-000000000016','22222222-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000018','pre_selected', now() - interval '58 days','Programme LA 2028'),
  ('77777777-0000-0000-0000-000000000002','66666666-0000-0000-0000-000000000021','22222222-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000023','pre_selected', now() - interval '55 days','Programme LA 2028'),
  ('77777777-0000-0000-0000-000000000002','66666666-0000-0000-0000-000000000027','22222222-0000-0000-0000-000000000005','33333333-0000-0000-0000-000000000028','pre_selected', now() - interval '50 days','Programme LA 2028');

-- ============================================================================
-- 14. DELEGATIONS (JPEE, LA, EYOF)
-- ============================================================================
INSERT INTO public.delegations (id, game_id, chief_of_mission_id, games_manager_id, notes) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','77777777-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000017',
    (SELECT id FROM public.user_profiles WHERE username='laurent.carnol'),
    'Délégation JPEE 2027 — Andorre'),
  ('aaaaaaaa-0000-0000-0000-000000000002','77777777-0000-0000-0000-000000000002','55555555-0000-0000-0000-000000000017',
    (SELECT id FROM public.user_profiles WHERE username='laurent.carnol'),
    'Délégation LA 2028'),
  ('aaaaaaaa-0000-0000-0000-000000000003','77777777-0000-0000-0000-000000000004','55555555-0000-0000-0000-000000000017',
    (SELECT id FROM public.user_profiles WHERE username='laurent.carnol'),
    'Délégation EYOF 2027 Skopje');

-- ============================================================================
-- 15. DELEGATION_MEMBERS JPEE 2027 (~30)
--  - Athlètes sélectionnés/réserves (DISTINCT)
--  - Coaches & staff
-- ============================================================================
INSERT INTO public.delegation_members (delegation_id, athlete_id, member_role, member_function)
SELECT 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, x.athlete_id, 'athlete', 'Compétiteur'
FROM (
  SELECT DISTINCT athlete_id
  FROM public.selections
  WHERE game_id = '77777777-0000-0000-0000-000000000001'
    AND status IN ('selected','reserve')
) x;

INSERT INTO public.delegation_members (delegation_id, coach_id, member_role, member_function) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000001','coach','Athlétisme'),
  ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000002','coach','Athlétisme'),
  ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000005','coach','Natation'),
  ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000006','coach','Cyclisme'),
  ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000007','coach','Cyclisme'),
  ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000003','coach','Judo'),
  ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000008','coach','Tennis'),
  ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000022','coach','Natation adjoint'),
  ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000015','doctor','Médecin chef'),
  ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000004','doctor','Médecin équipe'),
  ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000017','chief_of_mission','Chef de mission'),
  ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000018','press','Attachée presse');

-- ============================================================================
-- 16. ACCREDITATION_TYPES — 5 types par Games (JPEE + LA)
-- ============================================================================
INSERT INTO public.accreditation_types (id, game_id, category, type_code, description, required_documents, valid_from, valid_until) VALUES
  -- JPEE
  ('88888888-0000-0000-0000-000000000001','77777777-0000-0000-0000-000000000001','athlete' ,'ATH','Athlète JPEE 2027',  ARRAY['passport','photo','medical_cert'], '2027-05-25','2027-06-06'),
  ('88888888-0000-0000-0000-000000000002','77777777-0000-0000-0000-000000000001','coach'   ,'CO', 'Encadrement sportif',ARRAY['passport','photo','contract'],     '2027-05-25','2027-06-06'),
  ('88888888-0000-0000-0000-000000000003','77777777-0000-0000-0000-000000000001','official','OFF','Officiel délégation',ARRAY['passport','photo'],                '2027-05-25','2027-06-06'),
  ('88888888-0000-0000-0000-000000000004','77777777-0000-0000-0000-000000000001','medical' ,'MED','Personnel médical',  ARRAY['passport','photo','medical_license'], '2027-05-25','2027-06-06'),
  ('88888888-0000-0000-0000-000000000005','77777777-0000-0000-0000-000000000001','press'   ,'PR', 'Attaché presse',     ARRAY['passport','photo','press_card'],   '2027-05-25','2027-06-06'),
  -- LA 2028
  ('88888888-0000-0000-0000-000000000006','77777777-0000-0000-0000-000000000002','athlete' ,'ATH','Athlète LA 2028',    ARRAY['passport','photo','medical_cert'], '2028-07-10','2028-08-01'),
  ('88888888-0000-0000-0000-000000000007','77777777-0000-0000-0000-000000000002','coach'   ,'CO', 'Encadrement sportif',ARRAY['passport','photo','contract'],     '2028-07-10','2028-08-01'),
  ('88888888-0000-0000-0000-000000000008','77777777-0000-0000-0000-000000000002','official','OFF','Officiel délégation',ARRAY['passport','photo'],                '2028-07-10','2028-08-01'),
  ('88888888-0000-0000-0000-000000000009','77777777-0000-0000-0000-000000000002','medical' ,'MED','Personnel médical',  ARRAY['passport','photo','medical_license'], '2028-07-10','2028-08-01'),
  ('88888888-0000-0000-0000-000000000010','77777777-0000-0000-0000-000000000002','press'   ,'PR', 'Attaché presse',     ARRAY['passport','photo','press_card'],   '2028-07-10','2028-08-01');

-- ============================================================================
-- 17. ACCREDITATIONS JPEE 2027 (~30)
-- ============================================================================
-- 1 accréditation ATH par membre athlète de la délégation
INSERT INTO public.accreditations (game_id, accreditation_type_id, athlete_id, full_name, function_label, status, submitted_at)
SELECT '77777777-0000-0000-0000-000000000001'::uuid,
       '88888888-0000-0000-0000-000000000001'::uuid,
       a.id,
       a.first_name||' '||a.last_name,
       'Athlète',
       (CASE
         WHEN substring(a.cosl_id from 11)::int <= 7  THEN 'validated'
         WHEN substring(a.cosl_id from 11)::int <= 13 THEN 'submitted'
         WHEN substring(a.cosl_id from 11)::int <= 18 THEN 'draft'
         ELSE 'submitted'
       END)::public.accreditation_status,
       now() - interval '30 days'
FROM public.athletes a
WHERE a.id IN (
  SELECT DISTINCT athlete_id FROM public.delegation_members
  WHERE delegation_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND athlete_id IS NOT NULL
);

-- Coaches & staff
INSERT INTO public.accreditations (game_id, accreditation_type_id, coach_id, full_name, function_label, status, submitted_at, validated_at) VALUES
  ('77777777-0000-0000-0000-000000000001','88888888-0000-0000-0000-000000000002','55555555-0000-0000-0000-000000000001','Marc Lambert','Coach Athlétisme','validated', now() - interval '40 days', now() - interval '20 days'),
  ('77777777-0000-0000-0000-000000000001','88888888-0000-0000-0000-000000000002','55555555-0000-0000-0000-000000000002','Claude Reinesch','Coach Athlétisme','validated', now() - interval '40 days', now() - interval '20 days'),
  ('77777777-0000-0000-0000-000000000001','88888888-0000-0000-0000-000000000002','55555555-0000-0000-0000-000000000005','François Klein','Coach Natation','submitted', now() - interval '15 days', NULL),
  ('77777777-0000-0000-0000-000000000001','88888888-0000-0000-0000-000000000002','55555555-0000-0000-0000-000000000006','Jean-Paul Mertens','Coach Cyclisme','validated', now() - interval '40 days', now() - interval '18 days'),
  ('77777777-0000-0000-0000-000000000001','88888888-0000-0000-0000-000000000002','55555555-0000-0000-0000-000000000007','Sandra Reuter','Coach Cyclisme','submitted', now() - interval '12 days', NULL),
  ('77777777-0000-0000-0000-000000000001','88888888-0000-0000-0000-000000000002','55555555-0000-0000-0000-000000000003','Pierre Schmitt','Coach Judo','draft', NULL, NULL),
  ('77777777-0000-0000-0000-000000000001','88888888-0000-0000-0000-000000000002','55555555-0000-0000-0000-000000000008','Tom Hoffmann','Coach Tennis','draft', NULL, NULL),
  ('77777777-0000-0000-0000-000000000001','88888888-0000-0000-0000-000000000002','55555555-0000-0000-0000-000000000022','Gilles Reding','Coach Natation adjoint','produced', now() - interval '45 days', now() - interval '15 days'),
  ('77777777-0000-0000-0000-000000000001','88888888-0000-0000-0000-000000000004','55555555-0000-0000-0000-000000000015','Henri Becker','Médecin chef','validated', now() - interval '40 days', now() - interval '15 days'),
  ('77777777-0000-0000-0000-000000000001','88888888-0000-0000-0000-000000000004','55555555-0000-0000-0000-000000000004','Anne Dubois','Médecin équipe','submitted', now() - interval '10 days', NULL),
  ('77777777-0000-0000-0000-000000000001','88888888-0000-0000-0000-000000000003','55555555-0000-0000-0000-000000000017','Georges Mathay','Chef de mission','validated', now() - interval '50 days', now() - interval '25 days'),
  ('77777777-0000-0000-0000-000000000001','88888888-0000-0000-0000-000000000005','55555555-0000-0000-0000-000000000018','Isabelle Origer','Attachée presse','rejected', now() - interval '30 days', NULL);

-- 2 rejets supplémentaires sur des athlètes (mise à jour)
UPDATE public.accreditations SET status='rejected', rejection_reason='Photo non conforme'
WHERE game_id='77777777-0000-0000-0000-000000000001'
  AND athlete_id='66666666-0000-0000-0000-000000000018';
UPDATE public.accreditations SET status='rejected', rejection_reason='Passeport expirant trop tôt'
WHERE game_id='77777777-0000-0000-0000-000000000001'
  AND athlete_id='66666666-0000-0000-0000-000000000020';
UPDATE public.accreditations SET rejection_reason='Carte de presse manquante'
WHERE game_id='77777777-0000-0000-0000-000000000001'
  AND coach_id='55555555-0000-0000-0000-000000000018';

-- ============================================================================
-- 18. ACCREDITATION_DOCUMENTS (3 docs par accréditation = ~90 docs)
-- ============================================================================
INSERT INTO public.accreditation_documents (accreditation_id, doc_type, file_name, status)
SELECT ac.id, 'passport', 'pass_'||ac.id||'.pdf',
  (CASE WHEN ac.status IN ('validated','produced','delivered') THEN 'valid'
        WHEN ac.status = 'rejected' THEN 'rejected'
        WHEN ac.status = 'submitted' THEN 'pending'
        ELSE 'missing' END)::public.document_status
FROM public.accreditations ac
WHERE ac.game_id = '77777777-0000-0000-0000-000000000001';

INSERT INTO public.accreditation_documents (accreditation_id, doc_type, file_name, status)
SELECT ac.id, 'photo', 'photo_'||ac.id||'.jpg',
  (CASE WHEN ac.status IN ('validated','produced','delivered') THEN 'valid'
        WHEN ac.status = 'rejected' THEN 'rejected'
        ELSE 'pending' END)::public.document_status
FROM public.accreditations ac
WHERE ac.game_id = '77777777-0000-0000-0000-000000000001';

INSERT INTO public.accreditation_documents (accreditation_id, doc_type, file_name, status)
SELECT ac.id,
       CASE WHEN ac.athlete_id IS NOT NULL THEN 'medical_cert'
            ELSE 'contract' END,
       'doc_'||ac.id||'.pdf',
  (CASE WHEN ac.status = 'validated' THEN 'valid'
        WHEN ac.status = 'submitted' THEN 'pending'
        WHEN ac.status = 'rejected' THEN 'missing'
        ELSE 'missing' END)::public.document_status
FROM public.accreditations ac
WHERE ac.game_id = '77777777-0000-0000-0000-000000000001';

-- ============================================================================
-- 19. TRAVEL_PLANS (3 plans JPEE 2027)
-- ============================================================================
INSERT INTO public.travel_plans (id, game_id, delegation_id, name, scope, sport_id, departure_date, return_date, departure_point, arrival_point, status) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001','77777777-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Délégation principale JPEE 2027','global', NULL,                                       '2027-05-27','2027-06-05','Luxembourg-Findel','Andorre-la-Vieille','confirmed'),
  ('bbbbbbbb-0000-0000-0000-000000000002','77777777-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Athlétisme avance',              'sport', '22222222-0000-0000-0000-000000000001','2027-05-25','2027-06-05','Luxembourg-Findel','Andorre-la-Vieille','confirmed'),
  ('bbbbbbbb-0000-0000-0000-000000000003','77777777-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Cyclisme retour anticipé',       'sport', '22222222-0000-0000-0000-000000000003','2027-05-29','2027-06-02','Luxembourg-Findel','Andorre-la-Vieille','planned');

-- ============================================================================
-- 20. FLIGHTS (4)
-- ============================================================================
INSERT INTO public.flights (id, travel_plan_id, flight_number, airline, departure_airport, arrival_airport, departure_time, arrival_time, is_outbound) VALUES
  ('cccccccc-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','LH 1234','Lufthansa','LUX','AND','2027-05-27 14:00+02','2027-05-27 17:30+02', true),
  ('cccccccc-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000002','AF 5678','Air France','LUX','AND','2027-05-25 10:00+02','2027-05-25 13:30+02', true),
  ('cccccccc-0000-0000-0000-000000000003','bbbbbbbb-0000-0000-0000-000000000001','LH 4321','Lufthansa','AND','LUX','2027-06-05 16:00+02','2027-06-05 19:30+02', false),
  ('cccccccc-0000-0000-0000-000000000004','bbbbbbbb-0000-0000-0000-000000000003','LH 9876','Lufthansa','AND','LUX','2027-06-02 18:00+02','2027-06-02 21:30+02', false);

-- ============================================================================
-- 21. FLIGHT_PASSENGERS
-- Vol AF 5678 (athlétisme avance) : athlètes athlé selected/reserve
-- Vol LH 1234 (aller principal) : tous autres athlètes + coaches/staff
-- Vol LH 9876 (retour cyclisme) : cyclistes
-- Vol LH 4321 (retour principal) : reste
-- ============================================================================
-- Aller athlétisme (vol 2)
INSERT INTO public.flight_passengers (flight_id, athlete_id, special_baggage)
SELECT 'cccccccc-0000-0000-0000-000000000002'::uuid, a.id, NULL
FROM public.athletes a
WHERE a.id IN (
  SELECT DISTINCT athlete_id FROM public.selections
  WHERE game_id='77777777-0000-0000-0000-000000000001'
    AND sport_id='22222222-0000-0000-0000-000000000001'
    AND status IN ('selected','reserve')
);

-- Aller principal (vol 1) : athlètes non-athlé de la délégation + coaches/staff
INSERT INTO public.flight_passengers (flight_id, athlete_id, special_baggage)
SELECT 'cccccccc-0000-0000-0000-000000000001'::uuid, dm.athlete_id,
       CASE WHEN ath.primary_sport_id = '22222222-0000-0000-0000-000000000003' THEN 'Vélo de course'
            WHEN ath.primary_sport_id = '22222222-0000-0000-0000-000000000006' THEN 'Arc tir à l''arc'
            ELSE NULL END
FROM public.delegation_members dm
JOIN public.athletes ath ON ath.id = dm.athlete_id
WHERE dm.delegation_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  AND dm.athlete_id IS NOT NULL
  AND ath.primary_sport_id <> '22222222-0000-0000-0000-000000000001';

INSERT INTO public.flight_passengers (flight_id, coach_id)
SELECT 'cccccccc-0000-0000-0000-000000000001'::uuid, dm.coach_id
FROM public.delegation_members dm
WHERE dm.delegation_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  AND dm.coach_id IS NOT NULL;

-- Retour cyclisme anticipé (vol 4)
INSERT INTO public.flight_passengers (flight_id, athlete_id, special_baggage)
SELECT 'cccccccc-0000-0000-0000-000000000004'::uuid, ath.id, 'Vélo de course'
FROM public.athletes ath
WHERE ath.primary_sport_id = '22222222-0000-0000-0000-000000000003'
  AND ath.id IN (
    SELECT DISTINCT athlete_id FROM public.delegation_members
    WHERE delegation_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND athlete_id IS NOT NULL
  );

-- Retour principal (vol 3) : tous les autres athlètes + tous les coaches
INSERT INTO public.flight_passengers (flight_id, athlete_id)
SELECT 'cccccccc-0000-0000-0000-000000000003'::uuid, ath.id
FROM public.athletes ath
WHERE ath.id IN (
  SELECT DISTINCT athlete_id FROM public.delegation_members
  WHERE delegation_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND athlete_id IS NOT NULL
)
AND ath.primary_sport_id <> '22222222-0000-0000-0000-000000000003';

INSERT INTO public.flight_passengers (flight_id, coach_id)
SELECT 'cccccccc-0000-0000-0000-000000000003'::uuid, dm.coach_id
FROM public.delegation_members dm
WHERE dm.delegation_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  AND dm.coach_id IS NOT NULL;

-- ============================================================================
-- 22. ACCOMMODATIONS (2)
-- ============================================================================
INSERT INTO public.accommodations (id, game_id, name, address, city, country, type, total_rooms) VALUES
  ('dddddddd-0000-0000-0000-000000000001','77777777-0000-0000-0000-000000000001','Village Olympique Andorre','Av. de l''Olympisme 1','Andorre-la-Vieille','Andorre','olympic_village',200),
  ('dddddddd-0000-0000-0000-000000000002','77777777-0000-0000-0000-000000000001','Hôtel Princesa Parc',     'Av. Tarragona 17',    'Andorre-la-Vieille','Andorre','hotel',           50);

-- ============================================================================
-- 23. ROOMING_ASSIGNMENTS (~22)
-- Athlètes en chambres doubles au village, staff en simple à l'hôtel
-- ============================================================================
INSERT INTO public.rooming_assignments (accommodation_id, room_number, room_type, athlete_id, check_in, check_out) VALUES
  ('dddddddd-0000-0000-0000-000000000001','V101','double','66666666-0000-0000-0000-000000000001','2027-05-27','2027-06-05'),
  ('dddddddd-0000-0000-0000-000000000001','V101','double','66666666-0000-0000-0000-000000000002','2027-05-27','2027-06-05'),
  ('dddddddd-0000-0000-0000-000000000001','V102','double','66666666-0000-0000-0000-000000000003','2027-05-27','2027-06-05'),
  ('dddddddd-0000-0000-0000-000000000001','V102','double','66666666-0000-0000-0000-000000000004','2027-05-27','2027-06-05'),
  ('dddddddd-0000-0000-0000-000000000001','V103','double','66666666-0000-0000-0000-000000000005','2027-05-29','2027-06-04'),
  ('dddddddd-0000-0000-0000-000000000001','V103','double','66666666-0000-0000-0000-000000000006','2027-05-29','2027-06-04'),
  ('dddddddd-0000-0000-0000-000000000001','V104','double','66666666-0000-0000-0000-000000000007','2027-05-29','2027-06-04'),
  ('dddddddd-0000-0000-0000-000000000001','V104','double','66666666-0000-0000-0000-000000000009','2027-05-29','2027-06-04'),
  ('dddddddd-0000-0000-0000-000000000001','V105','double','66666666-0000-0000-0000-000000000010','2027-05-29','2027-06-04'),
  ('dddddddd-0000-0000-0000-000000000001','V105','double','66666666-0000-0000-0000-000000000012','2027-05-29','2027-06-04'),
  ('dddddddd-0000-0000-0000-000000000001','V106','double','66666666-0000-0000-0000-000000000013','2027-05-29','2027-06-04'),
  ('dddddddd-0000-0000-0000-000000000001','V106','double','66666666-0000-0000-0000-000000000015','2027-05-29','2027-06-02'),
  ('dddddddd-0000-0000-0000-000000000001','V107','double','66666666-0000-0000-0000-000000000016','2027-05-29','2027-06-02'),
  ('dddddddd-0000-0000-0000-000000000001','V107','double','66666666-0000-0000-0000-000000000018','2027-05-29','2027-06-04'),
  ('dddddddd-0000-0000-0000-000000000001','V108','single','66666666-0000-0000-0000-000000000021','2027-05-29','2027-06-04');

INSERT INTO public.rooming_assignments (accommodation_id, room_number, room_type, coach_id, check_in, check_out) VALUES
  ('dddddddd-0000-0000-0000-000000000002','H201','single','55555555-0000-0000-0000-000000000017','2027-05-27','2027-06-05'),
  ('dddddddd-0000-0000-0000-000000000002','H202','single','55555555-0000-0000-0000-000000000015','2027-05-27','2027-06-05'),
  ('dddddddd-0000-0000-0000-000000000002','H203','single','55555555-0000-0000-0000-000000000018','2027-05-27','2027-06-05'),
  ('dddddddd-0000-0000-0000-000000000002','H204','double','55555555-0000-0000-0000-000000000001','2027-05-25','2027-06-05'),
  ('dddddddd-0000-0000-0000-000000000002','H204','double','55555555-0000-0000-0000-000000000002','2027-05-25','2027-06-05'),
  ('dddddddd-0000-0000-0000-000000000002','H205','double','55555555-0000-0000-0000-000000000005','2027-05-29','2027-06-04'),
  ('dddddddd-0000-0000-0000-000000000002','H205','double','55555555-0000-0000-0000-000000000022','2027-05-29','2027-06-04'),
  ('dddddddd-0000-0000-0000-000000000002','H206','double','55555555-0000-0000-0000-000000000006','2027-05-29','2027-06-02'),
  ('dddddddd-0000-0000-0000-000000000002','H206','double','55555555-0000-0000-0000-000000000007','2027-05-29','2027-06-02');

-- ============================================================================
-- 24. LOCAL_TRANSPORTS (5)
-- ============================================================================
INSERT INTO public.local_transports (game_id, transport_type, pickup_location, dropoff_location, pickup_time, capacity, notes) VALUES
  ('77777777-0000-0000-0000-000000000001','shuttle','Aéroport Andorre','Village Olympique','2027-05-27 16:00+02', 50,'Navette accueil délégation'),
  ('77777777-0000-0000-0000-000000000001','bus','Village Olympique','Stade National','2027-05-30 08:00+02', 40,'Compétitions athlétisme J1'),
  ('77777777-0000-0000-0000-000000000001','bus','Village Olympique','Stade National','2027-05-31 08:00+02', 40,'Compétitions athlétisme J2'),
  ('77777777-0000-0000-0000-000000000001','bus','Village Olympique','Centre aquatique','2027-06-01 09:00+02', 30,'Compétitions natation'),
  ('77777777-0000-0000-0000-000000000001','shuttle','Village Olympique','Aéroport Andorre','2027-06-05 14:00+02', 50,'Navette retour délégation');

-- ============================================================================
-- 25. MESSAGE_TEMPLATES (5)
-- ============================================================================
INSERT INTO public.message_templates (id, name, subject, body, channel) VALUES
  ('eeeeeeee-0000-0000-0000-000000000001','Convocation Games',     'Convocation officielle {{game_name}}',                  'Bonjour {{athlete_name}},\n\nNous avons le plaisir de vous convoquer pour {{game_name}}. Merci de confirmer votre disponibilité.\n\nL''équipe COSL.','email'),
  ('eeeeeeee-0000-0000-0000-000000000002','Briefing pré-départ',   'Briefing pré-départ {{game_name}} - Informations importantes','Bonjour {{athlete_name}},\n\nVoici les informations relatives au briefing pré-départ pour {{game_name}}.\n\nL''équipe COSL.','email'),
  ('eeeeeeee-0000-0000-0000-000000000003','Rappel documents',      'Documents manquants pour votre accréditation',         'Bonjour {{athlete_name}},\n\nIl manque encore certains documents pour finaliser votre accréditation. Merci de les transmettre rapidement.','email'),
  ('eeeeeeee-0000-0000-0000-000000000004','Confirmation sélection','Félicitations ! Votre sélection {{game_name}} est confirmée','Bonjour {{athlete_name}},\n\nFélicitations, votre sélection pour {{game_name}} est confirmée.','email'),
  ('eeeeeeee-0000-0000-0000-000000000005','Bilan post-Games',      'Bilan et remerciements {{game_name}}',                  'Bonjour {{athlete_name}},\n\nMerci pour votre engagement durant {{game_name}}. Voici un bilan synthétique.','email');

-- ============================================================================
-- 26. MESSAGES_SENT (5)
-- ============================================================================
INSERT INTO public.messages_sent (template_id, game_id, channel, subject, body, audience_segment, recipients_count, sent_at) VALUES
  ('eeeeeeee-0000-0000-0000-000000000001','77777777-0000-0000-0000-000000000001','email','Convocation officielle JPEE 2027','Convocation envoyée à la délégation','delegation_jpee_2027', 30, now() - interval '90 days'),
  ('eeeeeeee-0000-0000-0000-000000000004','77777777-0000-0000-0000-000000000001','email','Félicitations ! Votre sélection JPEE 2027 est confirmée','Sélection confirmée','athletes_selected_jpee_2027', 15, now() - interval '20 days'),
  ('eeeeeeee-0000-0000-0000-000000000003','77777777-0000-0000-0000-000000000001','email','Documents manquants pour votre accréditation','Relance documents','athletes_pending_docs', 8, now() - interval '10 days'),
  ('eeeeeeee-0000-0000-0000-000000000002','77777777-0000-0000-0000-000000000001','email','Briefing pré-départ JPEE 2027 - Informations importantes','Briefing programmé le 20 mai','delegation_jpee_2027', 30, now() - interval '5 days'),
  ('eeeeeeee-0000-0000-0000-000000000005','77777777-0000-0000-0000-000000000005','email','Bilan et remerciements JOJ 2026','Bilan post-Games envoyé','delegation_joj_2026', 12, now() - interval '180 days');

-- ============================================================================
-- 27. NOTIFICATIONS (~15)
-- ============================================================================
INSERT INTO public.notifications (notification_type, message, related_athlete_id, related_game_id, is_read, created_at) VALUES
  ('document_expiring','Le passeport de Tom Bertemes expire dans 25 jours.','66666666-0000-0000-0000-000000000004', NULL, false, now() - interval '1 day'),
  ('document_expiring','Le certificat médical de Mike Folkmer expire dans 18 jours.','66666666-0000-0000-0000-000000000010', NULL, false, now() - interval '2 days'),
  ('document_expiring','Le passeport de Manon Reuter expire dans 12 jours.','66666666-0000-0000-0000-000000000037', NULL, false, now() - interval '3 days'),
  ('document_expiring','Certificat médical Lou Klein à renouveler sous 30 jours.','66666666-0000-0000-0000-000000000038', NULL, true, now() - interval '6 days'),
  ('document_expiring','Documents manquants pour Eric Theis.','66666666-0000-0000-0000-000000000039', NULL, false, now() - interval '4 days'),
  ('deadline_close','Deadline qualification JPEE 2027 (Athlétisme) dans 14 jours.', NULL,'77777777-0000-0000-0000-000000000001', false, now() - interval '1 day'),
  ('deadline_close','Deadline qualification JPEE 2027 (Natation) dans 14 jours.', NULL,'77777777-0000-0000-0000-000000000001', false, now() - interval '1 day'),
  ('deadline_close','Deadline programmes LA 2028 dans 60 jours.', NULL,'77777777-0000-0000-0000-000000000002', true, now() - interval '15 days'),
  ('selection_change','Sélection confirmée : Charel Schmit (100m H).','66666666-0000-0000-0000-000000000001','77777777-0000-0000-0000-000000000001', true, now() - interval '20 days'),
  ('selection_change','Pré-sélection : Sophie Wilmes (CLM F).','66666666-0000-0000-0000-000000000020','77777777-0000-0000-0000-000000000001', false, now() - interval '4 days'),
  ('selection_change','Réserve activée : Lisa Bertemes (100m F).','66666666-0000-0000-0000-000000000007','77777777-0000-0000-0000-000000000001', false, now() - interval '2 days'),
  ('selection_change','Sélection refusée : Laura Wagner (-63kg F).','66666666-0000-0000-0000-000000000025','77777777-0000-0000-0000-000000000001', true, now() - interval '7 days'),
  ('kyc_incomplete','KYC incomplet : Gilles Wagner (statut rouge).','66666666-0000-0000-0000-000000000036', NULL, false, now() - interval '2 days'),
  ('kyc_incomplete','KYC incomplet : Lou Klein (statut rouge).','66666666-0000-0000-0000-000000000038', NULL, false, now() - interval '3 days'),
  ('kyc_incomplete','KYC incomplet : Lynn Theis (statut rouge).','66666666-0000-0000-0000-000000000040', NULL, true, now() - interval '10 days');

COMMIT;

-- ============================================================================
-- FIN DU SEED
-- Pour créer les utilisateurs auth correspondants (à exécuter SÉPARÉMENT,
-- depuis un script Node/Deno avec service_role key) :
--
--   await supabase.auth.admin.createUser({
--     email: 'felix.retter@coslbloobiz.local',
--     password: 'ChangeMe!2026',
--     email_confirm: true,
--     user_metadata: { username: 'felix.retter', full_name: 'Felix Retter', role: 'admin' }
--   })
-- ============================================================================
