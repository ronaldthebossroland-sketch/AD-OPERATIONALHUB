-- EVA reminder notification metadata.
-- Safe to run more than once. Does not delete or rewrite existing reminders.

alter table public.reminders
add column if not exists notification_id text not null default '';

alter table public.reminders
add column if not exists reminder_scheduled boolean not null default false;

alter table public.reminders
add column if not exists reminder_status text not null default 'not_scheduled';
