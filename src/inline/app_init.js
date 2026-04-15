// ─── app_init ─────────────────────────────────────────────────────────
// Extracted from app-legacy.js — domain module

// ─── HYPR Geocodify — Legacy Inline JS ──────────────────────────────────────
// Extracted from index.html blocks 1-4.
// This file preserves the original code structure.
// Functions are exposed to window.* at the bottom for HTML onclick compatibility.
// Next step: split into domain modules and remove window.* exposure.
//
// NOTE: This runs as an ES module (imported by main.js).
// Top-level vars become module-scoped, not global.
// window.* assignments at the bottom make them accessible to HTML.

// ── Bootstrap — inicializa Supabase e auth ──
window._supa = null;
window.currentUser = null;
window.MAP_STYLES = null;
window._supaReady = false;
document.addEventListener('DOMContentLoaded', function() {
  // 1. Supabase client (may not be ready yet if defer scripts still loading)
  function _initSupa() {
    if (!window.supabase) { setTimeout(_initSupa, 50); return; }
    if (window._supaReady) return;
    var url  = 'https://qfyqvcxhcmduhknbpofx.supabase.co';
    var anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmeXF2Y3hoY21kdWhrbmJwb2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Mjk1NjAsImV4cCI6MjA4OTAwNTU2MH0.k92V1LN4OqqdtfF86iml4L-gVg0AabENKt7S5vlP2dk';
    window._supa = window.supabase.createClient(url, anon);
    window._supaReady = true;
    window.SUPABASE_URL  = url;
    window.SUPABASE_ANON = anon;
    if (typeof _initMapStyles === 'function') _initMapStyles();
  }
  _initSupa();
});

// ── Theme helpers ──
function _cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function toggleTheme() {
  var html = document.documentElement;
  html.classList.add('theme-switching');
  var current = html.getAttribute('data-theme') || 'dark';
  var next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('geocodify-theme', next);
  setTimeout(function(){ html.classList.remove('theme-switching'); }, 300);
  // Update toggle icon
  var icon = document.getElementById('theme-toggle-icon');
  if (icon) icon.textContent = next === 'dark' ? '☀️' : '🌙';
  // Rebuild map style if map is loaded
  if (typeof _onThemeChange === 'function') _onThemeChange(next);
  // Re-render charts with new colors
  if (typeof updateAnalytics === 'function') {
    try { updateAnalytics(); } catch(e) {}
  }
  // Re-render markers (pinColor reads CSS vars now)
  if (typeof renderMarkers === 'function' && typeof map !== 'undefined' && map) {
    try { renderMarkers(); } catch(e) {}
  }
}

function _onThemeChange(theme) {
  if (typeof map === 'undefined' || !map) return;
  var style = theme === 'light' ? _buildLightMapStyle() : _buildDarkStyle();
  var center = map.getCenter();
  var zoom = map.getZoom();
  map.setStyle(style);
  map.once('styledata', function() {
    map.jumpTo({ center: center, zoom: zoom });
    _setupMapSources();
    _setupMapInteractions();
    if (filteredData.length > 0) renderMarkers();
  });
}

function _buildLightMapStyle() {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: { 'ofm': { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#f0f4f8' } },
      { id: 'water', type: 'fill', source: 'ofm', 'source-layer': 'water', paint: { 'fill-color': '#c8ddf0' } },
      { id: 'waterway', type: 'line', source: 'ofm', 'source-layer': 'waterway', paint: { 'line-color': '#c8ddf0', 'line-width': 1 } },
      { id: 'landcover', type: 'fill', source: 'ofm', 'source-layer': 'landcover', paint: { 'fill-color': '#e8f0e0', 'fill-opacity': 0.5 } },
      { id: 'landuse', type: 'fill', source: 'ofm', 'source-layer': 'landuse', paint: { 'fill-color': '#eef2e8' } },
      { id: 'park', type: 'fill', source: 'ofm', 'source-layer': 'park', paint: { 'fill-color': '#d4e8d0', 'fill-opacity': 0.6 } },
      { id: 'boundary-country', type: 'line', source: 'ofm', 'source-layer': 'boundary', filter: ['==', 'admin_level', 2],
        paint: { 'line-color': '#9ca3af', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.2, 6, 2, 10, 2.5], 'line-opacity': 0.6 } },
      { id: 'boundary-state', type: 'line', source: 'ofm', 'source-layer': 'boundary', filter: ['==', 'admin_level', 4],
        paint: { 'line-color': '#c0c8d0', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 6, 1.4, 10, 2, 14, 2.5], 'line-opacity': 0.5 } },
      { id: 'road-motorway-casing', type: 'line', source: 'ofm', 'source-layer': 'transportation', filter: ['in', 'class', 'motorway', 'trunk'],
        paint: { 'line-color': '#c0c8d2', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 12, 4, 16, 8] }, minzoom: 5 },
      { id: 'road-motorway', type: 'line', source: 'ofm', 'source-layer': 'transportation', filter: ['in', 'class', 'motorway', 'trunk'],
        paint: { 'line-color': '#e4e8ee', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 12, 2.5, 16, 5] } },
      { id: 'road-primary', type: 'line', source: 'ofm', 'source-layer': 'transportation', filter: ['in', 'class', 'primary', 'secondary'],
        paint: { 'line-color': '#d8dce4', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 12, 1.8, 16, 3.5] } },
      { id: 'road-minor', type: 'line', source: 'ofm', 'source-layer': 'transportation', filter: ['in', 'class', 'tertiary', 'minor', 'residential', 'service'],
        paint: { 'line-color': '#e4e8ee', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.3, 14, 1.2, 16, 2.2] }, minzoom: 10 },
      { id: 'building', type: 'fill', source: 'ofm', 'source-layer': 'building',
        paint: { 'fill-color': '#dde2e8', 'fill-outline-color': '#c8d0d8' }, minzoom: 14 },
      { id: 'label-road-major', type: 'symbol', source: 'ofm', 'source-layer': 'transportation_name',
        filter: ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 14, 11, 18, 13], 'symbol-placement': 'line', 'text-max-angle': 30, 'text-rotation-alignment': 'map', 'text-padding': 2 },
        paint: { 'text-color': '#6b7280', 'text-halo-color': '#f0f4f8', 'text-halo-width': 1.5 }, minzoom: 12 },
      { id: 'label-road-minor', type: 'symbol', source: 'ofm', 'source-layer': 'transportation_name',
        filter: ['in', 'class', 'tertiary', 'minor', 'residential', 'service'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 14, 9, 18, 11], 'symbol-placement': 'line', 'text-max-angle': 30, 'text-rotation-alignment': 'map', 'text-padding': 2 },
        paint: { 'text-color': '#9ca3af', 'text-halo-color': '#f0f4f8', 'text-halo-width': 1.2 }, minzoom: 15 },
      { id: 'label-state', type: 'symbol', source: 'ofm', 'source-layer': 'place', filter: ['==', 'class', 'state'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9, 6, 12, 8, 14, 12, 16], 'text-transform': 'uppercase', 'text-letter-spacing': 0.12, 'text-max-width': 8 },
        paint: { 'text-color': '#6b7280', 'text-halo-color': '#f0f4f8', 'text-halo-width': 2, 'text-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 12, 0.5] }, minzoom: 4 },
      { id: 'label-city', type: 'symbol', source: 'ofm', 'source-layer': 'place', filter: ['in', 'class', 'city', 'town', 'village'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 10, 13], 'text-max-width': 8 },
        paint: { 'text-color': '#4b5563', 'text-halo-color': '#f0f4f8', 'text-halo-width': 1.5 } },
      { id: 'label-country', type: 'symbol', source: 'ofm', 'source-layer': 'place', filter: ['==', 'class', 'country'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 6, 14], 'text-transform': 'uppercase', 'text-letter-spacing': 0.15 },
        paint: { 'text-color': '#6b7280', 'text-halo-color': '#f0f4f8', 'text-halo-width': 2 } },
    ]
  };
}


// ─── Utilitários ────────────────────────────────────────────────────────────
function debounce(fn, ms) {
  let tid;
  return function(...args) { clearTimeout(tid); tid = setTimeout(() => fn.apply(this, args), ms); };
}

// ─── State ───────────────────────────────────────────────────────────────────

var STATE_NAME_TO_UF = {'Acre':'AC','Alagoas':'AL','Amapá':'AP','Amazonas':'AM','Bahia':'BA','Ceará':'CE','Distrito Federal':'DF','Espírito Santo':'ES','Goiás':'GO','Maranhão':'MA','Mato Grosso do Sul':'MS','Mato Grosso':'MT','Minas Gerais':'MG','Pará':'PA','Paraíba':'PB','Paraná':'PR','Pernambuco':'PE','Piauí':'PI','Rio de Janeiro':'RJ','Rio Grande do Norte':'RN','Rio Grande do Sul':'RS','Rondônia':'RO','Roraima':'RR','Santa Catarina':'SC','São Paulo':'SP','Sergipe':'SE','Tocantins':'TO'};
// HERE key: usada APENAS para satellite tiles do MapLibre (raster tile URL precisa da key no client).
// Geocoding e reverse geocoding usam o proxy server-side /api/geocode (key fica no Vercel env vars).
// TODO: criar key separada restrita a Map Tile API + referrer restriction no HERE console.
var _HERE_SAT_KEY = 'abXwwRsBKFvJdsCWLt18_is1dcqXDOaTyxRAIlrEmMg';
var allData = [];
var filteredData = [];
var map = null;
var charts = {};
var activeLayer = 'dark';
var _popup = null;        // MapLibre popup atual

// ─── Estilos de mapa (MapLibre style URLs) ───────────────────────────────────

var _bandeiraGroupMap = {}; // mapa: nome original → nome normalizado

// ─── Multi-select component ─────────────────────────────────────────────────

async function sbFetch(path, opts = {}) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 15000); // 15s timeout
  // Usar token do usuário logado se disponível, senão usar anon key
  const authToken = (await _supa.auth.getSession()).data.session?.access_token || SUPABASE_ANON;
  const headers = {
    'apikey': SUPABASE_ANON,
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...(opts.headers || {}),
  };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...opts, headers, signal: controller.signal
    });
    clearTimeout(tid);
    if (!res.ok) throw new Error(await res.text());
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch(e) {
    clearTimeout(tid);
    throw e;
  }
}

// ─── Galeria ──────────────────────────────────────────────────────────────────


// ─── window.* exports ──────────────────────────────────────────────────
window._buildLightMapStyle = _buildLightMapStyle;
window._cssVar = _cssVar;
window._initSupa = _initSupa;
window._onThemeChange = _onThemeChange;
window.debounce = debounce;
window.sbFetch = sbFetch;
window.toggleTheme = toggleTheme;

// ─── Expose to window for HTML onclick handlers ────────────────────────────
if (typeof _buildDarkStyle === "function") window._buildDarkStyle = _buildDarkStyle;
if (typeof _buildLightMapStyle === "function") window._buildLightMapStyle = _buildLightMapStyle;
if (typeof _buildSatelliteStyle === "function") window._buildSatelliteStyle = _buildSatelliteStyle;
if (typeof _cleanCommercialAddress === "function") window._cleanCommercialAddress = _cleanCommercialAddress;
if (typeof _cssVar === "function") window._cssVar = _cssVar;
if (typeof _hereItemToResult === "function") window._hereItemToResult = _hereItemToResult;
if (typeof _initMapStyles === "function") window._initMapStyles = _initMapStyles;
if (typeof _initSupa === "function") window._initSupa = _initSupa;
if (typeof _onThemeChange === "function") window._onThemeChange = _onThemeChange;
if (typeof _setupMapInteractions === "function") window._setupMapInteractions = _setupMapInteractions;
if (typeof _setupMapSources === "function") window._setupMapSources = _setupMapSources;
if (typeof addRadiusPin === "function") window.addRadiusPin = addRadiusPin;
if (typeof aplicarReceita === "function") window.aplicarReceita = aplicarReceita;
if (typeof applyFilters === "function") window.applyFilters = applyFilters;
if (typeof applyGalleryFilters === "function") window.applyGalleryFilters = applyGalleryFilters;
if (typeof applyMapMode === "function") window.applyMapMode = applyMapMode;
if (typeof autoSaveAndNotify === "function") window.autoSaveAndNotify = autoSaveAndNotify;
if (typeof autoSaveExpandedPlaces === "function") window.autoSaveExpandedPlaces = autoSaveExpandedPlaces;
if (typeof buildMapCard === "function") window.buildMapCard = buildMapCard;
if (typeof buildPageNumbers === "function") window.buildPageNumbers = buildPageNumbers;
if (typeof buildStateGrid === "function") window.buildStateGrid = buildStateGrid;
if (typeof buscarReceita === "function") window.buscarReceita = buscarReceita;
if (typeof buscarReceitaBrasilAPI === "function") window.buscarReceitaBrasilAPI = buscarReceitaBrasilAPI;
if (typeof buscarReceitaEstab === "function") window.buscarReceitaEstab = buscarReceitaEstab;
if (typeof cancelGeocoding === "function") window.cancelGeocoding = cancelGeocoding;
if (typeof clearAllPins === "function") window.clearAllPins = clearAllPins;
if (typeof closeMapTypeModal === "function") window.closeMapTypeModal = closeMapTypeModal;
if (typeof closeSaveModal === "function") window.closeSaveModal = closeSaveModal;
if (typeof closeVarejoSubModal === "function") window.closeVarejoSubModal = closeVarejoSubModal;
if (typeof debounce === "function") window.debounce = debounce;
if (typeof deleteMap === "function") window.deleteMap = deleteMap;
if (typeof destroyChart === "function") window.destroyChart = destroyChart;
if (typeof disablePinMode === "function") window.disablePinMode = disablePinMode;
if (typeof dismissGeoToast === "function") window.dismissGeoToast = dismissGeoToast;
if (typeof doGoogleLogin === "function") window.doGoogleLogin = doGoogleLogin;
if (typeof downloadGeocoderCSV === "function") window.downloadGeocoderCSV = downloadGeocoderCSV;
if (typeof downloadTemplate === "function") window.downloadTemplate = downloadTemplate;
if (typeof enablePinMode === "function") window.enablePinMode = enablePinMode;
if (typeof enrichBatch === "function") window.enrichBatch = enrichBatch;
if (typeof enrichRow === "function") window.enrichRow = enrichRow;
if (typeof extrairEndereco === "function") window.extrairEndereco = extrairEndereco;
if (typeof filterMultiSelect === "function") window.filterMultiSelect = filterMultiSelect;
if (typeof finishPlacesDiscovery === "function") window.finishPlacesDiscovery = finishPlacesDiscovery;
if (typeof generateCircleGeoJSON === "function") window.generateCircleGeoJSON = generateCircleGeoJSON;
if (typeof geocodeHERE === "function") window.geocodeHERE = geocodeHERE;
if (typeof getSearchAreas === "function") window.getSearchAreas = getSearchAreas;
if (typeof goToStep === "function") window.goToStep = goToStep;
if (typeof handleCSVFile === "function") window.handleCSVFile = handleCSVFile;
if (typeof handleLoggedIn === "function") window.handleLoggedIn = handleLoggedIn;
if (typeof identificarBandeira === "function") window.identificarBandeira = identificarBandeira;
if (typeof initAuth === "function") window.initAuth = initAuth;
if (typeof initMap === "function") window.initMap = initMap;
if (typeof initMultiSelect === "function") window.initMultiSelect = initMultiSelect;
if (typeof loadData === "function") window.loadData = loadData;
if (typeof loadGallery === "function") window.loadGallery = loadGallery;
if (typeof msClearAll === "function") window.msClearAll = msClearAll;
if (typeof msGetSelected === "function") window.msGetSelected = msGetSelected;
if (typeof msReset === "function") window.msReset = msReset;
if (typeof msSelectAll === "function") window.msSelectAll = msSelectAll;
if (typeof openMapTypeModal === "function") window.openMapTypeModal = openMapTypeModal;
if (typeof openSaveModalFromToast === "function") window.openSaveModalFromToast = openSaveModalFromToast;
if (typeof openSavedMap === "function") window.openSavedMap = openSavedMap;
if (typeof openVarejoSubModal === "function") window.openVarejoSubModal = openVarejoSubModal;
if (typeof populateFilters === "function") window.populateFilters = populateFilters;
if (typeof removeRadiusPin === "function") window.removeRadiusPin = removeRadiusPin;
if (typeof renderBarChart === "function") window.renderBarChart = renderBarChart;
if (typeof renderGalleryPage === "function") window.renderGalleryPage = renderGalleryPage;
if (typeof renderGeocoderList === "function") window.renderGeocoderList = renderGeocoderList;
if (typeof renderHistChart === "function") window.renderHistChart = renderHistChart;
if (typeof renderHorizBarChart === "function") window.renderHorizBarChart = renderHorizBarChart;
if (typeof renderRadiusPinTags === "function") window.renderRadiusPinTags = renderRadiusPinTags;
if (typeof renderRankList === "function") window.renderRankList = renderRankList;
if (typeof renderUploadTemplate === "function") window.renderUploadTemplate = renderUploadTemplate;
if (typeof renderWinLoseChart === "function") window.renderWinLoseChart = renderWinLoseChart;
if (typeof resetFilters === "function") window.resetFilters = resetFilters;
if (typeof resetPlacesForNewSearch === "function") window.resetPlacesForNewSearch = resetPlacesForNewSearch;
if (typeof retryPendingIds === "function") window.retryPendingIds = retryPendingIds;
if (typeof reverseGeocodeHERE === "function") window.reverseGeocodeHERE = reverseGeocodeHERE;
if (typeof runTask === "function") window.runTask = runTask;
if (typeof saveMapToSupabase === "function") window.saveMapToSupabase = saveMapToSupabase;
if (typeof sbFetch === "function") window.sbFetch = sbFetch;
if (typeof selectMapType === "function") window.selectMapType = selectMapType;
if (typeof selectVarejoSubType === "function") window.selectVarejoSubType = selectVarejoSubType;
if (typeof setMapView === "function") window.setMapView = setMapView;
if (typeof setPlacesMode === "function") window.setPlacesMode = setPlacesMode;
if (typeof setRegionFilter === "function") window.setRegionFilter = setRegionFilter;
if (typeof showGallery === "function") window.showGallery = showGallery;
if (typeof showGeoToast === "function") window.showGeoToast = showGeoToast;
if (typeof showPlacesSetup === "function") window.showPlacesSetup = showPlacesSetup;
if (typeof showSaveMapDialog === "function") window.showSaveMapDialog = showSaveMapDialog;
if (typeof showUploadZone === "function") window.showUploadZone = showUploadZone;
if (typeof startExpandSearch === "function") window.startExpandSearch = startExpandSearch;
if (typeof startGeocoding === "function") window.startGeocoding = startGeocoding;
if (typeof startGeocodingFromStep2 === "function") window.startGeocodingFromStep2 = startGeocodingFromStep2;
if (typeof startPlacesDiscovery === "function") window.startPlacesDiscovery = startPlacesDiscovery;
if (typeof startReverseGeocoding === "function") window.startReverseGeocoding = startReverseGeocoding;
if (typeof supaLogout === "function") window.supaLogout = supaLogout;
if (typeof syncTicketRange === "function") window.syncTicketRange = syncTicketRange;
if (typeof toggleAdvancedFilters === "function") window.toggleAdvancedFilters = toggleAdvancedFilters;
if (typeof toggleBadge === "function") window.toggleBadge = toggleBadge;
if (typeof toggleMultiSelect === "function") window.toggleMultiSelect = toggleMultiSelect;
if (typeof togglePlacesPanel === "function") window.togglePlacesPanel = togglePlacesPanel;
if (typeof toggleState === "function") window.toggleState = toggleState;
if (typeof toggleTheme === "function") window.toggleTheme = toggleTheme;
if (typeof updateAnalysis === "function") window.updateAnalysis = updateAnalysis;
if (typeof updateEnrichUI === "function") window.updateEnrichUI = updateEnrichUI;
if (typeof updateHeader === "function") window.updateHeader = updateHeader;
if (typeof updateMsDisplay === "function") window.updateMsDisplay = updateMsDisplay;
if (typeof updateOverview === "function") window.updateOverview = updateOverview;
if (typeof updatePlacesBadge === "function") window.updatePlacesBadge = updatePlacesBadge;
if (typeof updatePlacesEstimate === "function") window.updatePlacesEstimate = updatePlacesEstimate;
if (typeof updateRangeLabel === "function") window.updateRangeLabel = updateRangeLabel;
if (typeof updateRanking === "function") window.updateRanking = updateRanking;

// ─── Expose shared state to window ──────────────────────────────────────────
window.allData = allData;
window.filteredData = filteredData;
window.map = map;
window.currentMapType = currentMapType;
window.currentView = currentView;
window.currentUser = currentUser;
window._supa = _supa;
window.MAP_STYLES = MAP_STYLES;
window.charts = charts;
window.activeLayer = activeLayer;
window.rawCSVData = rawCSVData;
window.geocodingActive = geocodingActive;
window.geocodingCancelled = geocodingCancelled;
window._galleryMaps = _galleryMaps;
window._selectedStates = _selectedStates;
window._radiusPins = _radiusPins;
window._placesMode = _placesMode;
window._appendMode = _appendMode;
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON = SUPABASE_ANON;
window.THUMB_COLORS = THUMB_COLORS;
window.BR_STATES = BR_STATES;
window.BR_CITIES = BR_CITIES;
window.UF_REGIONS = UF_REGIONS;
window.BR_CAPITALS = BR_CAPITALS;
window._geoCache = _geoCache;
window._receitaCache = _receitaCache;
window._receitaInFlight = _receitaInFlight;
window._receitaPending = _receitaPending;
window._GEO_SCORE_MIN = _GEO_SCORE_MIN;
window._debouncedFilter = _debouncedFilter;
window.dropZone = dropZone;

// ─── Sync module vars with window (bidirectional for mutable state) ────────
// This ensures that when inline module code writes to allData,
// the window.allData reference also updates (and vice versa).
// Once fully modularized, this goes away.
Object.defineProperty(window, "allData", { get() { return allData; }, set(val) { allData = val; }, configurable: true });
Object.defineProperty(window, "filteredData", { get() { return filteredData; }, set(val) { filteredData = val; }, configurable: true });
Object.defineProperty(window, "map", { get() { return map; }, set(val) { map = val; }, configurable: true });
Object.defineProperty(window, "currentMapType", { get() { return currentMapType; }, set(val) { currentMapType = val; }, configurable: true });
Object.defineProperty(window, "currentView", { get() { return currentView; }, set(val) { currentView = val; }, configurable: true });
Object.defineProperty(window, "currentUser", { get() { return currentUser; }, set(val) { currentUser = val; }, configurable: true });
Object.defineProperty(window, "_supa", { get() { return _supa; }, set(val) { _supa = val; }, configurable: true });
Object.defineProperty(window, "MAP_STYLES", { get() { return MAP_STYLES; }, set(val) { MAP_STYLES = val; }, configurable: true });
Object.defineProperty(window, "charts", { get() { return charts; }, set(val) { charts = val; }, configurable: true });
Object.defineProperty(window, "geocodingActive", { get() { return geocodingActive; }, set(val) { geocodingActive = val; }, configurable: true });
Object.defineProperty(window, "geocodingCancelled", { get() { return geocodingCancelled; }, set(val) { geocodingCancelled = val; }, configurable: true });
Object.defineProperty(window, "rawCSVData", { get() { return rawCSVData; }, set(val) { rawCSVData = val; }, configurable: true });
