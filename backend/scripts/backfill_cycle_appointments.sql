-- Backfill: Link appointments to cycles and create missing ones
-- Run: psql -d chemocare -f scripts/backfill_cycle_appointments.sql

-- 1. Link existing appointments to cycles by matching patient_id + scheduled_date
UPDATE appointments a
SET cycle_id = tc.id
FROM treatment_cycles tc
JOIN treatment_plans tp ON tp.id = tc.treatment_plan_id
WHERE a.patient_id = tp.patient_id
  AND a.scheduled_date = tc.scheduled_date
  AND a.cycle_id IS NULL
  AND a.appointment_type = 'DAYCARE_CHEMO';

-- 2. Create appointments for cycles that still have no appointment
INSERT INTO appointments (id, patient_id, appointment_type, scheduled_date, scheduled_time, duration_mins, cycle_id, status, created_at, updated_at)
SELECT
  gen_random_uuid(),
  tp.patient_id,
  'DAYCARE_CHEMO'::appointmenttype,
  tc.scheduled_date,
  '09:00:00',
  180,
  tc.id,
  CASE WHEN tc.status = 'completed' THEN 'COMPLETED'::appointmentstatus ELSE 'SCHEDULED'::appointmentstatus END,
  NOW(),
  NOW()
FROM treatment_cycles tc
JOIN treatment_plans tp ON tp.id = tc.treatment_plan_id
LEFT JOIN appointments a ON a.cycle_id = tc.id
WHERE a.id IS NULL;

-- 3. Update appointment status to match cycle status for completed cycles
UPDATE appointments a
SET status = 'COMPLETED'
FROM treatment_cycles tc
WHERE a.cycle_id = tc.id AND tc.status = 'completed' AND a.status != 'COMPLETED';
