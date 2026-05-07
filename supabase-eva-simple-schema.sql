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
  notification_id text not null default '',
  reminder_scheduled boolean not null default false,
  reminder_status text not null default 'not_scheduled',
  app_source text not null default 'eva',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reminders add column if not exists details text not null default '';
alter table public.reminders add column if not exists reminder_time text not null default '';
alter table public.reminders add column if not exists status text not null default 'pending';
alter table public.reminders add column if not exists notification_id text not null default '';
alter table public.reminders add column if not exists reminder_scheduled boolean not null default false;
alter table public.reminders add column if not exists reminder_status text not null default 'not_scheduled';
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

create table if not exists public.eva_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'EVA Workspace',
  owner_id uuid references auth.users(id) on delete cascade,
  invite_code text not null default encode(gen_random_bytes(4), 'hex') unique,
  app_source text not null default 'eva',
  invite_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.eva_workspaces add column if not exists name text not null default 'EVA Workspace';
alter table public.eva_workspaces add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.eva_workspaces add column if not exists invite_code text not null default encode(gen_random_bytes(4), 'hex');
alter table public.eva_workspaces add column if not exists app_source text not null default 'eva';
alter table public.eva_workspaces add column if not exists invite_expires_at timestamptz;
alter table public.eva_workspaces add column if not exists created_at timestamptz not null default now();
alter table public.eva_workspaces add column if not exists updated_at timestamptz not null default now();

create unique index if not exists eva_workspaces_invite_code_key
on public.eva_workspaces (invite_code);

create table if not exists public.eva_workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.eva_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'member',
  status text not null default 'active',
  app_source text not null default 'eva',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.eva_workspace_members add column if not exists workspace_id uuid not null references public.eva_workspaces(id) on delete cascade;
alter table public.eva_workspace_members add column if not exists user_id uuid not null references auth.users(id) on delete cascade;
alter table public.eva_workspace_members add column if not exists display_name text not null default '';
alter table public.eva_workspace_members add column if not exists role text not null default 'member';
alter table public.eva_workspace_members add column if not exists status text not null default 'active';
alter table public.eva_workspace_members add column if not exists app_source text not null default 'eva';
alter table public.eva_workspace_members add column if not exists created_at timestamptz not null default now();
alter table public.eva_workspace_members add column if not exists updated_at timestamptz not null default now();

create unique index if not exists eva_workspace_members_workspace_user_key
on public.eva_workspace_members (workspace_id, user_id);

alter table public.tasks add column if not exists workspace_id uuid references public.eva_workspaces(id) on delete set null;
alter table public.tasks add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.tasks add column if not exists assigned_to uuid references auth.users(id) on delete set null;

alter table public.meetings add column if not exists workspace_id uuid references public.eva_workspaces(id) on delete set null;
alter table public.reminders add column if not exists workspace_id uuid references public.eva_workspaces(id) on delete set null;

create or replace function public.eva_workspace_role(workspace uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select member.role
  from public.eva_workspace_members member
  where member.workspace_id = workspace
    and member.user_id = auth.uid()
    and member.status = 'active'
    and member.app_source = 'eva'
  limit 1
$$;

create or replace function public.eva_workspace_is_member(workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.eva_workspace_role(workspace) is not null
$$;

create or replace function public.eva_workspace_can_edit(workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.eva_workspace_role(workspace), '') in ('owner', 'admin', 'member')
$$;

create or replace function public.eva_workspace_can_admin(workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.eva_workspace_role(workspace), '') in ('owner', 'admin')
$$;

drop trigger if exists set_eva_workspaces_updated_at on public.eva_workspaces;
create trigger set_eva_workspaces_updated_at
before update on public.eva_workspaces
for each row execute function public.set_updated_at();

drop trigger if exists set_eva_workspace_members_updated_at on public.eva_workspace_members;
create trigger set_eva_workspace_members_updated_at
before update on public.eva_workspace_members
for each row execute function public.set_updated_at();

alter table public.eva_workspaces enable row level security;
alter table public.eva_workspace_members enable row level security;

drop policy if exists eva_workspaces_select_member on public.eva_workspaces;
drop policy if exists eva_workspaces_insert_owner on public.eva_workspaces;
drop policy if exists eva_workspaces_update_admin on public.eva_workspaces;
drop policy if exists eva_workspaces_delete_owner on public.eva_workspaces;
create policy eva_workspaces_select_member on public.eva_workspaces
for select to authenticated using (
  app_source = 'eva' and (owner_id = auth.uid() or public.eva_workspace_is_member(id))
);
create policy eva_workspaces_insert_owner on public.eva_workspaces
for insert to authenticated with check (app_source = 'eva' and owner_id = auth.uid());
create policy eva_workspaces_update_admin on public.eva_workspaces
for update to authenticated using (
  app_source = 'eva' and (owner_id = auth.uid() or public.eva_workspace_can_admin(id))
) with check (
  app_source = 'eva' and (owner_id = auth.uid() or public.eva_workspace_can_admin(id))
);
create policy eva_workspaces_delete_owner on public.eva_workspaces
for delete to authenticated using (app_source = 'eva' and owner_id = auth.uid());

drop policy if exists eva_workspace_members_select_visible on public.eva_workspace_members;
drop policy if exists eva_workspace_members_insert_self_or_admin on public.eva_workspace_members;
drop policy if exists eva_workspace_members_update_admin on public.eva_workspace_members;
drop policy if exists eva_workspace_members_delete_admin on public.eva_workspace_members;
create policy eva_workspace_members_select_visible on public.eva_workspace_members
for select to authenticated using (
  app_source = 'eva' and (user_id = auth.uid() or public.eva_workspace_can_admin(workspace_id))
);
create policy eva_workspace_members_insert_self_or_admin on public.eva_workspace_members
for insert to authenticated with check (
  app_source = 'eva'
  and user_id = auth.uid()
  and (
    role in ('member', 'viewer') or exists (
      select 1 from public.eva_workspaces workspace
      where workspace.id = workspace_id
        and workspace.owner_id = auth.uid()
        and workspace.app_source = 'eva'
    )
  )
);
create policy eva_workspace_members_update_admin on public.eva_workspace_members
for update to authenticated using (
  app_source = 'eva' and public.eva_workspace_can_admin(workspace_id)
) with check (
  app_source = 'eva' and public.eva_workspace_can_admin(workspace_id)
);
create policy eva_workspace_members_delete_admin on public.eva_workspace_members
for delete to authenticated using (
  app_source = 'eva' and public.eva_workspace_can_admin(workspace_id)
);

drop policy if exists eva_tasks_select_workspace_member on public.tasks;
drop policy if exists eva_tasks_insert_workspace_member on public.tasks;
drop policy if exists eva_tasks_update_workspace_member on public.tasks;
drop policy if exists eva_tasks_delete_workspace_admin on public.tasks;
create policy eva_tasks_select_workspace_member on public.tasks
for select to authenticated using (
  app_source = 'eva'
  and workspace_id is not null
  and public.eva_workspace_is_member(workspace_id)
);
create policy eva_tasks_insert_workspace_member on public.tasks
for insert to authenticated with check (
  app_source = 'eva'
  and workspace_id is not null
  and user_id = auth.uid()
  and public.eva_workspace_can_edit(workspace_id)
);
create policy eva_tasks_update_workspace_member on public.tasks
for update to authenticated using (
  app_source = 'eva'
  and workspace_id is not null
  and public.eva_workspace_can_edit(workspace_id)
) with check (
  app_source = 'eva'
  and workspace_id is not null
  and public.eva_workspace_can_edit(workspace_id)
);
create policy eva_tasks_delete_workspace_admin on public.tasks
for delete to authenticated using (
  app_source = 'eva'
  and workspace_id is not null
  and public.eva_workspace_can_admin(workspace_id)
);

drop policy if exists eva_meetings_select_workspace_member on public.meetings;
drop policy if exists eva_meetings_insert_workspace_member on public.meetings;
drop policy if exists eva_meetings_update_workspace_member on public.meetings;
drop policy if exists eva_meetings_delete_workspace_admin on public.meetings;
create policy eva_meetings_select_workspace_member on public.meetings
for select to authenticated using (
  app_source = 'eva'
  and workspace_id is not null
  and public.eva_workspace_is_member(workspace_id)
);
create policy eva_meetings_insert_workspace_member on public.meetings
for insert to authenticated with check (
  app_source = 'eva'
  and workspace_id is not null
  and user_id = auth.uid()
  and public.eva_workspace_can_edit(workspace_id)
);
create policy eva_meetings_update_workspace_member on public.meetings
for update to authenticated using (
  app_source = 'eva'
  and workspace_id is not null
  and public.eva_workspace_can_edit(workspace_id)
) with check (
  app_source = 'eva'
  and workspace_id is not null
  and public.eva_workspace_can_edit(workspace_id)
);
create policy eva_meetings_delete_workspace_admin on public.meetings
for delete to authenticated using (
  app_source = 'eva'
  and workspace_id is not null
  and public.eva_workspace_can_admin(workspace_id)
);

drop policy if exists eva_reminders_select_workspace_member on public.reminders;
drop policy if exists eva_reminders_insert_workspace_member on public.reminders;
drop policy if exists eva_reminders_update_workspace_member on public.reminders;
drop policy if exists eva_reminders_delete_workspace_admin on public.reminders;
create policy eva_reminders_select_workspace_member on public.reminders
for select to authenticated using (
  app_source = 'eva'
  and workspace_id is not null
  and public.eva_workspace_is_member(workspace_id)
);
create policy eva_reminders_insert_workspace_member on public.reminders
for insert to authenticated with check (
  app_source = 'eva'
  and workspace_id is not null
  and user_id = auth.uid()
  and public.eva_workspace_can_edit(workspace_id)
);
create policy eva_reminders_update_workspace_member on public.reminders
for update to authenticated using (
  app_source = 'eva'
  and workspace_id is not null
  and public.eva_workspace_can_edit(workspace_id)
) with check (
  app_source = 'eva'
  and workspace_id is not null
  and public.eva_workspace_can_edit(workspace_id)
);
create policy eva_reminders_delete_workspace_admin on public.reminders
for delete to authenticated using (
  app_source = 'eva'
  and workspace_id is not null
  and public.eva_workspace_can_admin(workspace_id)
);

drop function if exists public.join_eva_workspace_by_code(text);
drop function if exists public.join_eva_workspace_by_code(text, text);

create or replace function public.join_eva_workspace_by_code(
  invite_code_text text,
  display_name_text text default ''
)
returns table (
  id uuid,
  name text,
  role text,
  owner_id uuid,
  invite_code text,
  status text,
  display_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  active_user uuid := auth.uid();
  normalized_code text := upper(regexp_replace(coalesce(invite_code_text, ''), '[^a-zA-Z0-9-]', '', 'g'));
  clean_display_name text := left(trim(coalesce(display_name_text, '')), 80);
  workspace_row public.eva_workspaces%rowtype;
  member_row public.eva_workspace_members%rowtype;
  assigned_role text;
begin
  if active_user is null then
    raise exception 'auth_required';
  end if;

  select *
  into workspace_row
  from public.eva_workspaces w
  where w.app_source = 'eva'
    and w.invite_code = normalized_code
  limit 1;

  if workspace_row.id is null then
    raise exception 'workspace_invite_not_found';
  end if;

  if workspace_row.invite_expires_at is not null and workspace_row.invite_expires_at < now() then
    raise exception 'workspace_invite_expired';
  end if;

  assigned_role := case
    when active_user = workspace_row.owner_id then 'owner'
    else 'member'
  end;

  insert into public.eva_workspace_members (
    workspace_id,
    user_id,
    display_name,
    role,
    status,
    app_source
  )
  values (
    workspace_row.id,
    active_user,
    clean_display_name,
    assigned_role,
    'active',
    'eva'
  )
  on conflict (workspace_id, user_id)
  do update set
    status = 'active',
    role = case
      when public.eva_workspace_members.role = 'owner' then 'owner'
      else excluded.role
    end,
    display_name = coalesce(nullif(clean_display_name, ''), public.eva_workspace_members.display_name),
    updated_at = now()
  returning * into member_row;

  return query
  select
    workspace_row.id,
    workspace_row.name,
    member_row.role,
    workspace_row.owner_id,
    workspace_row.invite_code,
    member_row.status,
    member_row.display_name;
end;
$$;

revoke all on function public.join_eva_workspace_by_code(text, text) from public;
revoke all on function public.eva_workspace_role(uuid) from public;
revoke all on function public.eva_workspace_is_member(uuid) from public;
revoke all on function public.eva_workspace_can_edit(uuid) from public;
revoke all on function public.eva_workspace_can_admin(uuid) from public;
grant execute on function public.join_eva_workspace_by_code(text, text) to authenticated;
grant execute on function public.eva_workspace_role(uuid) to authenticated;
grant execute on function public.eva_workspace_is_member(uuid) to authenticated;
grant execute on function public.eva_workspace_can_edit(uuid) to authenticated;
grant execute on function public.eva_workspace_can_admin(uuid) to authenticated;

grant select, insert, update, delete on
  public.eva_workspaces,
  public.eva_workspace_members,
  public.tasks
to authenticated;

create index if not exists eva_workspaces_owner_idx
on public.eva_workspaces (owner_id, app_source, created_at desc);
create index if not exists eva_workspace_members_user_idx
on public.eva_workspace_members (user_id, app_source, status);
create index if not exists tasks_workspace_idx
on public.tasks (workspace_id, app_source, created_at desc);
create index if not exists meetings_workspace_idx
on public.meetings (workspace_id, app_source, created_at desc);
create index if not exists reminders_workspace_idx
on public.reminders (workspace_id, app_source, created_at desc);

do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.meetings;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.reminders;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;
