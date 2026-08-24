-- Migration 004: Attendance System Upgrade
-- Adds: break tracking, geolocation, total_hours, source tracking, attendance settings

-- New columns on attendance table
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS break_start TIMESTAMPTZ;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS break_end TIMESTAMPTZ;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS break_minutes NUMERIC DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS total_hours NUMERIC DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_in_location JSONB;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_out_location JSONB;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manager';

-- Attendance settings
INSERT INTO store_settings ("key", value) VALUES
  ('attendance.lateGraceMinutes', '5'),
  ('attendance.overtimeThresholdHours', '8'),
  ('attendance.autoClockOut', 'false'),
  ('attendance.autoClockOutTime', '23:00'),
  ('attendance.enableGeolocation', 'false'),
  ('attendance.requiredRadiusMeters', '100'),
  ('attendance.storeLatitude', '30.0444'),
  ('attendance.storeLongitude', '31.2357')
ON CONFLICT ("key") DO NOTHING;
