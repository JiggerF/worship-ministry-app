-- Migration 011: sunday_setlist table
--
-- Stores up to 3 songs selected by a worship-leading role for a given Sunday.
-- chosen_key is nullable; NULL means "fall back to chord_charts[0].key at display time".
-- status is DRAFT until the worship leader explicitly publishes.

CREATE TABLE IF NOT EXISTS public.sunday_setlist (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sunday_date   date NOT NULL,
  song_id       uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  position      integer NOT NULL CHECK (position BETWEEN 1 AND 3),
  chosen_key    text NULL,
  status        text NOT NULL DEFAULT 'DRAFT'
                  CHECK (status IN ('DRAFT', 'PUBLISHED')),
  created_by    uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (sunday_date, position)  -- one song per slot per Sunday
);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_sunday_setlist_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sunday_setlist_updated_at
BEFORE UPDATE ON public.sunday_setlist
FOR EACH ROW EXECUTE FUNCTION update_sunday_setlist_updated_at();
