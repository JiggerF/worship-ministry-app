-- Migration 026: Sunday Recordings
-- Stores Google Drive links to post-service audio/video recordings.
-- Featured team is derived at query time from roster — not stored here.

CREATE TABLE sunday_recordings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title            text NOT NULL,
  sunday_date      date NOT NULL,
  recording_type   text NOT NULL DEFAULT 'audio'
                   CHECK (recording_type IN ('audio', 'video')),
  drive_url        text NOT NULL,
  duration_seconds integer,          -- optional, admin fills manually
  uploaded_by      uuid REFERENCES members(id),
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sunday_recordings_tenant_unique
    UNIQUE (tenant_id, sunday_date, title)
);

CREATE INDEX idx_sunday_recordings_tenant_date
  ON sunday_recordings (tenant_id, sunday_date DESC);
