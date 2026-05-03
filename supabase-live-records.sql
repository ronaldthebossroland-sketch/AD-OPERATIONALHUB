create extension if not exists pgcrypto;

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  time text default '',
  duration text default '',
  location text default '',
  briefing text default '',
  risk text default '',
  attendees text[] default '{}',
  minutes text default '',
  created_at timestamptz default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  type text default 'Operations',
  title text not null,
  detail text default '',
  severity text default 'Medium',
  status text default 'Open',
  created_at timestamptz default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  progress integer default 0,
  lead text default '',
  status text default 'Pending',
  blocker text default '',
  created_at timestamptz default now()
);

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text default '',
  phone text default '',
  last_contact text default '',
  milestone text default '',
  next_step text default '',
  draft text default '',
  created_at timestamptz default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  time text default '',
  location text default '',
  created_at timestamptz default now()
);

create table if not exists public.operations (
  id uuid primary key default gen_random_uuid(),
  area text default 'Operations',
  title text not null,
  detail text default '',
  severity text default 'Medium',
  status text default 'Open',
  created_at timestamptz default now()
);

create table if not exists public.meeting_transcripts (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled transcript',
  transcript_text text default '',
  edited_text text default '',
  created_by text default '',
  is_final boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.meetings enable row level security;
alter table public.alerts enable row level security;
alter table public.projects enable row level security;
alter table public.partners enable row level security;
alter table public.activities enable row level security;
alter table public.operations enable row level security;
alter table public.meeting_transcripts enable row level security;
