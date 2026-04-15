// ─── Gallery ────────────────────────────────────────────────────────────────
// Galeria de mapas salvos: carregamento, filtros, paginação, cards.
// openSavedMap e deleteMap permanecem inline por agora (dependem de estado global do mapa).

import { sbFetch } from './supabase.js';
import { escHtml } from './utils.js';
import { GALLERY_PER_PAGE, GALLERY_MAX_FETCH, THUMB_COLORS } from '../config.js';

let _maps = [];
let _filtered = [];
let _page = 1;

export function getGalleryMaps() { return _maps; }
export function setGalleryMaps(maps) { _maps = maps; }

export async function loadGallery() {
  const loading = document.getElementById('gallery-loading');
  const grid = document.getElementById('gallery-grid');
  const empty = document.getElementById('gallery-empty');
  const filters = document.getElementById('gallery-filters');

  loading.style.display = 'block';
  grid.style.display = 'none';
  empty.style.display = 'none';
  if (filters) filters.style.display = 'none';
  const pagEl = document.getElementById('gallery-pagination');
  if (pagEl) pagEl.style.display = 'none';

  try {
    const maps = await sbFetch(`saved_maps?select=*&order=created_at.desc&limit=${GALLERY_MAX_FETCH}`);
    loading.style.display = 'none';

    if (!maps || maps.length === 0) { empty.style.display = 'block'; return; }

    _maps = maps;
    populateCreatorDropdown(maps);
    if (filters) filters.style.display = 'flex';
    _page = 1;
    applyGalleryFilters();
  } catch (e) {
    loading.innerHTML = `<span style="color:var(--lose)">Erro ao carregar: ${escHtml(e.message)}</span>`;
  }
}

export function applyGalleryFilters(keepPage) {
  const searchVal = (document.getElementById('gf-search')?.value || '').toLowerCase().trim();
  const typeVal = document.getElementById('gf-type')?.value || '';
  const creatorVal = document.getElementById('gf-creator')?.value || '';
  const sortVal = document.getElementById('gf-sort')?.value || 'newest';

  let filtered = _maps.filter(m => {
    if (searchVal) {
      const haystack = `${m.name || ''} ${m.description || ''} ${m.created_by || ''}`.toLowerCase();
      if (!haystack.includes(searchVal)) return false;
    }
    if (typeVal && m.map_type !== typeVal) return false;
    if (creatorVal && m.created_by !== creatorVal) return false;
    return true;
  });

  if (sortVal === 'oldest') filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  else if (sortVal === 'name') filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  _filtered = filtered;
  if (!keepPage) _page = 1;

  const grid = document.getElementById('gallery-grid');
  const empty = document.getElementById('gallery-empty');

  if (filtered.length === 0) {
    if (grid) { grid.innerHTML = ''; grid.style.display = 'none'; }
    const pagEl = document.getElementById('gallery-pagination');
    if (pagEl) pagEl.style.display = 'none';
    if (empty) {
      empty.style.display = 'block';
      const titleEl = empty.querySelector('.gallery-empty-title');
      if (titleEl) titleEl.textContent = (searchVal || typeVal || creatorVal)
        ? 'Nenhum mapa encontrado com esses filtros'
        : 'Nenhum mapa salvo ainda';
    }
  } else {
    if (empty) empty.style.display = 'none';
    renderPage();
  }
}

function renderPage() {
  const grid = document.getElementById('gallery-grid');
  const pagEl = document.getElementById('gallery-pagination');
  if (!grid) return;

  const totalPages = Math.ceil(_filtered.length / GALLERY_PER_PAGE);
  if (_page < 1) _page = 1;
  if (_page > totalPages) _page = totalPages;

  const start = (_page - 1) * GALLERY_PER_PAGE;
  const end = Math.min(start + GALLERY_PER_PAGE, _filtered.length);
  const pageItems = _filtered.slice(start, end);

  grid.innerHTML = '';
  pageItems.forEach(m => grid.appendChild(buildMapCard(m)));
  grid.style.display = 'grid';

  document.querySelector('.gallery-body')?.scrollTo(0, 0);

  if (!pagEl) return;
  if (totalPages <= 1) { pagEl.style.display = 'none'; return; }

  pagEl.style.display = 'flex';
  pagEl.innerHTML = '';

  const info = document.createElement('span');
  info.className = 'gallery-pagination-info';
  info.textContent = `${start + 1}–${end} de ${_filtered.length}`;
  pagEl.appendChild(info);

  const prev = document.createElement('button');
  prev.className = 'gp-btn gp-arrow';
  prev.innerHTML = '‹';
  prev.disabled = _page === 1;
  prev.onclick = () => { _page--; renderPage(); };
  pagEl.appendChild(prev);

  const next = document.createElement('button');
  next.className = 'gp-btn gp-arrow';
  next.innerHTML = '›';
  next.disabled = _page >= totalPages;
  next.onclick = () => { _page++; renderPage(); };
  pagEl.appendChild(next);
}

export function buildMapCard(m) {
  const card = document.createElement('div');
  card.className = 'map-card';

  const date = new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  const dots = Array.from({ length: 30 }, () => {
    const x = 10 + Math.random() * 80, y = 10 + Math.random() * 80;
    return `<circle cx="${x}%" cy="${y}%" r="${1.5 + Math.random() * 2}" fill="white" opacity="${0.3 + Math.random() * 0.5}"/>`;
  }).join('');

  const typeLabels = {
    geocoder:              { label: '📍 Lat/Lon Generator',  color: '#10b981', c1: '#059669', c2: '#064e3b' },
    reverse_geocoder:      { label: '🔄 Address Generator',  color: '#22d3ee', c1: '#0891b2', c2: '#0c4a6e' },
    varejo360:             { label: '📊 Varejo 360',         color: '#f59e0b', c1: '#d97706', c2: '#7c2d12' },
    varejo360_comparativo: { label: '📈 Attack Plan',        color: '#818cf8', c1: '#4f46e5', c2: '#1e1b4b' },
    places_discovery:      { label: '🔎 Places Discovery',   color: '#c084fc', c1: '#9333ea', c2: '#3b0764' },
  };
  const tConf = typeLabels[m.map_type] || typeLabels.varejo360;
  const periodoStr = m.periodo_label ? ` · ${m.periodo_label}` : '';
  const rowLabel = m.map_type === 'geocoder' ? 'pontos' : m.map_type === 'reverse_geocoder' ? 'endereços' : m.map_type === 'places_discovery' ? 'places' : m.map_type === 'varejo360_comparativo' ? 'bandeiras' : 'PDVs';

  card.innerHTML = `
    <div class="map-card-thumb" style="--thumb-c1:${tConf.c1};--thumb-c2:${tConf.c2}">
      <svg class="map-card-thumb-dots" viewBox="0 0 100 100" preserveAspectRatio="none">${dots}</svg>
      <div class="map-card-badge">${(m.row_count || 0).toLocaleString('pt-BR')} ${rowLabel}</div>
      <div style="position:absolute;top:10px;left:10px;z-index:1;font-size:10px;font-weight:600;padding:4px 10px;border-radius:6px;background:rgba(0,0,0,0.6);color:${tConf.color};backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);letter-spacing:0.2px;">${tConf.label}</div>
    </div>
    <div class="map-card-body">
      <div class="map-card-name">${escHtml(m.name)}</div>
      <div class="map-card-desc">${escHtml(m.description || 'Sem descrição')}</div>
      <div class="map-card-meta">
        <div>
          <div class="map-card-date">${date}${periodoStr}</div>
          <div class="map-card-user">${escHtml(m.created_by)}</div>
        </div>
        <button class="map-card-del" title="Excluir" onclick="event.stopPropagation();deleteMap('${m.id}',this)">🗑</button>
      </div>
    </div>`;

  // Click handler: delegate to global functions (openSavedMap, etc) that live in index.html
  card.addEventListener('click', () => {
    if (m.map_type === 'varejo360_comparativo') {
      window.location.href = '/comparativo.html?id=' + m.id;
    } else if (typeof window.openSavedMap === 'function') {
      window.openSavedMap(m.id, m.name, m.map_type || 'varejo360');
    }
  });

  return card;
}

function populateCreatorDropdown(maps) {
  const el = document.getElementById('gf-creator');
  if (!el) return;
  const creators = new Set(maps.map(m => m.created_by).filter(Boolean));
  el.innerHTML = '<option value="">Todos os criadores</option>';
  [...creators].sort().forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c.split('@')[0];
    el.appendChild(opt);
  });
}
