-- Renumérotation séquentielle des IDs adhérents et donateurs par année chronologique.
-- Tri : date_adhesion / date_don ASC, puis created_at, puis id en cas d'égalité.
-- PostgreSQL évalue les contraintes UNIQUE en fin d'instruction (pas ligne par ligne) :
-- un seul UPDATE par table suffit, sans désactiver la contrainte.
--
-- Mapping adhérents appliqué :
--   HSI-2025-0002 → HSI-2025-0001  (KADIRI HAMID)
--   HSI-2026-0001 → HSI-2026-0001  (BELHAJ Oum)        inchangé
--   HSI-2026-0009 → HSI-2026-0002  (Belhaj Mohammed)
--   HSI-2026-0008 → HSI-2026-0003  (BELHAJ Rachid)
--   HSI-2026-0004 → HSI-2026-0004  (Kouachi Cherif)     inchangé
--   HSI-2026-0005 → HSI-2026-0005  (Durant Acia)        inchangé
--   HSI-2026-0006 → HSI-2026-0006  (Mahamat Ali Choueb) inchangé
--   HSI-2026-0007 → HSI-2026-0007  (Marroki Sheima)     inchangé
--   HSI-2026-0010 → HSI-2026-0008  (Durant Sylvère)
--   HSI-2026-0003 → HSI-2026-0009  (OUAHI Hakim)
--   HSI-2026-0011 → HSI-2026-0010  (MARROKI Mohamed)
--   HSI-2026-0012 → HSI-2026-0011  (MARROKI Ilhame)
--
-- Mapping donateurs appliqué :
--   DON-2024-0022 → DON-2024-0001  (Belhaj Mohammed)
--   DON-2024-0021 → DON-2024-0002  (Talbi Rachid)
--   DON-2024-0020 → DON-2024-0003  (BELHAJ Oum)
--   DON-2024-0019 → DON-2024-0004  (BELHAJ Ines)
--   DON-2024-0017 → DON-2024-0005  (FETOUAGUI Kawtar)
--   DON-2024-0016 → DON-2024-0006  (Ben ali Issam)
--   DON-2024-0014 → DON-2024-0007  (Heron Emma)
--   DON-2024-0015 → DON-2024-0008  (Tixier Salome)
--   DON-2024-0012 → DON-2024-0009  (Tixier Rachel)
--   DON-2024-0013 → DON-2024-0010  (DEHAYE CHRISTELLE)
--   DON-2025-0011 → DON-2025-0001  (Mahmoudi Rizelaine)
--   DON-2025-0009 → DON-2025-0002  (Bessam Sabrina)
--   DON-2025-0008 → DON-2025-0003  (Benserhire Hanane)
--   DON-2025-0006 → DON-2025-0004  (Tixier Laurent)
--   DON-2025-0005 → DON-2025-0005  (Caillaud Jihane)    inchangé
--   DON-2025-0004 → DON-2025-0006  (Driancourt Theo)
--   DON-2025-0003 → DON-2025-0007  (Ouahi Sabria)
--   DON-2026-0023 → DON-2026-0001  (BELHAJ Fatima)
--   DON-2026-0002 → DON-2026-0002  (BELHAJ Nawel)       inchangé
--   DON-2026-0001 → DON-2026-0003  (BJS IT CONSULTING)

-- Note : la contrainte UNIQUE est supprimée puis recréée car le client Supabase CLI
-- évalue les violations par ligne (pas en fin d'instruction), ce qui bloque le shuffle.

ALTER TABLE adherents DROP CONSTRAINT adherents_id_adherent_unique;
ALTER TABLE donateurs DROP CONSTRAINT donateurs_id_donateur_unique;

-- ===== ADHÉRENTS =====
UPDATE adherents
SET id_adherent = mapping.nouvel_id
FROM (
  SELECT id,
    CONCAT('HSI-', saison, '-', LPAD(ROW_NUMBER() OVER (
      PARTITION BY saison ORDER BY date_adhesion, created_at, id::text
    )::text, 4, '0')) AS nouvel_id
  FROM adherents
) AS mapping
WHERE adherents.id = mapping.id;

-- ===== DONATEURS =====
UPDATE donateurs
SET id_donateur = mapping.nouvel_id
FROM (
  SELECT id,
    CONCAT('DON-', EXTRACT(YEAR FROM date_don::date)::text, '-', LPAD(ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM date_don::date) ORDER BY date_don, created_at, id::text
    )::text, 4, '0')) AS nouvel_id
  FROM donateurs
) AS mapping
WHERE donateurs.id = mapping.id;

ALTER TABLE adherents ADD CONSTRAINT adherents_id_adherent_unique UNIQUE (id_adherent);
ALTER TABLE donateurs ADD CONSTRAINT donateurs_id_donateur_unique UNIQUE (id_donateur);
