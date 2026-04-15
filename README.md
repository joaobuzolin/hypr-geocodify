# HYPR Geocodify

Plataforma de geocodificação e inteligência geoespacial.

## Stack

- Vanilla JS (modular, bundled by Vite)
- Supabase (auth + database)
- MapLibre GL JS (mapas)
- Chart.js (gráficos)
- HERE Geocoding API
- Google Places API (New)
- Vercel (hosting + serverless functions)

## Estrutura

```
├── index.html              # HTML puro (zero inline JS)
├── comparativo.html        # Attack Plan (comparação de períodos)
├── vercel.json             # Config Vercel + headers + functions
├── vite.config.js          # Vite build config
│
├── api/                    # Vercel Serverless Functions
│   ├── geocode.js          # Proxy HERE Geocoding (key server-side)
│   └── places-search.js    # Proxy Google Places (key server-side)
│
├── src/
│   ├── main.js             # Vite entry point (imports all modules)
│   ├── styles/app.css      # All styles
│   └── inline/             # Domain modules
│       ├── app_init.js     # Shared state, bootstrap, theme, supabase
│       ├── map.js          # MapLibre styles, init, interactions
│       ├── filters.js      # Multi-select, populate, apply, badges
│       ├── analytics.js    # Overview, ranking, analysis tabs, charts
│       ├── geocoding.js    # HERE geocoding, reverse, enrich
│       ├── receita.js      # CNPJ lookup (Receita Federal)
│       ├── upload.js       # File upload, CSV handling
│       ├── auth_ui.js      # Login/logout UI
│       ├── modals.js       # Map type modal, varejo sub-modal
│       ├── gallery.js      # Saved maps gallery, cards, pagination
│       ├── save.js         # Save modal, auto-save
│       └── places.js       # Places Discovery, pin mode, search
│
└── public/                 # Static assets (favicon, icons, images)
```

## Setup local

```bash
npm install
npm run dev
```

## Environment Variables

Configure no Vercel Dashboard:

| Variável | Descrição |
|---|---|
| `HERE_API_KEY` | Chave da HERE Geocoding API |
| `GOOGLE_PLACES_API_KEY` | Chave do Google Places (New) |

## Deploy

Automático via push pro GitHub → Vercel.

## Acesso

Qualquer email `@hypr.mobi` via Google OAuth.
