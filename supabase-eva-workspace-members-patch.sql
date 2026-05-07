do $$
begin
  if not exists (
    select from pg_tables
    where schemaname = 'public' and tablename = 'eva_workspaces'
  ) then
    raise exception 'Prerequisite missing: run supabase-eva-workspaces-migration.sql before this patch.';
  end if;
end;
$$;

alter table public.eva_workspace_members
add column if not exists display_name text not null default '';

alter table public.eva_workspaces
add column if not exists invite_expires_at timestamptz;

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
grant execute on function public.join_eva_workspace_by_code(text, text) to authenticated;
