-- EVA Auth migration.
-- Safe to run on an existing EVA Supabase project. Existing rows are not deleted.
-- Rows without user_id remain in place but are hidden from authenticated app users by RLS.

alter table public.profiles add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.tasks add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.meetings add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.reminders add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.documents add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.notes add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.assistant_chats add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.assistant_messages add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.user_preferences add column if not exists user_id uuid references auth.users(id) on delete cascade;

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

grant usage on schema public to authenticated;
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

create index if not exists profiles_user_id_app_source_created_at_idx
on public.profiles (user_id, app_source, created_at desc);
create index if not exists tasks_user_id_app_source_created_at_idx
on public.tasks (user_id, app_source, created_at desc);
create index if not exists meetings_user_id_app_source_created_at_idx
on public.meetings (user_id, app_source, created_at desc);
create index if not exists reminders_user_id_app_source_created_at_idx
on public.reminders (user_id, app_source, created_at desc);
create index if not exists documents_user_id_app_source_created_at_idx
on public.documents (user_id, app_source, created_at desc);
create index if not exists notes_user_id_app_source_created_at_idx
on public.notes (user_id, app_source, created_at desc);
create index if not exists assistant_chats_user_id_app_source_updated_at_idx
on public.assistant_chats (user_id, app_source, updated_at desc);
create index if not exists assistant_messages_user_id_chat_created_at_idx
on public.assistant_messages (user_id, chat_id, created_at asc);
create index if not exists user_preferences_user_id_app_source_created_at_idx
on public.user_preferences (user_id, app_source, created_at desc);
