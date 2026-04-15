// ─── Map Engine ─────────────────────────────────────────────────────────────
// MapLibre GL: init, styles, sources, interactions, renderMarkers, pinColor, buildPopup.
// Este módulo referencia estado global (map, allData, filteredData, currentMapType)
// via window.* pra compatibilidade com o JS inline restante.
// Na integração final, esse state será injetado via parâmetros.

import { cssVar, pct, pctRaw } from './utils.js';

let _popup = null;

// ── Map Styles ──────────────────────────────────────────────────────────────

export function buildDarkStyle() {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: { ofm: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#0d1117' } },
      { id: 'water', type: 'fill', source: 'ofm', 'source-layer': 'water', paint: { 'fill-color': '#151d2a' } },
      { id: 'waterway', type: 'line', source: 'ofm', 'source-layer': 'waterway', paint: { 'line-color': '#151d2a', 'line-width': 1 } },
      { id: 'landcover', type: 'fill', source: 'ofm', 'source-layer': 'landcover', paint: { 'fill-color': '#0f1520', 'fill-opacity': 0.6 } },
      { id: 'landuse', type: 'fill', source: 'ofm', 'source-layer': 'landuse', paint: { 'fill-color': '#111820' } },
      { id: 'park', type: 'fill', source: 'ofm', 'source-layer': 'park', paint: { 'fill-color': '#0f1a16', 'fill-opacity': 0.5 } },
      { id: 'boundary-country', type: 'line', source: 'ofm', 'source-layer': 'boundary', filter: ['==', 'admin_level', 2],
        paint: { 'line-color': '#2d3748', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.2, 6, 2, 10, 2.5], 'line-opacity': 0.6 } },
      { id: 'boundary-state', type: 'line', source: 'ofm', 'source-layer': 'boundary', filter: ['==', 'admin_level', 4],
        paint: { 'line-color': '#1e2530', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 6, 1.4, 10, 2, 14, 2.5], 'line-opacity': 0.5 } },
      { id: 'road-motorway-casing', type: 'line', source: 'ofm', 'source-layer': 'transportation', filter: ['in', 'class', 'motorway', 'trunk'],
        paint: { 'line-color': '#1a2030', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 12, 4, 16, 8] }, minzoom: 5 },
      { id: 'road-motorway', type: 'line', source: 'ofm', 'source-layer': 'transportation', filter: ['in', 'class', 'motorway', 'trunk'],
        paint: { 'line-color': '#1f2a3d', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 12, 2.5, 16, 5] } },
      { id: 'road-primary', type: 'line', source: 'ofm', 'source-layer': 'transportation', filter: ['in', 'class', 'primary', 'secondary'],
        paint: { 'line-color': '#1a2233', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 12, 1.8, 16, 3.5] } },
      { id: 'road-minor', type: 'line', source: 'ofm', 'source-layer': 'transportation', filter: ['in', 'class', 'tertiary', 'minor', 'residential', 'service'],
        paint: { 'line-color': '#151d2a', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.3, 14, 1.2, 16, 2.2] }, minzoom: 10 },
      { id: 'building', type: 'fill', source: 'ofm', 'source-layer': 'building',
        paint: { 'fill-color': '#151d2a', 'fill-outline-color': '#1a2233' }, minzoom: 14 },
      { id: 'label-road-major', type: 'symbol', source: 'ofm', 'source-layer': 'transportation_name',
        filter: ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 14, 11, 18, 13], 'symbol-placement': 'line', 'text-max-angle': 30 },
        paint: { 'text-color': '#4a5f6e', 'text-halo-color': '#0d1117', 'text-halo-width': 2 }, minzoom: 12 },
      { id: 'label-state', type: 'symbol', source: 'ofm', 'source-layer': 'place', filter: ['==', 'class', 'state'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 6, 12, 8, 14], 'text-transform': 'uppercase', 'text-letter-spacing': 0.1 },
        paint: { 'text-color': '#4a5f6e', 'text-halo-color': '#0d1117', 'text-halo-width': 2 } },
    ]
  };
}

// ── Pin Color ────────────────────────────────────────────────────────────────

export function pinColor(row, mapType) {
  const type = mapType || window.currentMapType;
  if (type === 'places_discovery') return cssVar('--purple') || '#a855f7';
  const diff = parseFloat(row.percentual_diff_media_dimensao || 0);
  if (diff > 2) return cssVar('--win');
  if (diff < -2) return cssVar('--lose');
  return cssVar('--neutral');
}

// ── Render Markers ───────────────────────────────────────────────────────────

export function renderMarkers(mapRef, data, mapType) {
  const map = mapRef || window.map;
  const filteredData = data || window.filteredData || [];
  if (!map) return;

  const _doRender = () => {
    if (!map.getSource('pdvs')) {
      setupMapSources(map);
      setupMapInteractions(map);
    }

    const features = filteredData
      .filter(r => parseFloat(r.lat) && parseFloat(r.lon))
      .map((r, i) => {
        if (r._mapId === undefined) r._mapId = i;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [parseFloat(r.lon), parseFloat(r.lat)] },
          properties: { color: pinColor(r, mapType), _mapId: r._mapId },
        };
      });

    try {
      map.getSource('pdvs').setData({ type: 'FeatureCollection', features });
    } catch {
      setTimeout(_doRender, 200);
    }
  };

  if (!map.isStyleLoaded()) {
    map.once('styledata', _doRender);
  } else {
    _doRender();
  }
}

// ── Map Sources ──────────────────────────────────────────────────────────────

export function setupMapSources(map) {
  ['clusters', 'cluster-count', 'pdv-points'].forEach(id => {
    try { if (map.getLayer(id)) map.removeLayer(id); } catch {}
  });
  try { if (map.getSource('pdvs')) map.removeSource('pdvs'); } catch {}

  map.addSource('pdvs', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterMaxZoom: 12,
    clusterRadius: 40,
    clusterProperties: {
      has_green: ['+', ['case', ['==', ['get', 'color'], cssVar('--win')], 1, 0]],
      has_red: ['+', ['case', ['==', ['get', 'color'], cssVar('--lose')], 1, 0]],
    },
  });

  map.addLayer({
    id: 'clusters', type: 'circle', source: 'pdvs', filter: ['has', 'point_count'],
    paint: {
      'circle-color': cssVar('--cluster-color'),
      'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 1, 14, 10, 20, 50, 26, 200, 32, 1000, 38],
      'circle-opacity': 0.85,
      'circle-stroke-width': 2,
      'circle-stroke-color': cssVar('--circle-stroke'),
    },
  });

  map.addLayer({
    id: 'cluster-count', type: 'symbol', source: 'pdvs', filter: ['has', 'point_count'],
    layout: {
      'text-field': ['case', ['>=', ['get', 'point_count'], 1000],
        ['concat', ['to-string', ['floor', ['/', ['get', 'point_count'], 1000]]], 'k'],
        ['to-string', ['get', 'point_count']]],
      'text-font': ['Noto Sans Bold'], 'text-size': 11,
    },
    paint: { 'text-color': cssVar('--text-canvas') },
  });

  map.addLayer({
    id: 'pdv-points', type: 'circle', source: 'pdvs', filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 14, 7, 18, 10],
      'circle-stroke-width': 1.5,
      'circle-stroke-color': cssVar('--circle-stroke-hover'),
      'circle-opacity': 0.95,
    },
  });
}

// ── Map Interactions ─────────────────────────────────────────────────────────

export function setupMapInteractions(map) {
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

  map.on('click', 'pdv-points', (e) => {
    const props = e.features[0].properties;
    const allData = window.allData || [];
    const row = allData.find(r => r._mapId === props._mapId);
    if (!row) return;
    if (_popup) _popup.remove();
    const coords = e.features[0].geometry.coordinates.slice();
    _popup = new maplibregl.Popup({ maxWidth: '340px', closeButton: true, anchor: 'bottom' })
      .setLngLat(coords)
      .setHTML(buildPopup(row))
      .addTo(map);
    requestAnimationFrame(() => {
      const popupEl = _popup.getElement();
      if (!popupEl) return;
      const rect = popupEl.getBoundingClientRect();
      const mapRect = map.getContainer().getBoundingClientRect();
      const overflow = mapRect.top - rect.top + 16;
      if (overflow > 0) map.panBy([0, -overflow], { duration: 300 });
    });
  });

  map.on('mouseenter', 'clusters', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'clusters', () => map.getCanvas().style.cursor = '');
  map.on('mouseenter', 'pdv-points', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'pdv-points', () => map.getCanvas().style.cursor = '');
}

// ── Popup Builder ────────────────────────────────────────────────────────────

export function buildPopup(row) {
  const mapType = window.currentMapType;

  // Places Discovery: minimal popup
  if (row.place_id) {
    return `<div class="popup-inner">
      <div class="popup-header">
        <div class="popup-bandeira">${row.nome || row.bandeira || ''}</div>
        <div class="popup-address">${row.geo_address || ''}</div>
        ${row.place_types ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">${row.place_types}</div>` : ''}
        ${row.place_status ? `<div style="font-size:11px;margin-top:3px;color:${row.place_status === 'Aberto' ? 'var(--win)' : 'var(--text-muted)'}">${row.place_status}</div>` : ''}
      </div>
    </div>`;
  }

  // Geocoder / Reverse: name, address, coordinates
  if (mapType === 'geocoder' || mapType === 'reverse_geocoder') {
    let name = row.nome || row.marca || row.nome_fantasia || '';
    if (!name || name === 'Carregando...' || name === 'Não identificado' || name === 'Desconhecido') name = row.razao_social || '';
    const bnd = row.bandeira || '';
    if (bnd && bnd !== 'Carregando...' && bnd !== 'Não identificado' && bnd !== 'Desconhecido'
      && !bnd.includes(' - ') && bnd !== row.geo_address && bnd !== (row._endereco_livre || '')) name = name || bnd;
    const addr = row.geo_address || '';
    const cnpjRaw = (row.cnpj || '').split(' - ')[0].replace(/\D/g, '');
    const cnpjDisplay = cnpjRaw.length >= 11 ? cnpjRaw : '';
    const coords = (row.lat && row.lon) ? parseFloat(row.lat).toFixed(6) + ', ' + parseFloat(row.lon).toFixed(6) : '';
    return `<div class="popup-inner">
      <div class="popup-header" style="margin-bottom:0;padding-bottom:0;border-bottom:none;">
        ${name ? `<div class="popup-bandeira">${name}</div>` : ''}
        ${addr ? `<div class="popup-address">${addr}</div>` : ''}
        ${cnpjDisplay ? `<div style="font-size:11px;color:var(--text-muted);font-family:var(--mono);margin-top:6px;">CNPJ ${cnpjDisplay}</div>` : ''}
        ${coords ? `<div style="font-size:10px;color:var(--text-muted);font-family:var(--mono);margin-top:4px;">${coords}</div>` : ''}
      </div>
    </div>`;
  }

  // Varejo 360: full popup with metrics
  const diff = parseFloat(row.percentual_diff_media_dimensao || 0);
  const diffClass = diff > 2 ? 'positive' : diff < -2 ? 'negative' : '';
  const diffLabel = diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
  const shareReis = parseFloat(row.share_reais_sku_dimensao || 0) * 100;
  const shareVol = parseFloat(row.share_volume_sku_dimensao || 0) * 100;
  const shareUn = parseFloat(row.share_unidades_sku_dimensao || 0) * 100;
  const maxShare = Math.max(shareReis, shareVol, shareUn, 1);
  const v360CnpjDisplay = row.cnpj_completo || (row.cnpj || '').split(' - ')[0];
  const addrDisplay = (row.cnpj || '').split(' - ').slice(1).join(' - ');

  return `<div class="popup-inner">
    <div class="popup-header">
      <div class="popup-bandeira">${row.bandeira || 'Bandeira desconhecida'}</div>
      ${row.razao_social && row.razao_social !== row.bandeira ? `<div class="popup-fantasia">${row.razao_social}</div>` : ''}
      <div class="popup-address">${row.geo_address || addrDisplay}</div>
      <div class="popup-cnpj">CNPJ ${v360CnpjDisplay}${row.situacao && row.situacao !== 'ATIVA' ? ` · <span style="color:var(--lose)">${row.situacao}</span>` : ''}${row.atividade ? `<div style="font-size:9px;color:var(--text-muted);margin-top:2px">${row.atividade.slice(0, 60)}${row.atividade.length > 60 ? '…' : ''}</div>` : ''}</div>
    </div>
    <div class="popup-metrics">
      <div class="popup-metric"><div class="popup-metric-val ${diffClass}">${diffLabel}</div><div class="popup-metric-label">Diff vs. média dimensão</div></div>
      <div class="popup-metric"><div class="popup-metric-val">${parseFloat(row.oportunidade_dimensao || 0).toFixed(2)}</div><div class="popup-metric-label">Score oportunidade</div></div>
      <div class="popup-metric"><div class="popup-metric-val">${pctRaw(row.percentual_dimensao)}</div><div class="popup-metric-label">% dimensão total</div></div>
      <div class="popup-metric"><div class="popup-metric-val">${pctRaw(row.percentual_marca_dimensao)}</div><div class="popup-metric-label">% marca/dimensão</div></div>
    </div>
    <div class="popup-section-title">Share da marca neste PDV</div>
    <div class="popup-share-bars">
      <div class="share-bar-row"><span class="share-bar-label">Reais</span><div class="share-bar-track"><div class="share-bar-fill ${shareReis >= 10 ? 'win' : shareReis < 5 ? 'lose' : ''}" style="width:${Math.min(shareReis / maxShare * 100, 100)}%"></div></div><span class="share-bar-val">${shareReis.toFixed(1)}%</span></div>
      <div class="share-bar-row"><span class="share-bar-label">Volume</span><div class="share-bar-track"><div class="share-bar-fill" style="width:${Math.min(shareVol / maxShare * 100, 100)}%"></div></div><span class="share-bar-val">${shareVol.toFixed(1)}%</span></div>
      <div class="share-bar-row"><span class="share-bar-label">Unidades</span><div class="share-bar-track"><div class="share-bar-fill" style="width:${Math.min(shareUn / maxShare * 100, 100)}%"></div></div><span class="share-bar-val">${shareUn.toFixed(1)}%</span></div>
    </div>
    <div class="popup-tickets"><span class="popup-tickets-label">Tickets na amostra</span><span class="popup-tickets-val">${parseInt(row.tickets_amostra || 0).toLocaleString('pt-BR')}</span></div>
  </div>`;
}

// ── Theme Change ─────────────────────────────────────────────────────────────

export function rebuildMapStyle(map, theme) {
  if (!map) return;
  const style = theme === 'light' ? buildLightMapStyle() : buildDarkStyle();
  const center = map.getCenter();
  const zoom = map.getZoom();
  map.setStyle(style);
  map.once('styledata', () => {
    map.jumpTo({ center, zoom });
    setupMapSources(map);
    setupMapInteractions(map);
    const filteredData = window.filteredData || [];
    if (filteredData.length > 0) renderMarkers(map, filteredData);
  });
}

// Note: buildLightMapStyle() is large (~80 lines of layer config).
// It remains in index.html inline for now and will be extracted in Sprint 5.
// This module exports buildDarkStyle and rebuildMapStyle as starting points.
function buildLightMapStyle() {
  // Delegate to window function if available (legacy compat)
  if (typeof window._buildLightMapStyle === 'function') return window._buildLightMapStyle();
  // Fallback to dark style if light not yet extracted
  return buildDarkStyle();
}
