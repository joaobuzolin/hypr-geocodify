// ─── gallery ─────────────────────────────────────────────────────────
// Extracted from app-legacy.js — domain module

var THUMB_COLORS = ['#7C3AED','#2563EB','#059669','#DC2626','#D97706','#0891B2','#9333EA'];

function showGallery() {
  window._pendingGeocodingAfterLogin = false;
  try { history.replaceState(null, '', location.pathname); } catch(e) {}
  try { sessionStorage.removeItem('hypr_last_map'); } catch(e) {}
  // Resetar view e pendências
  window._pendingMapType = null;
  window._pendingPeriodo = null;
  window._pendingMapName = null;
  window._pendingMapDesc = null;
  rawCSVData = [];
  currentView = 'map';
  const listEl = document.getElementById('geocoder-list-view');
  if (listEl) listEl.style.display = 'none';
  const vtBtns = document.getElementById('view-toggle-btns');
  if (vtBtns) vtBtns.style.display = 'none';
  // Resetar modo visual
  const _appGal = document.getElementById('app');
  if (_appGal) _appGal.classList.remove('mode-geo', 'mode-places');
  // Always hide places-panel when returning to gallery
  var _ppGal = document.getElementById('places-panel');
  if (_ppGal) _ppGal.style.display = 'none';
  var _badgeGal = document.getElementById('places-map-badge');
  if (_badgeGal) _badgeGal.style.display = 'none';
  const _lsGal = document.getElementById('logo-map-type');
  if (_lsGal) _lsGal.textContent = 'by HYPR°';
  const _vtGal = document.getElementById('view-toggle-btns');
  if (_vtGal) _vtGal.style.display = 'none';
  document.getElementById('gallery-screen').classList.remove('hidden');
  document.getElementById('upload-zone').classList.add('hidden');
  document.getElementById('app').style.display = 'none';
  loadGallery();
}


function showUploadZone() {
  document.getElementById('gallery-screen').classList.add('hidden');
  document.getElementById('upload-zone').classList.remove('hidden');
  document.getElementById('app').style.display = 'none';
  allData = []; filteredData = [];
  goToStep(1);
}

var _galleryMaps = []; // Store for filtering
var _galleryPage = 1;
var _galleryPerPage = 30;
var _galleryFiltered = []; // Current filtered set

async function loadGallery() {
  var loading = document.getElementById('gallery-loading');
  var grid = document.getElementById('gallery-grid');
  var empty = document.getElementById('gallery-empty');
  var filters = document.getElementById('gallery-filters');
  loading.style.display = 'block';
  grid.style.display = 'none';
  empty.style.display = 'none';
  if (filters) filters.style.display = 'none';
  document.getElementById('gallery-pagination').style.display = 'none';

  try {
    var maps = await sbFetch('saved_maps?select=*&order=created_at.desc&limit=500');
    loading.style.display = 'none';
    if (!maps || maps.length === 0) { empty.style.display = 'block'; return; }
    _galleryMaps = maps;
    // Populate creator dropdown
    var creatorEl = document.getElementById('gf-creator');
    if (creatorEl) {
      var creators = {};
      maps.forEach(function(m) { if (m.created_by) creators[m.created_by] = true; });
      creatorEl.innerHTML = '<option value="">Todos os criadores</option>';
      Object.keys(creators).sort().forEach(function(c) {
        var opt = document.createElement('option');
        opt.value = c; opt.textContent = c.split('@')[0];
        creatorEl.appendChild(opt);
      });
    }
    if (filters) filters.style.display = 'flex';
    _galleryPage = 1;
    applyGalleryFilters();
  } catch (e) {
    loading.innerHTML = '<span style="color:var(--lose)">Erro ao carregar: ' + escHtml(e.message) + '</span>';
  }
}

function applyGalleryFilters(keepPage) {
  var searchVal = (document.getElementById('gf-search').value || '').toLowerCase().trim();
  var typeVal = document.getElementById('gf-type').value;
  var creatorVal = document.getElementById('gf-creator').value;
  var sortVal = document.getElementById('gf-sort').value;
  var grid = document.getElementById('gallery-grid');
  var empty = document.getElementById('gallery-empty');
  var pagEl = document.getElementById('gallery-pagination');
  
  // Search in name, description and creator
  var filtered = _galleryMaps.filter(function(m) {
    if (searchVal) {
      var haystack = ((m.name || '') + ' ' + (m.description || '') + ' ' + (m.created_by || '')).toLowerCase();
      if (haystack.indexOf(searchVal) === -1) return false;
    }
    if (typeVal && m.map_type !== typeVal) return false;
    if (creatorVal && m.created_by !== creatorVal) return false;
    return true;
  });
  
  if (sortVal === 'oldest') {
    filtered.sort(function(a,b) { return new Date(a.created_at) - new Date(b.created_at); });
  } else if (sortVal === 'name') {
    filtered.sort(function(a,b) { return (a.name || '').localeCompare(b.name || ''); });
  }
  // newest is default (already sorted from API)
  
  _galleryFiltered = filtered;
  if (!keepPage) _galleryPage = 1;
  
  if (filtered.length === 0) {
    grid.innerHTML = '';
    grid.style.display = 'none';
    pagEl.style.display = 'none';
    empty.style.display = 'block';
    empty.querySelector('.gallery-empty-title').textContent = searchVal || typeVal || creatorVal ? 'Nenhum mapa encontrado com esses filtros' : 'Nenhum mapa salvo ainda';
  } else {
    empty.style.display = 'none';
    renderGalleryPage();
  }
}

function renderGalleryPage() {
  var grid = document.getElementById('gallery-grid');
  var pagEl = document.getElementById('gallery-pagination');
  var total = _galleryFiltered.length;
  var totalPages = Math.ceil(total / _galleryPerPage);
  
  if (_galleryPage < 1) _galleryPage = 1;
  if (_galleryPage > totalPages) _galleryPage = totalPages;
  
  var start = (_galleryPage - 1) * _galleryPerPage;
  var end = Math.min(start + _galleryPerPage, total);
  var pageItems = _galleryFiltered.slice(start, end);
  
  grid.innerHTML = '';
  for (var i = 0; i < pageItems.length; i++) grid.appendChild(buildMapCard(pageItems[i]));
  grid.style.display = 'grid';
  
  // Scroll gallery body to top
  var body = document.querySelector('.gallery-body');
  if (body) body.scrollTop = 0;
  
  if (totalPages <= 1) { pagEl.style.display = 'none'; return; }
  
  pagEl.style.display = 'flex';
  pagEl.innerHTML = '';
  
  var info = document.createElement('span');
  info.className = 'gallery-pagination-info';
  info.textContent = (start + 1) + '–' + end + ' de ' + total;
  pagEl.appendChild(info);
  
  var prev = document.createElement('button');
  prev.className = 'gp-btn gp-arrow';
  prev.innerHTML = '‹';
  prev.disabled = _galleryPage === 1;
  prev.onclick = function() { _galleryPage--; renderGalleryPage(); };
  pagEl.appendChild(prev);
  
  var pages = buildPageNumbers(_galleryPage, totalPages);
  for (var p = 0; p < pages.length; p++) {
    if (pages[p] === '...') {
      var ell = document.createElement('span');
      ell.className = 'gp-ellipsis';
      ell.textContent = '…';
      pagEl.appendChild(ell);
    } else {
      var btn = document.createElement('button');
      btn.className = 'gp-btn' + (pages[p] === _galleryPage ? ' active' : '');
      btn.textContent = pages[p];
      btn.onclick = (function(pg) { return function() { _galleryPage = pg; renderGalleryPage(); }; })(pages[p]);
      pagEl.appendChild(btn);
    }
  }
  
  var next = document.createElement('button');
  next.className = 'gp-btn gp-arrow';
  next.innerHTML = '›';
  next.disabled = _galleryPage === totalPages;
  next.onclick = function() { _galleryPage++; renderGalleryPage(); };
  pagEl.appendChild(next);
}

function buildPageNumbers(current, total) {
  if (total <= 7) {
    var arr = [];
    for (var i = 1; i <= total; i++) arr.push(i);
    return arr;
  }
  var pages = [1];
  if (current > 3) pages.push('...');
  var lo = Math.max(2, current - 1);
  var hi = Math.min(total - 1, current + 1);
  for (var j = lo; j <= hi; j++) pages.push(j);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

function buildMapCard(m) {
  const card = document.createElement('div');
  card.className = 'map-card';
  const date = new Date(m.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
  const dots = Array.from({length:30}, () => {
    const x = 10 + Math.random()*80, y = 10 + Math.random()*80;
    return `<circle cx="${x}%" cy="${y}%" r="${1.5+Math.random()*2}" fill="white" opacity="${0.3+Math.random()*0.5}"/>`;
  }).join('');
  const typeLabels = {
    'geocoder':              { label: '📍 Lat/Lon Generator',  color: '#10b981', bg: 'rgba(16,185,129,0.2)',  c1: '#059669', c2: '#064e3b' },
    'reverse_geocoder':      { label: '🔄 Address Generator',  color: '#22d3ee', bg: 'rgba(34,211,238,0.2)',  c1: '#0891b2', c2: '#0c4a6e' },
    'varejo360':             { label: '📊 Varejo 360',         color: '#f59e0b', bg: 'rgba(245,158,11,0.2)',  c1: '#d97706', c2: '#7c2d12' },
    'varejo360_comparativo': { label: '📈 Attack Plan',    color: '#818cf8', bg: 'rgba(129,140,248,0.2)', c1: '#4f46e5', c2: '#1e1b4b' },
    'places_discovery':      { label: '🔎 Places Discovery',   color: '#c084fc', bg: 'rgba(192,132,252,0.2)', c1: '#9333ea', c2: '#3b0764' },
  };
  const tConf = typeLabels[m.map_type] || typeLabels['varejo360'];
  const periodoStr = m.periodo_label ? ` · ${m.periodo_label}` : '';
  const rowLabel = m.map_type === 'geocoder' ? 'pontos' : m.map_type === 'reverse_geocoder' ? 'endereços' : m.map_type === 'places_discovery' ? 'places' : m.map_type === 'varejo360_comparativo' ? 'bandeiras' : 'PDVs';
  card.innerHTML = `
    <div class="map-card-thumb" style="--thumb-c1:${tConf.c1};--thumb-c2:${tConf.c2}">
      <svg class="map-card-thumb-dots" viewBox="0 0 100 100" preserveAspectRatio="none">${dots}</svg>
      <div class="map-card-badge">${(m.row_count||0).toLocaleString('pt-BR')} ${rowLabel}</div>
      <div style="position:absolute;top:10px;left:10px;z-index:1;font-size:10px;font-weight:600;padding:4px 10px;border-radius:6px;background:rgba(0,0,0,0.6);color:${tConf.color};backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);letter-spacing:0.2px;">${tConf.label}</div>
    </div>
    <div class="map-card-body">
      <div class="map-card-name">${escHtml(m.name)}</div>
      <div class="map-card-desc">${escHtml(m.description||'Sem descrição')}</div>
      <div class="map-card-meta">
        <div>
          <div class="map-card-date">${date}${periodoStr}</div>
          <div class="map-card-user">${escHtml(m.created_by)}</div>
        </div>
        <button class="map-card-del" title="Excluir" onclick="event.stopPropagation();deleteMap('${m.id}',this)">🗑</button>
      </div>
    </div>`;
  card.addEventListener('click', () => {
    if (m.map_type === 'varejo360_comparativo') {
      window.location.href = '/comparativo.html?id=' + m.id;
    } else {
      openSavedMap(m.id, m.name, m.map_type || 'varejo360');
    }
  });
  return card;
}

async function deleteMap(id, btn) {
  if (!confirm('Excluir este mapa? Esta ação não pode ser desfeita.')) return;
  btn.disabled = true;
  try {
    await sbFetch(`saved_maps?id=eq.${id}`, { method:'DELETE', headers:{'Prefer':'return=minimal'} });
    _galleryMaps = _galleryMaps.filter(function(m) { return m.id !== id; });
    if (_galleryMaps.length === 0) {
      document.getElementById('gallery-grid').style.display = 'none';
      document.getElementById('gallery-pagination').style.display = 'none';
      document.getElementById('gallery-empty').style.display = 'block';
    } else {
      applyGalleryFilters(true);
    }
  } catch(e) { alert('Erro ao excluir: '+e.message); btn.disabled=false; }
}

async function openSavedMap(mapId, name, mapType) {
  // Limpar pendências de geocoding anterior — evita save acidental
  window._pendingMapName = null;
  window._pendingMapDesc = null;
  window._pendingMapType = null;
  window._pendingPeriodo = null;
  rawCSVData = [];
  // Aplicar modo visual correto ANTES de mostrar o mapa
  applyMapMode(mapType || 'varejo360');
  // Salvar estado para restaurar ao trocar de aba
  try { sessionStorage.setItem('hypr_last_map', JSON.stringify({ mapId, mapName: name, mapType: _mapType })); } catch(e) {}
  // Atualizar URL para permitir compartilhamento e F5
  try { history.replaceState(null, '', '?map=' + mapId); } catch(e) {}
  document.getElementById('gallery-screen').classList.add('hidden');
  document.getElementById('upload-zone').classList.add('hidden');
  // Mostrar #app ANTES de initMap — MapLibre precisa do container visível
  document.getElementById('app').style.display = 'flex';
  await new Promise(r => setTimeout(r, 50)); // dar tempo ao browser renderizar
  if (!map) initMap();
  await new Promise(r => setTimeout(r, 100)); // aguardar MapLibre inicializar
  if (map) map.resize();

  const overlay = document.getElementById('geocoding-overlay');
  overlay.classList.add('active');
  document.getElementById('geo-current').textContent = `Carregando "${name}"...`;
  document.getElementById('geo-fill').style.width = '0%';
  document.getElementById('geo-pct').textContent = '';
  document.getElementById('geo-ok').textContent = '';
  document.getElementById('geo-fail').textContent = '';
  document.getElementById('geo-eta').textContent = '';

  try {
    // Load map metadata (payload with search context)
    var mapMeta = await sbFetch('saved_maps?id=eq.' + mapId + '&select=payload');
    window._savedMapPayload = (Array.isArray(mapMeta) && mapMeta[0]?.payload) || null;
    window._savedMapId = mapId;

    let page = 0; const PAGE = 1000;
    allData = [];
      map.jumpTo({ center: [-47.93, -15.78], zoom: 4 });

    while (true) {
      const rows = await sbFetch(`map_pdvs?map_id=eq.${mapId}&select=*&offset=${page*PAGE}&limit=${PAGE}`);
      if (!rows || rows.length === 0) break;

      for (const r of rows) {
        allData.push(r);
        // pins adicionados via renderMarkers() após carregamento completo
      }

      const pct = Math.min(99, Math.round(allData.length/500*10));
      document.getElementById('geo-fill').style.width = pct+'%';
      document.getElementById('geo-current').textContent = `${allData.length.toLocaleString('pt-BR')} PDVs carregados...`;
      if (rows.length < PAGE) break;
      page++;
    }

    overlay.classList.remove('active');
  filteredData = [...allData];
  if (allData.length > 0) {
      const _pts = allData.filter(r => r.lat && r.lon);
      if (!_pts.length) return;
      const bounds = _pts.reduce((b, r) => b.extend([parseFloat(r.lon), parseFloat(r.lat)]),
        new maplibregl.LngLatBounds([parseFloat(_pts[0].lon), parseFloat(_pts[0].lat)], [parseFloat(_pts[0].lon), parseFloat(_pts[0].lat)]));
      map.fitBounds(bounds, { padding:[40,40] });
    }
    populateFilters(); updatePanels(); updateOverlay();
    // If this is a Places Discovery map, show the results panel (not the search form)
    if (currentMapType === 'places_discovery' && allData.length > 0) {
      document.getElementById('places-panel').style.display = 'block';
      document.getElementById('places-results-section').style.display = 'block';
      var plPayload = window._savedMapPayload;
      var queryLabel = plPayload?.search_query ? ' · <span style="color:var(--text-dim);">"' + escHtml(plPayload.search_query) + '"</span>' : '';
      document.getElementById('places-results-summary').innerHTML = '<strong>' + allData.length + '</strong> places carregados' + queryLabel;
      // Pre-fill query field for expand
      if (plPayload?.search_query) {
        var qInput = document.getElementById('places-query-input');
        if (qInput) qInput.value = plPayload.search_query;
      }
      updatePlacesBadge(allData.length);
    }
    // Renderizar pins — aguardar style estar pronto se necessário
    if (map.isStyleLoaded() && map.getSource('pdvs')) {
      renderMarkers();
    } else {
      map.once('styledata', () => renderMarkers());
    }
  } catch(e) {
    overlay.classList.remove('active');
    alert('Erro ao carregar mapa: '+e.message);
  }
}

// ─── Modal Salvar ─────────────────────────────────────────────────────────────


// ─── window.* exports ──────────────────────────────────────────────────
window.applyGalleryFilters = applyGalleryFilters;
window.buildMapCard = buildMapCard;
window.buildPageNumbers = buildPageNumbers;
window.deleteMap = deleteMap;
window.loadGallery = loadGallery;
window.openSavedMap = openSavedMap;
window.renderGalleryPage = renderGalleryPage;
window.showGallery = showGallery;
window.showUploadZone = showUploadZone;
