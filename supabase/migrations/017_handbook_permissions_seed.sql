-- 017_handbook_permissions_seed.sql
-- Seeds the default handbook edit permissions into app_settings.
-- By default, Admin and Coordinator can edit. Others (WorshipLeader, MusicCoordinator) are off.
insert into public.app_settings (key, value)
select 'handbook_permissions', '{"editor_roles": ["Admin", "Coordinator"], "editor_member_ids": []}'::jsonb
where not exists (select 1 from public.app_settings where key = 'handbook_permissions');
