-- BJS IT CONSULTING : nom = raison sociale, prenom = responsable (Skander Bejaoui), organisme vide.

UPDATE donateurs
SET nom       = 'BJS IT CONSULTING',
    prenom    = 'Skander Bejaoui',
    organisme = NULL
WHERE id_donateur = 'DON-2026-0003';
