-- BJS IT CONSULTING : correction des champs nom/prenom/organisme
-- Bejaoui Skander est le responsable (personne physique), BJS IT CONSULTING est l'organisme.

UPDATE donateurs
SET organisme = 'BJS IT CONSULTING',
    nom       = 'BEJAOUI',
    prenom    = 'Skander'
WHERE id_donateur = 'DON-2026-0003';
