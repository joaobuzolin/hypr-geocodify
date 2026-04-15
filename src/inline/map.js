// ─── map ─────────────────────────────────────────────────────────
// Extracted from app-legacy.js — domain module

// OpenFreeMap — vector tiles WebGL gratuito + HERE raster para satellite
var MAP_STYLES = null; // inicializado após _buildDarkStyle e _buildSatelliteStyle

function _buildDarkStyle() {
  // Style dark customizado usando tiles OpenFreeMap + paleta escura
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      'ofm': {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
      }
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#0d1117' } },
      { id: 'water', type: 'fill', source: 'ofm', 'source-layer': 'water',
        paint: { 'fill-color': '#141b24' } },
      { id: 'waterway', type: 'line', source: 'ofm', 'source-layer': 'waterway',
        paint: { 'line-color': '#141b24', 'line-width': 1 } },
      { id: 'landcover', type: 'fill', source: 'ofm', 'source-layer': 'landcover',
        paint: { 'fill-color': '#111618', 'fill-opacity': 0.5 } },
      { id: 'landuse', type: 'fill', source: 'ofm', 'source-layer': 'landuse',
        paint: { 'fill-color': '#131a1f' } },
      { id: 'park', type: 'fill', source: 'ofm', 'source-layer': 'park',
        paint: { 'fill-color': '#0f1a14', 'fill-opacity': 0.8 } },
      { id: 'boundary-country', type: 'line', source: 'ofm', 'source-layer': 'boundary',
        filter: ['==', 'admin_level', 2],
        paint: { 'line-color': '#3a5060', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.2, 6, 2, 10, 2.5], 'line-opacity': 0.8 } },
      { id: 'boundary-state', type: 'line', source: 'ofm', 'source-layer': 'boundary',
        filter: ['==', 'admin_level', 4],
        paint: { 'line-color': '#2d4050', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 6, 1.4, 10, 2, 14, 2.5], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.7, 10, 0.6, 14, 0.45] } },
      { id: 'road-motorway-casing', type: 'line', source: 'ofm', 'source-layer': 'transportation',
        filter: ['in', 'class', 'motorway', 'trunk'],
        paint: { 'line-color': '#253545', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 12, 4, 16, 8] }, minzoom: 5 },
      { id: 'road-motorway', type: 'line', source: 'ofm', 'source-layer': 'transportation',
        filter: ['in', 'class', 'motorway', 'trunk'],
        paint: { 'line-color': '#1a2a38', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 12, 2.5, 16, 5] } },
      { id: 'road-primary', type: 'line', source: 'ofm', 'source-layer': 'transportation',
        filter: ['in', 'class', 'primary', 'secondary'],
        paint: { 'line-color': '#172430', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 12, 1.8, 16, 3.5] } },
      { id: 'road-minor', type: 'line', source: 'ofm', 'source-layer': 'transportation',
        filter: ['in', 'class', 'tertiary', 'minor', 'residential', 'service'],
        paint: { 'line-color': '#141e28', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.3, 14, 1.2, 16, 2.2] },
        minzoom: 10 },
      { id: 'building', type: 'fill', source: 'ofm', 'source-layer': 'building',
        paint: { 'fill-color': '#141c24', 'fill-outline-color': '#1a2530' },
        minzoom: 14 },
      { id: 'label-road-major', type: 'symbol', source: 'ofm', 'source-layer': 'transportation_name',
        filter: ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 14, 11, 18, 13], 'symbol-placement': 'line', 'text-max-angle': 30, 'text-rotation-alignment': 'map', 'text-padding': 2 },
        paint: { 'text-color': '#506878', 'text-halo-color': '#0d1117', 'text-halo-width': 1.5 }, minzoom: 12 },
      { id: 'label-road-minor', type: 'symbol', source: 'ofm', 'source-layer': 'transportation_name',
        filter: ['in', 'class', 'tertiary', 'minor', 'residential', 'service'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 14, 9, 18, 11], 'symbol-placement': 'line', 'text-max-angle': 30, 'text-rotation-alignment': 'map', 'text-padding': 2 },
        paint: { 'text-color': '#3a5060', 'text-halo-color': '#0d1117', 'text-halo-width': 1.2 }, minzoom: 15 },
      { id: 'label-state', type: 'symbol', source: 'ofm', 'source-layer': 'place',
        filter: ['==', 'class', 'state'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9, 6, 12, 8, 14, 12, 16], 'text-transform': 'uppercase', 'text-letter-spacing': 0.12, 'text-max-width': 8 },
        paint: { 'text-color': ['interpolate', ['linear'], ['zoom'], 4, '#4a6575', 10, '#3d5565'], 'text-halo-color': '#0d1117', 'text-halo-width': 2, 'text-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.9, 12, 0.6] },
        minzoom: 4 },
      { id: 'label-city', type: 'symbol', source: 'ofm', 'source-layer': 'place',
        filter: ['in', 'class', 'city', 'town', 'village'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 10, 13], 'text-max-width': 8 },
        paint: { 'text-color': '#7a8f9e', 'text-halo-color': '#0d1117', 'text-halo-width': 1.5 } },
      { id: 'label-country', type: 'symbol', source: 'ofm', 'source-layer': 'place',
        filter: ['==', 'class', 'country'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 6, 14], 'text-transform': 'uppercase', 'text-letter-spacing': 0.15 },
        paint: { 'text-color': '#4a5f6e', 'text-halo-color': '#0d1117', 'text-halo-width': 2 } },
    ]
  };
}

function _buildSatelliteStyle() {
  const H = _HERE_SAT_KEY;
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      'here-sat': {
        type: 'raster',
        tiles: [`https://maps.hereapi.com/v3/base/mc/{z}/{x}/{y}/png?style=satellite.day&apiKey=${H}`],
        tileSize: 256,
        maxzoom: 20,
        attribution: '© HERE Maps'
      }
    },
    layers: [
      { id: 'satellite', type: 'raster', source: 'here-sat', paint: { 'raster-opacity': 1 } }
    ]
  };
}

// MAP_STYLES — inicializado aqui pois _buildDarkStyle e _buildSatelliteStyle já existem
function _initMapStyles() {
  if (MAP_STYLES) return;
  MAP_STYLES = {
    dark:      _buildDarkStyle(),
    street:    'https://tiles.openfreemap.org/styles/positron',
    explore:   'https://tiles.openfreemap.org/styles/liberty',
    satellite: _buildSatelliteStyle(),
  };
}


// ─── Map Init ────────────────────────────────────────────────────────────────

function initMap() {
  _initMapStyles();
  map = new maplibregl.Map({
    container: 'map',
    style: (document.documentElement.getAttribute('data-theme') === 'light') ? _buildLightMapStyle() : MAP_STYLES.dark,
    center: [-47.9292, -15.7801],
    zoom: 4.5,
    attributionControl: false,
    pitchWithRotate: false,
  });

  // Zoom controls customizados
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

  map.on('load', () => {
    _setupMapSources();
    _setupMapInteractions();
    // Se já há dados carregados (mapa aberto da galeria), plotar imediatamente
    if (filteredData.length > 0) renderMarkers();
  });
}

function _setupMapSources() {
  // Limpar layers e source anteriores se existirem (ex: após trocar de layer)
  ['clusters','cluster-count','pdv-points'].forEach(id => {
    try { if (map.getLayer(id)) map.removeLayer(id); } catch(e) {}
  });
  try { if (map.getSource('pdvs')) map.removeSource('pdvs'); } catch(e) {}

  map.addSource('pdvs', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterMaxZoom: 12,      // acima de zoom 12, mostra pontos individuais
    clusterRadius: 40,        // raio em pixels para agrupar
    clusterProperties: {      // agregar cor dominante para colorir o cluster
      'has_green':  ['+', ['case', ['==', ['get','color'], _cssVar('--win')], 1, 0]],
      'has_red':    ['+', ['case', ['==', ['get','color'], _cssVar('--lose')], 1, 0]],
    }
  });

  // Layer de clusters — tamanho proporcional à contagem, cor neutra azul
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'pdvs',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': _cssVar('--cluster-color'),
      'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'],
        1, 14, 10, 20, 50, 26, 200, 32, 1000, 38
      ],
      'circle-opacity': 0.85,
      'circle-stroke-width': 2,
      'circle-stroke-color': _cssVar('--circle-stroke'),
    },
  });

  // Layer de contagem dos clusters
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'pdvs',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['case',
        ['>=', ['get', 'point_count'], 1000],
        ['concat', ['to-string', ['floor', ['/', ['get', 'point_count'], 1000]]], 'k'],
        ['to-string', ['get', 'point_count']]
      ],
      'text-font': ['Noto Sans Bold'],
      'text-size': 11,
    },
    paint: { 'text-color': _cssVar('--text-canvas') },
  });

  // Layer de pontos individuais (não clusterizados)
  map.addLayer({
    id: 'pdv-points',
    type: 'circle',
    source: 'pdvs',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 14, 7, 18, 10],
      'circle-stroke-width': 1.5,
      'circle-stroke-color': _cssVar('--circle-stroke-hover'),
      'circle-opacity': 0.95,
    },
  });
}

function _setupMapInteractions() {
  // Expandir cluster ao clicar
  map.on('click', 'clusters', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
    if (!features.length) return;
    const clusterId = features[0].properties.cluster_id;
    const coords = features[0].geometry.coordinates;
    map.getSource('pdvs').getClusterExpansionZoom(clusterId).then(zoom => {
      map.easeTo({ center: coords, zoom: Math.min(zoom + 0.5, 14), duration: 400 });
    }).catch(() => {
      map.easeTo({ center: coords, zoom: map.getZoom() + 2, duration: 400 });
    });
  });

  // Popup ao clicar no ponto
  map.on('click', 'pdv-points', (e) => {
    const props = e.features[0].properties;
    const row = allData.find(r => r._mapId === props._mapId);
    if (!row) return;
    if (_popup) _popup.remove();
    const coords = e.features[0].geometry.coordinates.slice();
    _popup = new maplibregl.Popup({ maxWidth: '340px', closeButton: true, anchor: 'bottom' })
      .setLngLat(coords)
      .setHTML(buildPopup(row))
      .addTo(map);
    // Pan map only if popup is clipped — measure actual popup position vs viewport
    requestAnimationFrame(() => {
      const popupEl = _popup.getElement();
      if (!popupEl) return;
      const rect = popupEl.getBoundingClientRect();
      const mapRect = map.getContainer().getBoundingClientRect();
      // How many pixels the popup top is above the map viewport (negative = clipped)
      const overflow = mapRect.top - rect.top + 16; // 16px breathing room
      if (overflow > 0) {
        // Pan down by exactly the overflow amount (pixel offset)
        map.panBy([0, -overflow], { duration: 300 });
      }
    });
  });

  // Cursor pointer
  map.on('mouseenter', 'clusters', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'clusters', () => map.getCanvas().style.cursor = '');
  map.on('mouseenter', 'pdv-points', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'pdv-points', () => map.getCanvas().style.cursor = '');
}

// ─── Filters ─────────────────────────────────────────────────────────────────

var currentMapType = 'varejo360'; // 'geocoder' | 'reverse_geocoder' | 'varejo360' | 'places_discovery'

// Aplica modo visual correto — sempre chamar ao mudar de mapa
function applyMapMode(type) {
  currentMapType = type || 'varejo360';
  const app = document.getElementById('app');
  if (!app) return;
  const isGeo = currentMapType !== 'varejo360' && currentMapType !== 'places_discovery';
  const isPlaces = currentMapType === 'places_discovery';
  // Forçar remoção antes de adicionar — garante estado limpo
  app.classList.remove('mode-geo', 'mode-places');
  if (isGeo) app.classList.add('mode-geo');
  if (isPlaces) app.classList.add('mode-places');
  // Explicitly hide/show places-panel based on mode
  var placesPanel = document.getElementById('places-panel');
  if (placesPanel) {
    if (!isPlaces) {
      placesPanel.style.display = 'none';
    }
  }
  // Clear GeoJSON source when switching modes to prevent stale data on map
  if (map && map.getSource('pdvs') && !isPlaces) {
    // Don't clear if loading saved map data (allData may be populated by openSavedMap)
  }
  // Subtítulo do header
  const labels = { geocoder:'📍 Lat/Lon Generator', reverse_geocoder:'🔄 Address Generator', varejo360:'📊 Varejo 360 Analysis', places_discovery:'🔎 Places Discovery' };
  const sub = document.getElementById('logo-map-type');
  if (sub) sub.textContent = labels[currentMapType] || 'by HYPR°';
  // View toggle buttons
  const vt = document.getElementById('view-toggle-btns');
  if (vt) vt.style.display = (isGeo || isPlaces) ? 'flex' : 'none';
}

// ─── Modal de seleção de tipo ─────────────────────────────────────────────────

var currentView = 'map';
function setMapView(view) {
  currentView = view;
  const listEl = document.getElementById('geocoder-list-view');
  const btnMap  = document.getElementById('btn-view-map');
  const btnList = document.getElementById('btn-view-list');

  if (btnMap) btnMap.classList.toggle('active', view === 'map');
  if (btnList) btnList.classList.toggle('active', view === 'list');

  if (view === 'list') {
    if (listEl) {
      listEl.style.display = 'block';
      // Garantir que a lista está ACIMA do mapa (z-index)
      listEl.style.zIndex = '50';
      listEl.style.position = 'absolute';
      listEl.style.inset = '0';
      listEl.style.background = 'var(--bg)';
      listEl.style.overflowY = 'auto';
      listEl.style.padding = '16px';
    }
    renderGeocoderList();
  } else {
    if (listEl) listEl.style.display = 'none';
    setTimeout(() => map && map.resize(), 100);
  }
}

function renderGeocoderList() {
  const thead = document.getElementById('geocoder-thead');
  const tbody = document.getElementById('geocoder-tbody');
  const countEl = document.getElementById('list-count');
  if (!thead || !tbody) return;

  const data = filteredData.length ? filteredData : allData;
  const failCount = data.filter(r => r._geocodeFailed).length;
  const mismatchCount = data.filter(r => r._ufMismatch).length;
  let summaryParts = [`${data.length.toLocaleString('pt-BR')} pontos`];
  if (failCount > 0)    summaryParts.push(`<span style="color:var(--lose);">${failCount.toLocaleString('pt-BR')} não identificados</span>`);
  if (mismatchCount > 0) summaryParts.push(`<span style="color:var(--neutral);">${mismatchCount.toLocaleString('pt-BR')} UF divergente</span>`);
  countEl.innerHTML = summaryParts.join(' · ');

  // Colunas conforme tipo — mostrar apenas dados relevantes
  let cols = [];
  const isGeoMode = currentMapType === 'geocoder' || currentMapType === 'reverse_geocoder';
  if (currentMapType === 'geocoder') {
    cols = ['_input', 'lat', 'lon', 'geo_address', '_status'];
  } else if (currentMapType === 'reverse_geocoder') {
    cols = ['nome', 'input_lat', 'input_lon', 'geo_address', '_status'];
  } else if (currentMapType === 'places_discovery') {
    cols = ['nome', 'geo_address', 'lat', 'lon', 'place_types', 'place_status'];
  } else {
    // Varejo 360: full columns including bandeira and CNPJ
    cols = ['bandeira', 'lat', 'lon', 'geo_address', 'cnpj'];
  }

  const labels = { nome: 'Nome', bandeira: 'Bandeira/Rede', lat: 'Latitude', lon: 'Longitude',
    geo_address: 'Endereço Geocodificado', cnpj: 'CNPJ', input_lat: 'Lat input', input_lon: 'Lon input',
    place_types: 'Tipos', place_status: 'Status', place_id: 'Place ID', _status: 'Status',
    _input: 'Endereço Original' };

  thead.innerHTML = cols.map(c => `<th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);border-bottom:1px solid var(--border);">${labels[c]||c}</th>`).join('');

  // Sort: falhas primeiro, depois mismatches, depois OK
  const sorted = [...data].sort((a, b) => {
    const aW = a._geocodeFailed ? 2 : (a._ufMismatch ? 1 : 0);
    const bW = b._geocodeFailed ? 2 : (b._ufMismatch ? 1 : 0);
    return bW - aW;
  });

  tbody.innerHTML = sorted.slice(0, 500).map((r, i) => {
    const isFail = r._geocodeFailed;
    const isMismatch = !isFail && r._ufMismatch;
    const rowStyle = isFail ? 'border-bottom:1px solid var(--border);background:rgba(239,68,68,0.06);'
      : isMismatch ? 'border-bottom:1px solid var(--border);background:rgba(245,158,11,0.06);'
      : 'border-bottom:1px solid var(--border);';
    return `<tr style="${rowStyle}">
      ${cols.map(c => {
        if (c === '_status') {
          if (isFail) return '<td style="padding:7px 10px;font-size:11px;"><span style="color:var(--lose);font-weight:500;">✗ Não identificado</span></td>';
          if (isMismatch) return `<td style="padding:7px 10px;font-size:11px;"><span style="color:var(--neutral);font-weight:500;" title="Esperava ${r._expectedUF}, HERE retornou ${r.uf}">⚠ UF: ${r._expectedUF}→${r.uf}</span></td>`;
          return '<td style="padding:7px 10px;font-size:11px;"><span style="color:var(--win);">✓ OK</span></td>';
        }
        if (c === '_input') {
          // Endereço original: usar endereco_geocode, _endereco_livre, ou campo endereco do CSV
          var inputAddr = r.endereco_geocode || r._endereco_livre || r.endereco || r['endereço'] || r.address || '';
          var inputName = r.nome || r.marca || '';
          var display = inputName ? inputName + (inputAddr ? ' — ' + inputAddr : '') : inputAddr;
          return `<td style="padding:7px 10px;color:${isFail ? 'var(--lose)' : 'var(--text-dim)'};font-size:12px;" title="${display ? _escForHtml(display) : ''}">${display ? _escForHtml(String(display).slice(0,80)) : '—'}</td>`;
        }
        return `<td style="padding:7px 10px;color:${isFail ? 'var(--lose)' : 'var(--text-dim)'};font-size:12px;">${r[c] != null && r[c] !== '' ? _escForHtml(String(r[c]).slice(0,60)) : '—'}</td>`;
      }).join('')}
    </tr>`;
  }).join('');

  if (data.length > 500) {
    tbody.innerHTML += `<tr><td colspan="${cols.length}" style="padding:12px;text-align:center;color:var(--text-muted);font-size:11px;">Mostrando primeiros 500 de ${data.length.toLocaleString('pt-BR')}. Exporte o CSV para ver todos.</td></tr>`;
  }
}

// ─── Download CSV geocodificado ────────────────────────────────────────────────


// ─── window.* exports ──────────────────────────────────────────────────
window._buildDarkStyle = _buildDarkStyle;
window._buildSatelliteStyle = _buildSatelliteStyle;
window._initMapStyles = _initMapStyles;
window._setupMapInteractions = _setupMapInteractions;
window._setupMapSources = _setupMapSources;
window.applyMapMode = applyMapMode;
window.initMap = initMap;
window.renderGeocoderList = renderGeocoderList;
window.setMapView = setMapView;
