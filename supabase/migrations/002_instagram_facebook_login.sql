-- Adiciona colunas para suportar Facebook Login + Instagram Business Discovery
alter table instagram_connections
  add column if not exists fb_page_id   text,
  add column if not exists fb_page_name text;
