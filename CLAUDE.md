# ContentMiner — CLAUDE.md

## O que é este projeto
SaaS para criadores de conteúdo do Instagram. O usuário conecta sua conta Business, minera perfis de referência, analisa a estrutura dos posts (gancho, CTA, funil) e gera roteiros com IA para o próprio conteúdo.

## Stack
- **Frontend**: React + TypeScript + Vite
- **Backend**: Supabase (Auth, Postgres, Edge Functions em Deno, Storage)
- **IA**: Gemini 2.5 Flash (análise de posts), Gemini 2.0 Flash (transcrição de vídeo)
- **Transcrição**: Apify (extração de vídeo do Instagram) + Whisper API própria
- **Deploy**: Vercel (frontend) + Supabase (backend)

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
| `instagram-oauth-callback` | Troca code OAuth por token Facebook Login |
| `instagram-business-discovery` | Minera perfis via Instagram Business Discovery API |
| `ai-analyze` | Analisa post com Gemini (thumbnail + caption multimodal) |
| `transcribe-video` | Extrai vídeo via Apify + transcreve com Whisper |
| `generate-script` | Gera roteiro com Gemini baseado na análise e público-alvo |

### Deploy de todas as funções
```bash
supabase functions deploy ai-analyze instagram-oauth-callback instagram-business-discovery transcribe-video generate-script --project-ref xontsuisatdwulcfytro
```

## Arquitetura de análise
- **Posts sem transcrição**: extração por código puro (`src/lib/analysisExtractor.ts`) — instantânea, gratuita
- **Posts com transcrição real** (`transcript_source = 'whisper'`): Gemini analisa o roteiro falado

## Fluxo de transcrição de vídeo
```
Clica "Transcrever"
  → Edge Function transcribe-video
  → Apify extrai a URL do vídeo do permalink (timeout 90s)
  → Download do vídeo
  → Whisper API transcreve o áudio
  → Salva transcript + transcript_source='whisper' no banco
  → UI atualiza sem precisar de F5
```

## Autenticação Instagram
O app usa **Instagram Business Login** (não Facebook Login — o app Meta não suporta).
- URL OAuth: `www.instagram.com/oauth/authorize`
- Scopes: `instagram_business_basic, instagram_business_manage_insights, instagram_business_content_publish`

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

# Rodar SQL no banco remoto
supabase db query "SQL aqui" --linked

# Setar secret
supabase secrets set CHAVE=valor --project-ref xontsuisatdwulcfytro
```

## Notas importantes
- `PostAnalysis` usa `string` nos campos flexíveis (não enums estritos) — aceita saída do extrator de código e do Gemini
- O botão "Transcrever" só aparece para posts que não são `IMAGE`
- O embed do Instagram usa click-to-play (não carrega todos os iframes de uma vez)
- A sidebar tem toggle de colapso (botão flutuante na borda direita)
- Erros das Edge Functions sempre retornam HTTP 200 com `{ error: "...", httpStatus: N }` para evitar que o Supabase SDK esconda o corpo do erro
