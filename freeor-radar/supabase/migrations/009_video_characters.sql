-- ============================================================
-- FreeOR Radar — Migration 009
-- Character Clip 角色库云端同步 + 反馈表 + Storage bucket
-- 匿名 client_id 归属（同 model_watches）
-- ============================================================

create table if not exists video_characters (
  id              uuid primary key default gen_random_uuid(),
  client_id       text not null,
  name            text not null,
  description     text default '',
  -- [{ "id", "label", "path", "url" }]
  images          jsonb not null default '[]'::jsonb,
  content_type    text not null default 'illustration'
    check (content_type in ('illustration', 'original_character')),
  is_overview_host boolean not null default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_video_characters_client
  on video_characters(client_id, updated_at desc);

create unique index if not exists idx_video_characters_one_host
  on video_characters(client_id)
  where is_overview_host = true;

comment on table video_characters is 'Character Clip / Overview host personas (anonymous client_id)';

-- 一致性反馈（P5-M4）
create table if not exists character_clip_feedback (
  id            serial primary key,
  client_id     text not null,
  character_id  uuid references video_characters(id) on delete set null,
  job_id        text,
  mode          text not null default 'single'
    check (mode in ('single', 'multi', 'overview_host')),
  rating        smallint not null check (rating in (-1, 1)),
  comment       text,
  created_at    timestamptz default now()
);

create index if not exists idx_character_feedback_character
  on character_clip_feedback(character_id, created_at desc);

alter table video_characters enable row level security;
alter table character_clip_feedback enable row level security;

-- Storage bucket for reference images (public read for OpenRouter HTTPS fetch)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'video-characters',
  'video-characters',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 验证
select column_name, data_type
from information_schema.columns
where table_name = 'video_characters'
order by ordinal_position;
