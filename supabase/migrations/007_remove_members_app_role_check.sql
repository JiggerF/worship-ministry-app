-- Migration: Remove app_role check constraint to allow Admins and Coordinators to have musician/team roles
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_app_role_check;
