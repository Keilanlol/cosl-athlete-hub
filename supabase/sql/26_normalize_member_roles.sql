-- Normalisation des rôles federation_members / club_members
-- Le seed initial avait inséré des labels FR ("Président") alors que l'UI
-- attend les valeurs canoniques ("president"). Sans ça, le président
-- n'apparaît pas dans la colonne "Président" ni dans le dashboard club.

UPDATE public.federation_members SET role = 'president'        WHERE role IN ('Président','président');
UPDATE public.federation_members SET role = 'vice_president'   WHERE role IN ('Vice-président','vice-président','Vice président');
UPDATE public.federation_members SET role = 'secretary_general' WHERE role IN ('Secrétaire général','Secrétaire générale','Secrétaire');
UPDATE public.federation_members SET role = 'treasurer'        WHERE role IN ('Trésorier','Trésorière');
UPDATE public.federation_members SET role = 'board_member'     WHERE role IN ('Membre du bureau');
UPDATE public.federation_members SET role = 'delegate'         WHERE role IN ('Délégué','Déléguée');

UPDATE public.club_members SET role = 'president'      WHERE role IN ('Président','président');
UPDATE public.club_members SET role = 'vice_president' WHERE role IN ('Vice-président','vice-président','Vice président');
UPDATE public.club_members SET role = 'secretary'      WHERE role IN ('Secrétaire');
UPDATE public.club_members SET role = 'treasurer'      WHERE role IN ('Trésorier','Trésorière');
UPDATE public.club_members SET role = 'board_member'   WHERE role IN ('Membre du bureau');
UPDATE public.club_members SET role = 'head_coach'     WHERE role IN ('Entraîneur principal','Entraineur principal');

NOTIFY pgrst, 'reload schema';
