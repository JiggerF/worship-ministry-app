-- Migration: Add all planned roles to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'Coordinator';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'MusicCoordinator';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'WorshipLeader';
