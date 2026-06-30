-- Don manquant détecté dans recap pay asso.xlsx (absent de recapitulatif don.xlsx)
-- BEJAOUI Skander, don personnel mars 2025 (distinct du don société BJS IT CONSULTING)
-- Déjà inséré en base via API le 2026-06-30, migration ajoutée pour traçabilité.

INSERT INTO donateurs (id_donateur, nom, prenom, date_don, montant_don, type_don, mode_paiement)
VALUES ('DON-2025-0008', 'BEJAOUI', 'Skander', '2025-03-05', 1000, 'Don financier', 'Carte bancaire')
ON CONFLICT (id_donateur) DO NOTHING;
