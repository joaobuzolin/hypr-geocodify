# HYPR Geocodify

Plataforma de geocodificação e inteligência geoespacial.

## Stack

- HTML/CSS/JS (vanilla)
- Supabase (auth + database)
- MapLibre GL JS (mapas)
- Chart.js (gráficos)
- HERE Geocoding API
- Google Places API (New)
- Vercel (hosting + serverless functions)

## Estrutura

```
├── index.html              # App principal (mapa, geocoding, gallery)
├── comparativo.html        # Attack Plan (comparação de períodos)
├── vercel.json             # Config Vercel + rewrites
├── api/                    # Vercel Serverless Functions
│   ├── geocode.js          # Proxy HERE Geocoding
│   └── places-search.js   # Proxy Google Places
├── netlify/                # Legacy (mantido como referência)
│   └── functions/
│       ├── geocode.js
│       └── places-search.js
├── favicon.ico
├── apple-touch-icon.png
├── icon-192.png
├── geocodify_cover.png
└── login-bg.webp
```

## Setup local

Não precisa de build — é HTML estático + serverless functions.

Para testar as functions localmente, instale o Vercel CLI:

```bash
npm i -g vercel
vercel dev
```

Isso serve os arquivos estáticos + roda as functions em `/api/*`.

## Environment Variables

Configure no Vercel Dashboard (Settings → Environment Variables):

| Variável | Onde usar | Descrição |
|---|---|---|
| `HERE_API_KEY` | Server (api/) | Chave da HERE Geocoding API |
| `GOOGLE_PLACES_API_KEY` | Server (api/) | Chave do Google Places (New) |

**Nota:** A Supabase anon key e URL estão no client-side (esperado pelo Supabase).
Quando migrar pra v3-vite, elas vão pra env vars com prefixo `VITE_`.

## Deploy

O deploy é automático via push pro GitHub. O Vercel detecta mudanças e deploya.

## Branches

| Branch | Propósito |
|---|---|
| `main` | Produção (legacy, HTML estático) |
| `v3-vite` | Refactor com Vite (em desenvolvimento) |

Preview deployments: cada push na `v3-vite` gera uma URL temporária no Vercel
pra testar sem afetar produção.
