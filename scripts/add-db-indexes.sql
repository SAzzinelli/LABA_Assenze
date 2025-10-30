-- Safe, idempotent index creation for performance
-- Run in Supabase SQL editor or via migration tool

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_user_date
  ON attendance (user_id, date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_schedules_user_dow
  ON work_schedules (user_id, day_of_week);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leave_requests_type_status_dates
  ON leave_requests (type, status, start_date, end_date);


