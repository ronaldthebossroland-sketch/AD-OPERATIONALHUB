create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null default '',
  role text not null default 'admin',
  app_source text not null default 'eva',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists role text not null default 'admin';
alter table public.profiles add column if not exists app_source text not null default 'eva';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text not null default '',
  priority text not null default 'Medium',
  status text not null default 'To do',
  due_date text not null default '',
  owner text not null default '',
  app_source text not null default 'eva',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks add column if not exists details text not null default '';
alter table public.tasks add column if not exists priority text not null default 'Medium';
alter table public.tasks add column if not exists status text not null default 'To do';
alter table public.tasks add column if not exists due_date text not null default '';
alter table public.tasks add column if not exists owner text not null default '';
alter table public.tasks add column if not exists app_source text not null default 'eva';
alter table public.tasks add column if not exists created_at timestamptz not null default now();
alter table public.tasks add column if not exists updated_at timestamptz not null default now();

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  meeting_date text not null default '',
  start_time text not null default '',
  end_time text not null default '',
  attendees text[] not null default '{}',
  location text not null default '',
  agenda text not null default '',
  reminder_minutes integer not null default 15,
  status text not null default 'scheduled',
  device_calendar_event_id text not null default '',
  calendar_sync_enabled boolean not null default false,
  calendar_sync_status text not null default 'not_synced',
  calendar_name text not null default '',
  notification_id text not null default '',
  reminder_scheduled boolean not null default false,
  reminder_status text not null default 'not_scheduled',
  app_source text not null default 'eva',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meetings add column if not exists meeting_date text not null default '';
alter table public.meetings add column if not exists start_time text not null default '';
alter table public.meetings add column if not exists end_time text not null default '';
alter table public.meetings add column if not exists attendees text[] not null default '{}';
alter table public.meetings add column if not exists location text not null default '';
alter table public.meetings add column if not exists agenda text not null default '';
alter table public.meetings add column if not exists reminder_minutes integer not null default 15;
alter table public.meetings add column if not exists status text not null default 'scheduled';
alter table public.meetings add column if not exists device_calendar_event_id text not null default '';
alter table public.meetings add column if not exists calendar_sync_enabled boolean not null default false;
alter table public.meetings add column if not exists calendar_sync_status text not null default 'not_synced';
alter table public.meetings add column if not exists calendar_name text not null default '';
alter table public.meetings add column if not exists notification_id text not null default '';
alter table public.meetings add column if not exists reminder_scheduled boolean not null default false;
alter table public.meetings add column if not exists reminder_status text not null default 'not_scheduled';
alter table public.meetings add column if not exists app_source text not null default 'eva';
alter table public.meetings add column if not exists created_at timestamptz not null default now();
alter table public.meetings add column if not exists updated_at timestamptz not null default now();

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text not null default '',
  reminder_time text not null default '',
  status text not null default 'pending',
  app_source text not null default 'eva',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reminders add column if not exists details text not null default '';
alter table public.reminders add column if not exists reminder_time text not null default '';
alter table public.reminders add column if not exists status text not null default 'pending';
alter table public.reminders add column if not exists app_source text not null default 'eva';
alter table public.reminders add column if not exists created_at timestamptz not null default now();
alter table public.reminders add column if not exists updated_at timestamptz not null default now();

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'Note',
  content text not null default '',
  summary text not null default '',
  app_source text not null default 'eva',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.documents add column if not exists type text not null default 'Note';
alter table public.documents add column if not exists content text not null default '';
alter table public.documents add column if not exists summary text not null default '';
alter table public.documents add column if not exists app_source text not null default 'eva';
alter table public.documents add column if not exists created_at timestamptz not null default now();
alter table public.documents add column if not exists updated_at timestamptz not null default now();

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  body text not null default '',
  app_source text not null default 'eva',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes add column if not exists title text not null default '';
alter table public.notes add column if not exists body text not null default '';
alter table public.notes add column if not exists app_source text not null default 'eva';
alter table public.notes add column if not exists created_at timestamptz not null default now();
alter table public.notes add column if not exists updated_at timestamptz not null default now();

create table if not exists public.assistant_chats (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'EVA conversation',
  app_source text not null default 'eva',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assistant_chats add column if not exists title text not null default 'EVA conversation';
alter table public.assistant_chats add column if not exists app_source text not null default 'eva';
alter table public.assistant_chats add column if not exists created_at timestamptz not null default now();
alter table public.assistant_chats add column if not exists updated_at timestamptz not null default now();

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references public.assistant_chats(id) on delete cascade,
  role text not null default 'assistant',
  content text not null default '',
  app_source text not null default 'eva',
  created_at timestamptz not null default now()
);

alter table public.assistant_messages add column if not exists chat_id uuid references public.assistant_chats(id) on delete cascade;
alter table public.assistant_messages add column if not exists role text not null default 'assistant';
alter table public.assistant_messages add column if not exists content text not null default '';
alter table public.assistant_messages add column if not exists app_source text not null default 'eva';
alter table public.assistant_messages add column if not exists created_at timestamptz not null default now();

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  appearance_mode text not null default 'dark',
  voice_mode text not null default 'calm',
  ai_behavior text not null default 'executive',
  notification_enabled boolean not null default true,
  calendar_sync_enabled boolean not null default false,
  default_meeting_reminder_minutes integer not null default 15,
  app_source text not null default 'eva',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences add column if not exists appearance_mode text not null default 'dark';
alter table public.user_preferences add column if not exists voice_mode text not null default 'calm';
alter table public.user_preferences add column if not exists ai_behavior text not null default 'executive';
alter table public.user_preferences add column if not exists notification_enabled boolean not null default true;
alter table public.user_preferences add column if not exists calendar_sync_enabled boolean not null default false;
alter table public.user_preferences add column if not exists default_meeting_reminder_minutes integer not null default 15;
alter table public.user_preferences add column if not exists app_source text not null default 'eva';
alter table public.user_preferences add column if not exists created_at timestamptz not null default now();
alter table public.user_preferences add column if not exists updated_at timestamptz not null default now();

alter table public.profiles add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.tasks add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.meetings add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.reminders add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.documents add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.notes add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.assistant_chats add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.assistant_messages add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.user_preferences add column if not exists user_id uuid references auth.users(id) on delete cascade;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_meetings_updated_at on public.meetings;
create trigger set_meetings_updated_at
before update on public.meetings
for each row execute function public.set_updated_at();

drop trigger if exists set_reminders_updated_at on public.reminders;
create trigger set_reminders_updated_at
before update on public.reminders
for each row execute function public.set_updated_at();

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists set_notes_updated_at on public.notes;
create trigger set_notes_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

drop trigger if exists set_assistant_chats_updated_at on public.assistant_chats;
create trigger set_assistant_chats_updated_at
before update on public.assistant_chats
for each row execute function public.set_updated_at();

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.meetings enable row level security;
alter table public.reminders enable row level security;
alter table public.documents enable row level security;
alter table public.notes enable row level security;
alter table public.assistant_chats enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.user_preferences enable row level security;

drop policy if exists eva_profiles_select_own on public.profiles;
drop policy if exists eva_profiles_insert_own on public.profiles;
drop policy if exists eva_profiles_update_own on public.profiles;
drop policy if exists eva_profiles_delete_own on public.profiles;
create policy eva_profiles_select_own on public.profiles
for select to authenticated using (app_source = 'eva' and user_id = auth.uid());
create policy eva_profiles_insert_own on public.profiles
for insert to authenticated with check (app_source = 'eva' and user_id = auth.uid());
create policy eva_profiles_update_own on public.profiles
for update to authenticated using (app_source = 'eva' and user_id = auth.uid())
with check (app_source = 'eva' and user_id = auth.uid());
create policy eva_profiles_delete_own on public.profiles
for delete to authenticated using (app_source = 'eva' and user_id = auth.uid());

drop policy if exists eva_tasks_select_own on public.tasks;
drop policy if exists eva_tasks_insert_own on public.tasks;
drop policy if exists eva_tasks_update_own on public.tasks;
drop policy if exists eva_tasks_delete_own on public.tasks;
create policy eva_tasks_select_own on public.tasks
for select to authenticated using (app_source = 'eva' and user_id = auth.uid());
create policy eva_tasks_insert_own on public.tasks
for insert to authenticated with check (app_source = 'eva' and user_id = auth.uid());
create policy eva_tasks_update_own on public.tasks
for update to authenticated using (app_source = 'eva' and user_id = auth.uid())
with check (app_source = 'eva' and user_id = auth.uid());
create policy eva_tasks_delete_own on public.tasks
for delete to authenticated using (app_source = 'eva' and user_id = auth.uid());

drop policy if exists eva_meetings_select_own on public.meetings;
drop policy if exists eva_meetings_insert_own on public.meetings;
drop policy if exists eva_meetings_update_own on public.meetings;
drop policy if exists eva_meetings_delete_own on public.meetings;
create policy eva_meetings_select_own on public.meetings
for select to authenticated using (app_source = 'eva' and user_id = auth.uid());
create policy eva_meetings_insert_own on public.meetings
for insert to authenticated with check (app_source = 'eva' and user_id = auth.uid());
create policy eva_meetings_update_own on public.meetings
for update to authenticated using (app_source = 'eva' and user_id = auth.uid())
with check (app_source = 'eva' and user_id = auth.uid());
create policy eva_meetings_delete_own on public.meetings
for delete to authenticated using (app_source = 'eva' and user_id = auth.uid());

drop policy if exists eva_reminders_select_own on public.reminders;
drop policy if exists eva_reminders_insert_own on public.reminders;
drop policy if exists eva_reminders_update_own on public.reminders;
drop policy if exists eva_reminders_delete_own on public.reminders;
create policy eva_reminders_select_own on public.reminders
for select to authenticated using (app_source = 'eva' and user_id = auth.uid());
create policy eva_reminders_insert_own on public.reminders
for insert to authenticated with check (app_source = 'eva' and user_id = auth.uid());
create policy eva_reminders_update_own on public.reminders
for update to authenticated using (app_source = 'eva' and user_id = auth.uid())
with check (app_source = 'eva' and user_id = auth.uid());
create policy eva_reminders_delete_own on public.reminders
for delete to authenticated using (app_source = 'eva' and user_id = auth.uid());

drop policy if exists eva_documents_select_own on public.documents;
drop policy if exists eva_documents_insert_own on public.documents;
drop policy if exists eva_documents_update_own on public.documents;
drop policy if exists eva_documents_delete_own on public.documents;
create policy eva_documents_select_own on public.documents
for select to authenticated using (app_source = 'eva' and user_id = auth.uid());
create policy eva_documents_insert_own on public.documents
for insert to authenticated with check (app_source = 'eva' and user_id = auth.uid());
create policy eva_documents_update_own on public.documents
for update to authenticated using (app_source = 'eva' and user_id = auth.uid())
with check (app_source = 'eva' and user_id = auth.uid());
create policy eva_documents_delete_own on public.documents
for delete to authenticated using (app_source = 'eva' and user_id = auth.uid());

drop policy if exists eva_notes_select_own on public.notes;
drop policy if exists eva_notes_insert_own on public.notes;
drop policy if exists eva_notes_update_own on public.notes;
drop policy if exists eva_notes_delete_own on public.notes;
create policy eva_notes_select_own on public.notes
for select to authenticated using (app_source = 'eva' and user_id = auth.uid());
create policy eva_notes_insert_own on public.notes
for insert to authenticated with check (app_source = 'eva' and user_id = auth.uid());
create policy eva_notes_update_own on public.notes
for update to authenticated using (app_source = 'eva' and user_id = auth.uid())
with check (app_source = 'eva' and user_id = auth.uid());
create policy eva_notes_delete_own on public.notes
for delete to authenticated using (app_source = 'eva' and user_id = auth.uid());

drop policy if exists eva_assistant_chats_select_own on public.assistant_chats;
drop policy if exists eva_assistant_chats_insert_own on public.assistant_chats;
drop policy if exists eva_assistant_chats_update_own on public.assistant_chats;
drop policy if exists eva_assistant_chats_delete_own on public.assistant_chats;
create policy eva_assistant_chats_select_own on public.assistant_chats
for select to authenticated using (app_source = 'eva' and user_id = auth.uid());
create policy eva_assistant_chats_insert_own on public.assistant_chats
for insert to authenticated with check (app_source = 'eva' and user_id = auth.uid());
create policy eva_assistant_chats_update_own on public.assistant_chats
for update to authenticated using (app_source = 'eva' and user_id = auth.uid())
with check (app_source = 'eva' and user_id = auth.uid());
create policy eva_assistant_chats_delete_own on public.assistant_chats
for delete to authenticated using (app_source = 'eva' and user_id = auth.uid());

drop policy if exists eva_assistant_messages_select_own on public.assistant_messages;
drop policy if exists eva_assistant_messages_insert_own on public.assistant_messages;
drop policy if exists eva_assistant_messages_update_own on public.assistant_messages;
drop policy if exists eva_assistant_messages_delete_own on public.assistant_messages;
create policy eva_assistant_messages_select_own on public.assistant_messages
for select to authenticated using (app_source = 'eva' and user_id = auth.uid());
create policy eva_assistant_messages_insert_own on public.assistant_messages
for insert to authenticated with check (app_source = 'eva' and user_id = auth.uid());
create policy eva_assistant_messages_update_own on public.assistant_messages
for update to authenticated using (app_source = 'eva' and user_id = auth.uid())
with check (app_source = 'eva' and user_id = auth.uid());
create policy eva_assistant_messages_delete_own on public.assistant_messages
for delete to authenticated using (app_source = 'eva' and user_id = auth.uid());

drop policy if exists eva_user_preferences_select_own on public.user_preferences;
drop policy if exists eva_user_preferences_insert_own on public.user_preferences;
drop policy if exists eva_user_preferences_update_own on public.user_preferences;
drop policy if exists eva_user_preferences_delete_own on public.user_preferences;
create policy eva_user_preferences_select_own on public.user_preferences
for select to authenticated using (app_source = 'eva' and user_id = auth.uid());
create policy eva_user_preferences_insert_own on public.user_preferences
for insert to authenticated with check (app_source = 'eva' and user_id = auth.uid());
create policy eva_user_preferences_update_own on public.user_preferences
for update to authenticated using (app_source = 'eva' and user_id = auth.uid())
with check (app_source = 'eva' and user_id = auth.uid());
create policy eva_user_preferences_delete_own on public.user_preferences
for delete to authenticated using (app_source = 'eva' and user_id = auth.uid());

grant usage on schema public to anon, authenticated;
revoke all on
  public.profiles,
  public.tasks,
  public.meetings,
  public.reminders,
  public.documents,
  public.notes,
  public.assistant_chats,
  public.assistant_messages,
  public.user_preferences
from anon;

grant select, insert, update, delete on
  public.profiles,
  public.tasks,
  public.meetings,
  public.reminders,
  public.documents,
  public.notes,
  public.assistant_chats,
  public.assistant_messages,
  public.user_preferences
to authenticated;

create index if not exists profiles_app_source_created_at_idx
on public.profiles (app_source, created_at desc);
create index if not exists profiles_user_id_app_source_created_at_idx
on public.profiles (user_id, app_source, created_at desc);

create index if not exists tasks_app_source_created_at_idx
on public.tasks (app_source, created_at desc);
create index if not exists tasks_user_id_app_source_created_at_idx
on public.tasks (user_id, app_source, created_at desc);

create index if not exists meetings_app_source_created_at_idx
on public.meetings (app_source, created_at desc);
create index if not exists meetings_user_id_app_source_created_at_idx
on public.meetings (user_id, app_source, created_at desc);

create index if not exists reminders_app_source_created_at_idx
on public.reminders (app_source, created_at desc);
create index if not exists reminders_user_id_app_source_created_at_idx
on public.reminders (user_id, app_source, created_at desc);

create index if not exists documents_user_id_app_source_created_at_idx
on public.documents (user_id, app_source, created_at desc);

create index if not exists notes_user_id_app_source_created_at_idx
on public.notes (user_id, app_source, created_at desc);

create index if not exists assistant_chats_app_source_updated_at_idx
on public.assistant_chats (app_source, updated_at desc);
create index if not exists assistant_chats_user_id_app_source_updated_at_idx
on public.assistant_chats (user_id, app_source, updated_at desc);

create index if not exists assistant_messages_chat_created_at_idx
on public.assistant_messages (chat_id, created_at asc);
create index if not exists assistant_messages_user_id_chat_created_at_idx
on public.assistant_messages (user_id, chat_id, created_at asc);

create index if not exists user_preferences_app_source_created_at_idx
on public.user_preferences (app_source, created_at desc);
create index if not exists user_preferences_user_id_app_source_created_at_idx
on public.user_preferences (user_id, app_source, created_at desc);
