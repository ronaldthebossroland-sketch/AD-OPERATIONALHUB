create extension if not exists pgcrypto;

create or replace function public.eva_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
for each row execute function public.eva_set_updated_at();

drop trigger if exists set_eva_workspace_members_updated_at on public.eva_workspace_members;
create trigger set_eva_workspace_members_updated_at
before update on public.eva_workspace_members
for each row execute function public.eva_set_updated_at();

alter table public.eva_workspaces enable row level security;
alter table public.eva_workspace_members enable row level security;
alter table public.tasks enable row level security;

drop policy if exists eva_workspaces_select_member on public.eva_workspaces;
drop policy if exists eva_workspaces_insert_owner on public.eva_workspaces;
drop policy if exists eva_workspaces_update_admin on public.eva_workspaces;
drop policy if exists eva_workspaces_delete_owner on public.eva_workspaces;

create policy eva_workspaces_select_member on public.eva_workspaces
for select to authenticated using (
  app_source = 'eva' and (
    owner_id = auth.uid() or public.eva_workspace_is_member(id)
  )
);

create policy eva_workspaces_insert_owner on public.eva_workspaces
for insert to authenticated with check (
  app_source = 'eva' and owner_id = auth.uid()
);

create policy eva_workspaces_update_admin on public.eva_workspaces
for update to authenticated using (
  app_source = 'eva' and (
    owner_id = auth.uid() or public.eva_workspace_can_admin(id)
  )
) with check (
  app_source = 'eva' and (
    owner_id = auth.uid() or public.eva_workspace_can_admin(id)
  )
);

create policy eva_workspaces_delete_owner on public.eva_workspaces
for delete to authenticated using (
  app_source = 'eva' and owner_id = auth.uid()
);

drop policy if exists eva_workspace_members_select_visible on public.eva_workspace_members;
drop policy if exists eva_workspace_members_insert_self_or_admin on public.eva_workspace_members;
drop policy if exists eva_workspace_members_update_admin on public.eva_workspace_members;
drop policy if exists eva_workspace_members_delete_admin on public.eva_workspace_members;

create policy eva_workspace_members_select_visible on public.eva_workspace_members
for select to authenticated using (
  app_source = 'eva' and (
    user_id = auth.uid() or public.eva_workspace_can_admin(workspace_id)
  )
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
  from public.eva_workspaces
  where app_source = 'eva'
    and invite_code = normalized_code
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

do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;
