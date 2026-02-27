-- Migration 012: Availability Periods
-- Introduces coordinator-managed availability rounds.
-- Musicians fill out a form per period; responses are stored per Sunday.
-- Replaces the implicit T+1 model with explicit coordinator-defined windows.

-- A single "send" — e.g. "April–May 2026"
CREATE TABLE IF NOT EXISTS availability_periods (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   timestamptz DEFAULT now() NOT NULL,
  created_by   uuid        REFERENCES members(id) ON DELETE SET NULL,
  label        text        NOT NULL,   -- e.g. "April–May 2026"
  starts_on    date        NOT NULL,   -- first Sunday in scope
  ends_on      date        NOT NULL,   -- last Sunday in scope
  deadline     date,                   -- expected response date (informational)
  closed_at    timestamptz             -- null = open, set when coordinator closes
);

-- One row per musician per period
CREATE TABLE IF NOT EXISTS availability_responses (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  submitted_at timestamptz DEFAULT now() NOT NULL,
  updated_at   timestamptz DEFAULT now() NOT NULL,
  period_id    uuid        REFERENCES availability_periods(id) ON DELETE CASCADE NOT NULL,
  member_id    uuid        REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  notes        text,
  UNIQUE (period_id, member_id)
);

-- One row per Sunday per response — the actual per-date availability
CREATE TABLE IF NOT EXISTS availability_dates (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id uuid    REFERENCES availability_responses(id) ON DELETE CASCADE NOT NULL,
  date        date    NOT NULL,
  available   boolean NOT NULL,
  UNIQUE (response_id, date)
);

CREATE INDEX IF NOT EXISTS availability_periods_starts_on_idx ON availability_periods (starts_on DESC);
CREATE INDEX IF NOT EXISTS availability_responses_period_id_idx ON availability_responses (period_id);
CREATE INDEX IF NOT EXISTS availability_responses_member_id_idx ON availability_responses (member_id);
CREATE INDEX IF NOT EXISTS availability_dates_response_id_idx ON availability_dates (response_id);
