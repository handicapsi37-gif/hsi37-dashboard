CREATE TABLE IF NOT EXISTS prets (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  article_id            bigint REFERENCES inventaire(id) ON DELETE SET NULL,
  emprunteur_nom        text NOT NULL,
  emprunteur_prenom     text,
  emprunteur_telephone  text,
  date_pret             date NOT NULL,
  date_retour_prevue    date,
  date_retour_effective date,
  etat_retour           text,
  statut                text NOT NULL DEFAULT 'En cours'
                          CHECK (statut IN ('En cours', 'Retourné', 'En retard')),
  created_at            timestamptz NOT NULL DEFAULT now()
);
