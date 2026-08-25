-- Spin360 V2 Phase 1: Datenintegrität, rückwärtskompatibel.
-- Alle V2-Spalten (quality_score, attempt_count, source_kind, reference_metadata,
-- source_mode, keyframe_count, qa_summary, manifest_version, identity_hash,
-- angle_degrees, is_generated, normalization_status) sowie der Unique-Index
-- (job_id, frame_index) existieren bereits; hier folgen nur die Restpunkte.

-- 1) Neue Jobs defaulten auf 48 Frames (bestehende Zeilen bleiben unverändert).
ALTER TABLE public.spin360_jobs ALTER COLUMN target_frame_count SET DEFAULT 48;

-- 2) Nur unterstützte Stufen für NEUE/aktualisierte Zeilen; Legacy 36 bleibt erlaubt
--    und NOT VALID sorgt dafür, dass Altbestand nicht geprüft/gebrochen wird.
ALTER TABLE public.spin360_jobs
  DROP CONSTRAINT IF EXISTS spin360_jobs_target_frame_count_chk;
ALTER TABLE public.spin360_jobs
  ADD CONSTRAINT spin360_jobs_target_frame_count_chk
  CHECK (target_frame_count IN (32, 36, 48)) NOT VALID;

-- 3) Keyframe-Winkel als numeric (Zwischenwinkel wie 7.5 möglich).
ALTER TABLE public.spin360_canonical_images
  ALTER COLUMN angle_degrees TYPE numeric USING angle_degrees::numeric;

-- 4) Defensiv: Spalten-Defaults der V2-Felder festschreiben.
ALTER TABLE public.spin360_generated_frames
  ALTER COLUMN attempt_count SET DEFAULT 0,
  ALTER COLUMN reference_metadata SET DEFAULT '{}'::jsonb;
ALTER TABLE public.spin360_jobs
  ALTER COLUMN keyframe_count SET DEFAULT 8,
  ALTER COLUMN qa_summary SET DEFAULT '{}'::jsonb,
  ALTER COLUMN manifest_version SET DEFAULT 2;
ALTER TABLE public.spin360_canonical_images
  ALTER COLUMN is_generated SET DEFAULT false;