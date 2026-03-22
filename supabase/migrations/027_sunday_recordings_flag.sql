-- Migration 027: Feature flag for Sunday Recordings
-- Default off — admin uploads first, then platform enables per tenant.

INSERT INTO feature_flags (flag_key, label, description, default_enabled)
VALUES (
  'sunday_recordings',
  'Sunday Recordings',
  'Musicians can listen to past Sunday service recordings via the portal.',
  false
);
