-- 018_handbook_add_tech_coordinator.sql
-- Adds the Tech Coordinator role page to the Team Handbook.

INSERT INTO handbook_documents (slug, title, content, major_version, minor_version, is_current, change_type, what_changed, why_changed)
VALUES (
  'roles-tech-coordinator',
  'Tech Coordinator',
  '',
  1, 0, true, 'minor',
  ARRAY['Initial document created', ''],
  'Added Tech Coordinator role to Team Handbook'
);
