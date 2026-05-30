# Instaminer — CLAUDE.md

## O que é este projeto
SaaS para criadores de conteúdo do Instagram. O usuário conecta sua conta Business, minera perfis de referência, analisa a estrutura dos posts (gancho, CTA, funil) e gera roteiros com IA para o próprio conteúdo.

## Stack
- **Frontend**: React + TypeScript + Vite
- **Backend**: Supabase (Auth, Postgres, Edge Functions em Deno, Storage)
- **IA**: Gemini 2.5 Flash (análise de posts + geração de roteiro)
- **Transcrição**: Apify (extração de vídeo do Instagram) + Whisper API própria
- **Deploy**: Vercel (frontend) + Supabase (backend)
- **Repositório**: https://github.com/WorkiDigital/instaminer

## Variáveis de ambiente

### `.env.local` (frontend)
```
VITE_SUPABASE_URL=https://xontsuisatdwulcfytro.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_META_APP_ID=813158784788361
VITE_META_REDIRECT_URI=https://127.0.0.1:5173/auth/instagram/callback  # dev
                      # https://seudominio.vercel.app/auth/instagram/callback  # prod
```

### Supabase Secrets (Edge Functions)
```
GEMINI_API_KEY         — Gemini AI
META_APP_ID            — ID do app Meta
META_APP_SECRET        — Secret do app Meta
APIFY_API_TOKEN        — Apify (extração de vídeo Instagram)
WHISPER_API_KEY        — API Whisper (n8n-whisper-api.ubufeb.easypanel.host)
```

## Supabase
- **Project ref**: `xontsuisatdwulcfytro`
- **Região**: East US (Ohio)
- **Linkar**: `supabase link --project-ref xontsuisatdwulcfytro`

## Edge Functions
| Função | Propósito |
|---|---|
| `instagram-oauth-callback` | Troca code OAuth por token Instagram Business Login |
| `instagram-business-discovery` | Minera perfis via Instagram Business Discovery API |
| `ai-analyze` | Analisa post com Gemini (thumbnail + caption multimodal) |
| `transcribe-video` | Extrai vídeo via Apify + transcreve com Whisper + analisa com Gemini |
| `generate-script` | Gera roteiro com Gemini baseado no transcript/legenda do post original |
| `fetch-post-metrics` | Busca métricas reais via Instagram Insights API (reach, saves, plays etc) |
| `publish-to-instagram` | Publica vídeo como Reels via Instagram Content Publishing API |

### Deploy de todas as funções
```bash
supabase functions deploy ai-analyze instagram-oauth-callback instagram-business-discovery transcribe-video generate-script fetch-post-metrics publish-to-instagram --project-ref xontsuisatdwulcfytro
```

## Arquitetura de análise
- **Posts sem transcrição**: extração por código puro (`src/lib/analysisExtractor.ts`) — instantânea, gratuita, regex/heurística (NÃO usa IA)
- **Posts com transcrição real** (`transcript_source = 'whisper'`): Gemini 2.5 Flash analisa o roteiro falado com análise completa

## Fluxo de transcrição de vídeo
```
Clica "Transcrever"
  → Edge Function transcribe-video
  → Apify extrai a URL do vídeo do permalink (timeout 90s)
  → Download do vídeo (valida tamanho mínimo 1000 bytes)
  → Whisper API transcreve o áudio
  → Gemini 2.5 Flash analisa o transcript (headline, hook, CTA, funnel_stage, body_structure, main_theme)
  → Salva transcript + analysis + transcript_source='whisper' no banco
  → UI atualiza sem precisar de F5
```

## Fluxo de publicação via Instagram API
```
Upload de vídeo (MP4/MOV, máx 100MB)
  → Supabase Storage bucket 'content-videos' (path: videos/{user_id}/{content_item_id}.ext)
  → Clica "Publicar via Instagram" → modal de legenda
  → Edge Function publish-to-instagram
  → Gera signed URL temporária (1h) do vídeo no Storage
  → Cria media container no Instagram (REELS)
  → Polling de status (até 8x, 5s cada = máx 40s)
  → Publica container via media_publish
  → Salva ig_media_id + status='posted' no banco
```

## Autenticação Instagram
O app usa **Instagram Business Login**.
- URL OAuth: `www.instagram.com/oauth/authorize`
- Scopes: `instagram_business_basic, instagram_business_manage_insights, instagram_business_content_publish`
- Token salvo em `instagram_connections` (colunas: ig_user_id, access_token, connected_at, fb_page_id)
- **IMPORTANTE**: Se o token não tiver o escopo `instagram_business_content_publish`, reconectar a conta em Configurações

## Storage
- **Bucket**: `content-videos` (privado)
- **RLS**: `split_part(name, '/', 2) = auth.uid()::text` — valida user_id na segunda parte do path
- **Path**: `videos/{user_id}/{content_item_id}.ext`

## Migrations
```
supabase/migrations/
  001_initial_schema.sql      — schema completo
  002_instagram_facebook_login.sql — colunas fb_page_id, fb_page_name
```

## Comandos úteis
```bash
# Dev local
npm run dev

# Build
npm run build

# Deploy função específica
supabase functions deploy <nome> --project-ref xontsuisatdwulcfytro

# Rodar SQL no banco remoto (usar PowerShell com arquivo .sql para queries com aspas)
supabase db query --linked --file query.sql

# Setar secret
supabase secrets set CHAVE=valor --project-ref xontsuisatdwulcfytro

# Push para GitHub
git push origin main
```

## Notas importantes
- `PostAnalysis` usa `string` nos campos flexíveis (não enums estritos) — aceita saída do extrator de código e do Gemini
- O botão "Transcrever" só aparece para posts que não são `IMAGE`
- O embed do Instagram carrega direto (iframe com loading="lazy") — não usa mais click-to-play
- A sidebar tem toggle de colapso (botão flutuante na borda direita)
- Erros das Edge Functions sempre retornam HTTP 200 com `{ error: "...", httpStatus: N }` para evitar que o Supabase SDK esconda o corpo do erro
- `supabase db query --linked` não aceita múltiplos statements nem aspas duplas em linha — usar arquivo `.sql` com `[System.IO.File]::WriteAllText(..., [System.Text.Encoding]::ASCII)`
- O join PostgREST `mined_posts(transcript, caption)` NÃO funciona via `select("*, mined_posts(...)")` porque a FK se chama `source_mined_post_id` (não padrão). Sempre buscar `mined_posts` em query separada pelo `source_mined_post_id`
- `instagram_connections` não tem coluna `updated_at` — usar `connected_at` para ordenação

## Storage
- **Bucket**: `thumbnails` (público) — thumbnails e fotos de perfil cacheadas pelo servidor
- **Path thumbnails**: `thumbnails/{username}/{shortcode}.jpg` e `thumbnails/{username}/avatar.jpg`
- **Como funciona**: `instagram-business-discovery` baixa as imagens do CDN do Instagram no servidor e salva no bucket `thumbnails` durante a mineração — evita bloqueio de CORS no browser

## Mineração (Mine.tsx)
- Grid de 4 colunas fixas (`repeat(4, minmax(0, 340px))`), sidebar 260px, layout `fullWidth` (sem max-width)
- Paginação local: 9 posts por vez, botão "Ver mais" mostra mais sem nova chamada Apify
- Embeds carregam direto com `loading="lazy"` — sem click-to-play
- Scraping via Apify `instagram-api-scraper` (actor ID: `apify~instagram-api-scraper`, input: `directUrls + resultsType + resultsLimit`)
- Detalhes do perfil (followers, foto) buscados com `resultsType: "details"` em paralelo com posts
- `mined_posts` tem colunas extras: `video_url`, `video_view_count`, `video_play_count`

## Atualizações (30/05/2026)
- **Publicação via Instagram API**: Edge Function `publish-to-instagram` completa (container → polling → publish)
- **Upload de vídeo**: funcional com Supabase Storage, RLS corrigida com `split_part`
- **generate-script**: corrigido para buscar transcript real via query separada (join PostgREST não funcionava)
- **Nome do app**: renomeado de ContentMiner para Instaminer
- **Pipeline**: exibe `posted_at` e permalink no card da coluna Postado
- **ContentDetail**: público padrão pré-selecionado, upload funcional, modal de legenda antes de publicar
- **Audiences**: duplicar público, contagem de uso, aviso de campos incompletos detalhado
- **Mine**: migrado para Apify, thumbnails cacheadas no Storage, embeds diretos, 4 colunas, paginação local
