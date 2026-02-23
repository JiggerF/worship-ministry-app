-- Migration 008: Audit Log
-- Tracks mutations to songs and roster by Admin/Coordinator users.

CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  timestamptz DEFAULT now() NOT NULL,
  actor_id    uuid        REFERENCES members(id) ON DELETE SET NULL,
  actor_name  text        NOT NULL,   -- denormalized so it survives member deletion
  actor_role  text        NOT NULL,   -- Admin | Coordinator
  action      text        NOT NULL,   -- create_song | update_song | delete_song | save_roster_draft | finalize_roster | revert_roster | save_roster_note
  entity_type text        NOT NULL,   -- song | roster
  entity_id   text,                   -- song uuid OR YYYY-MM month string
  summary     text        NOT NULL    -- human-readable: "Created song 'Amazing Grace'"
);

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at DESC);
