ALTER TABLE inventaire
  ADD COLUMN IF NOT EXISTS prix_neuf numeric,
  ADD COLUMN IF NOT EXISTS notes     text;
