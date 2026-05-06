-- Safe additive migration for EVA native device calendar and local reminder sync.
-- Run this in the Supabase SQL editor. It does not delete or rewrite existing rows.

alter table public.meetings add column if not exists device_calendar_event_id text not null default '';
alter table public.meetings add column if not exists calendar_sync_enabled boolean not null default false;
alter table public.meetings add column if not exists calendar_sync_status text not null default 'not_synced';
alter table public.meetings add column if not exists calendar_name text not null default '';
alter table public.meetings add column if not exists notification_id text not null default '';
alter table public.meetings add column if not exists reminder_scheduled boolean not null default false;
alter table public.meetings add column if not exists reminder_status text not null default 'not_scheduled';

alter table public.user_preferences add column if not exists calendar_sync_enabled boolean not null default false;
alter table public.user_preferences add column if not exists default_meeting_reminder_minutes integer not null default 15;

create index if not exists meetings_app_source_calendar_sync_idx
on public.meetings (app_source, calendar_sync_status, created_at desc);
