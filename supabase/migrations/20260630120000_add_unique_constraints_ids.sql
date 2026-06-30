-- Ajout de contraintes UNIQUE sur les identifiants métier
-- Contexte : id_adherent et id_donateur étaient stockés en base mais sans contrainte UNIQUE.
-- Sans cette contrainte, une race condition (deux créations simultanées) pouvait produire
-- des doublons silencieux côté Supabase, entraînant des IDs incohérents à l'affichage.
-- Appliqué le 2026-06-30 sur le projet tafxmyylkzmxeyzztejw.

ALTER TABLE adherents
  ADD CONSTRAINT adherents_id_adherent_unique UNIQUE (id_adherent);

ALTER TABLE donateurs
  ADD CONSTRAINT donateurs_id_donateur_unique UNIQUE (id_donateur);
