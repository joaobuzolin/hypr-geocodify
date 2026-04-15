// ─── HYPR Geocodify — Vite Entry Point ──────────────────────────────────────
// All JS lives in domain modules under src/inline/.
// Zero inline JS in index.html (except theme flash prevention).
//
// Import order matters: app_init must come first (shared state + bootstrap),
// then domains in dependency order.

import './styles/app.css';

// ── Shared state, bootstrap, theme, supabase helpers ────────────────────────
import './inline/app_init.js';
import './inline/auth_ui.js';

// ── Map + rendering ─────────────────────────────────────────────────────────
import './inline/map.js';
import './inline/analytics.js';
import './inline/filters.js';

// ── Data operations ─────────────────────────────────────────────────────────
import './inline/receita.js';
import './inline/geocoding.js';
import './inline/upload.js';

// ── UI features ─────────────────────────────────────────────────────────────
import './inline/modals.js';
import './inline/gallery.js';
import './inline/save.js';
import './inline/places.js';
