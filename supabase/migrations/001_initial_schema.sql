-- ============================================================
-- WORKI CONTENTMINER — SCHEMA INICIAL (MVP)
-- ============================================================

-- ============================================================
-- USUÁRIOS E CONFIGURAÇÃO
-- ============================================================

-- Perfil do usuário (estende auth.users do Supabase)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  brand_name text,
  brand_tone text,               -- tom de voz da marca (usado na geração)
  avatar_url text,
  created_at timestamptz default now()
);

-- Auto-criar perfil quando usuário faz signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Conexão da conta Instagram do usuário (OAuth Meta)
create table instagram_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  ig_user_id text not null,
  ig_username text,
  account_type text,                   -- BUSINESS | CREATOR
  access_token text not null,          -- token de longa duração
  token_expires_at timestamptz,
  connected_at timestamptz default now(),
  unique (user_id, ig_user_id)
);

-- Configuração "Meu Público-Alvo"
create table target_audiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  pain_points text,
  desires text,
  awareness_level text,               -- inconsciente | consciente_problema | consciente_solucao | consciente_produto
  objections text,
  language_tone text,
  is_default boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- MINERAÇÃO (perfis e posts de referência)
-- ============================================================

create table mined_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  ig_username text not null,
  display_name text,
  followers_count int,
  media_count int,
  profile_picture_url text,
  avg_likes numeric,
  avg_comments numeric,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  unique (user_id, ig_username)
);

create table mined_posts (
  id uuid primary key default gen_random_uuid(),
  mined_profile_id uuid references mined_profiles(id) on delete cascade not null,
  ig_media_id text,
  permalink text not null,
  media_type text,                     -- IMAGE | VIDEO | CAROUSEL_ALBUM | REEL
  caption text,
  like_count int,
  comments_count int,
  posted_at timestamptz,
  thumbnail_url text,
  -- transcrição
  transcript text,
  transcript_source text,             -- caption | public | manual_upload | whisper | none
  -- análise estruturada (IA)
  analysis jsonb,
  performance_ratio numeric,
  is_analyzed boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- PIPELINE DE PRODUÇÃO (Kanban)
-- ============================================================

create table content_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,

  -- estágio do Kanban
  status text not null default 'idea_bank',
  -- idea_bank | modeled | in_production | posted

  -- posição no kanban (para ordenação)
  position int default 0,

  -- ORIGEM
  source_mined_post_id uuid references mined_posts(id) on delete set null,
  source_analysis jsonb,

  -- MODELAGEM
  target_audience_id uuid references target_audiences(id) on delete set null,
  title text,
  generated_script text,
  funnel_stage text,                   -- top | middle | bottom
  hook text,
  headline text,
  cta text,

  -- PRODUÇÃO
  video_storage_path text,

  -- POSTAGEM
  ig_media_id text,
  posted_permalink text,
  posted_at timestamptz,
  publish_method text,                 -- api | manual

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on content_items
  for each row execute function update_updated_at();

-- PERFORMANCE
create table content_metrics (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid references content_items(id) on delete cascade not null,
  snapshot_at timestamptz default now(),
  reach int,
  impressions int,
  likes int,
  comments int,
  saves int,
  shares int,
  video_views int,
  avg_watch_time numeric,
  raw jsonb
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index idx_content_items_user_status on content_items(user_id, status);
create index idx_content_items_user_position on content_items(user_id, status, position);
create index idx_mined_posts_profile on mined_posts(mined_profile_id);
create index idx_metrics_content on content_metrics(content_item_id);
create index idx_instagram_connections_user on instagram_connections(user_id);
create index idx_target_audiences_user on target_audiences(user_id);
create index idx_mined_profiles_user on mined_profiles(user_id);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
alter table profiles enable row level security;
alter table instagram_connections enable row level security;
alter table target_audiences enable row level security;
alter table mined_profiles enable row level security;
alter table mined_posts enable row level security;
alter table content_items enable row level security;
alter table content_metrics enable row level security;

-- Políticas: cada usuário só acessa seus próprios dados
create policy "own_profiles" on profiles
  for all using (auth.uid() = id);

create policy "own_connections" on instagram_connections
  for all using (auth.uid() = user_id);

create policy "own_audiences" on target_audiences
  for all using (auth.uid() = user_id);

create policy "own_mined_profiles" on mined_profiles
  for all using (auth.uid() = user_id);

create policy "own_content_items" on content_items
  for all using (auth.uid() = user_id);

-- Tabelas filhas: validar via join
create policy "own_mined_posts" on mined_posts
  for all using (
    exists (
      select 1 from mined_profiles p
      where p.id = mined_posts.mined_profile_id
        and p.user_id = auth.uid()
    )
  );

create policy "own_metrics" on content_metrics
  for all using (
    exists (
      select 1 from content_items c
      where c.id = content_metrics.content_item_id
        and c.user_id = auth.uid()
    )
  );
