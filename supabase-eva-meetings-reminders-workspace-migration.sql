-- Adds workspace_id to meetings and reminders so they scope to a workspace
-- Run after supabase-eva-workspaces-migration.sql

alter table public.meetings
add column if not exists workspace_id uuid references public.eva_workspaces(id) on delete set null;

alter table public.reminders
add column if not exists workspace_id uuid references public.eva_workspaces(id) on delete set null;

create index if not exists meetings_workspace_idx
on public.meetings (workspace_id, app_source, created_at desc);

create index if not exists reminders_workspace_idx
on public.reminders (workspace_id, app_source, created_at desc);

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

-- Workspace RLS policies for meetings
-- Mirrors the tasks workspace pattern: personal policy covers own rows,
-- these policies let workspace members read/write shared rows.
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

-- Workspace RLS policies for reminders
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
