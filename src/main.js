// ─── HYPR Geocodify — Vite Entry Point ──────────────────────────────────────
// Phase 1: importa módulos já extraídos e expõe via window.* para
// compatibilidade com o JS inline restante.
// Phase 3: trocar window.* por addEventListener + remover inline.

import './styles/app.css';

// ── State store ─────────────────────────────────────────────────────────────
import { syncToWindow } from './lib/state.js';
syncToWindow();

// ── Utils ───────────────────────────────────────────────────────────────────
import { escHtml, pct, pctRaw, formatNum, groupBy, avg, cssVar, throttle } from './lib/utils.js';

// ── Config ──────────────────────────────────────────────────────────────────
import {
  GEO_BATCH_SIZE, GEO_BATCH_DELAY_MS, GEO_SCORE_MIN, GEO_TIMEOUT_MS,
  GALLERY_PER_PAGE, GALLERY_MAX_FETCH, THUMB_COLORS,
  LIST_RENDER_LIMIT, DB_CHUNK_SIZE, DB_PAGE_SIZE,
} from './config.js';

// ── CSV Parser ──────────────────────────────────────────────────────────────
import { parseCSV, detectAndNormalize } from './lib/csv-parser.js';

// ── Bandeira ────────────────────────────────────────────────────────────────
import { normalizeBandeira, buildBandeiraGroups } from './lib/bandeira.js';

// ── Geocoder (only clearGeoCache used — geocodeHERE/reverseGeocodeHERE kept inline) ──
import { clearGeoCache } from './lib/geocoder.js';

// ── Receita (only clearReceitaCache used — buscarReceita/aplicarReceita kept inline) ──
import { clearReceitaCache } from './lib/receita.js';

// ── Map Engine (pinColor, renderMarkers, buildPopup deleted from inline) ────
import { pinColor, renderMarkers, buildPopup } from './lib/map-engine.js';

// ── Analytics (updateOverlay, updatePanels deleted from inline) ─────────────
import { updateOverlay, updatePanels } from './lib/analytics.js';

// ── Panels (all deleted from inline) ────────────────────────────────────────
import { setTab, initResizablePanels, toggleFullMap, toggleSidebar, togglePanel } from './lib/panels.js';

// ── Save/Load (loadMapPDVs not defined inline) ──────────────────────────────
import { loadMapPDVs } from './lib/save-load.js';

// ── Supabase (getSupabase not defined inline) ───────────────────────────────
import { getSupabase } from './lib/supabase.js';

// ── Auth + Theme: kept inline (UI-specific logic not in modules yet) ────────

// ── Geo Data ────────────────────────────────────────────────────────────────
import { BR_STATES, BR_CITIES, UF_REGIONS, BR_CAPITALS } from './lib/geo-data.js';

// ─── Expose to window.* for inline JS compatibility ─────────────────────────
// TODO Phase 3: remove all of these once inline JS is fully migrated

// ── Functions DELETED from inline → must be provided by modules ──────────────

// Utils (deleted from inline)
window._escForHtml = escHtml;
window.escHtml = escHtml;
window.pct = pct;
window.pctRaw = pctRaw;
window.avg = avg;
window.groupBy = groupBy;
window.throttle = throttle;

// CSV (deleted from inline)
window.parseCSV = parseCSV;
window.detectAndNormalize = detectAndNormalize;

// Bandeira (deleted from inline)
window.normalizeBandeira = normalizeBandeira;
window.buildBandeiraGroups = buildBandeiraGroups;

// Map rendering (deleted from inline)
window.pinColor = pinColor;
window.renderMarkers = renderMarkers;
window.buildPopup = buildPopup;

// Analytics (deleted from inline)
window.updateOverlay = updateOverlay;
window.updatePanels = updatePanels;
window.updateAnalytics = () => {
  const fd = window.filteredData || [];
  updateOverlay(fd);
  updatePanels(fd);
};

// Panels (deleted from inline)
window.setTab = setTab;
window.initResizablePanels = initResizablePanels;
window.toggleFullMap = toggleFullMap;
window.toggleSidebar = toggleSidebar;
window.togglePanel = togglePanel;

// Module-only (no inline equivalent)
window.clearGeoCache = clearGeoCache;
window.clearReceitaCache = clearReceitaCache;
window.loadMapPDVs = loadMapPDVs;
window.getSupabase = getSupabase;

// ── NOT exported (still defined inline — DO NOT overwrite) ──────────────────
// sbFetch, loadGallery, buildMapCard, applyGalleryFilters, downloadGeocoderCSV
// geocodeHERE, reverseGeocodeHERE, buscarReceita, aplicarReceita
// _buildDarkStyle, _setupMapSources, _setupMapInteractions, _cssVar

// Geo data
window.BR_STATES = BR_STATES;
window.BR_CITIES = BR_CITIES;
window.UF_REGIONS = UF_REGIONS;
window.BR_CAPITALS = BR_CAPITALS;

// Config constants
window.THUMB_COLORS = THUMB_COLORS;
window._GEO_SCORE_MIN = GEO_SCORE_MIN;
window.GEO_BATCH_SIZE = GEO_BATCH_SIZE;
window.GEO_BATCH_DELAY_MS = GEO_BATCH_DELAY_MS;
window.GALLERY_PER_PAGE = GALLERY_PER_PAGE;
window.GALLERY_MAX_FETCH = GALLERY_MAX_FETCH;
window.LIST_RENDER_LIMIT = LIST_RENDER_LIMIT;
window.DB_CHUNK_SIZE = DB_CHUNK_SIZE;
window.DB_PAGE_SIZE = DB_PAGE_SIZE;
