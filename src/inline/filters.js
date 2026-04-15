// ─── filters ─────────────────────────────────────────────────────────
// Extracted from app-legacy.js — domain module

// ─── Normalização de nomes de bandeira ──────────────────────────────────────

var _msState = {}; // id → { options: [{value, label, count}], selected: Set }

function initMultiSelect(id, options) {
  _msState[id] = { options: options, selected: new Set() };
  var wrap = document.getElementById(id);
  var optContainer = wrap.querySelector('.ms-options');
  optContainer.innerHTML = '';
  options.forEach(function(opt) {
    var div = document.createElement('div');
    div.className = 'ms-opt';
    div.dataset.value = opt.value;
    div.dataset.search = opt.label.toLowerCase();
    div.innerHTML = '<input type="checkbox" tabindex="-1"><span class="ms-opt-label">' + _escForHtml(opt.label) + '</span><span class="ms-opt-count">' + opt.count + '</span>';
    div.onclick = function(e) {
      e.stopPropagation();
      var cb = div.querySelector('input');
      cb.checked = !cb.checked;
      if (cb.checked) _msState[id].selected.add(opt.value);
      else _msState[id].selected.delete(opt.value);
      updateMsDisplay(id);
      applyFilters();
    };
    optContainer.appendChild(div);
  });
  updateMsDisplay(id);
}

function updateMsDisplay(id) {
  var wrap = document.getElementById(id);
  var display = wrap.querySelector('.ms-display');
  var sel = _msState[id].selected;
  if (sel.size === 0) {
    display.innerHTML = 'Todas as bandeiras';
    display.style.color = '';
  } else if (sel.size <= 2) {
    var tags = [...sel].map(function(v) { return '<span class="ms-tag">' + v + '</span>'; }).join('');
    display.innerHTML = tags;
    display.style.color = '';
  } else {
    var first2 = [...sel].slice(0, 2).map(function(v) { return '<span class="ms-tag">' + v + '</span>'; }).join('');
    display.innerHTML = first2 + '<span class="ms-tag-more">+' + (sel.size - 2) + '</span>';
    display.style.color = '';
  }
}

function toggleMultiSelect(id) {
  var wrap = document.getElementById(id);
  var dd = wrap.querySelector('.ms-dropdown');
  var trigger = wrap.querySelector('.ms-trigger');
  var isOpen = dd.classList.contains('open');
  // Fechar todos os outros
  document.querySelectorAll('.ms-dropdown.open').forEach(function(d) { d.classList.remove('open'); });
  document.querySelectorAll('.ms-trigger.open').forEach(function(t) { t.classList.remove('open'); });
  if (!isOpen) {
    dd.classList.add('open');
    trigger.classList.add('open');
    var searchInput = wrap.querySelector('.ms-search');
    if (searchInput) { searchInput.value = ''; filterMultiSelect(id, ''); setTimeout(function() { searchInput.focus(); }, 50); }
  }
}

function filterMultiSelect(id, query) {
  var wrap = document.getElementById(id);
  var q = query.toLowerCase();
  wrap.querySelectorAll('.ms-opt').forEach(function(opt) {
    opt.classList.toggle('hidden', q && opt.dataset.search.indexOf(q) === -1);
  });
}

function msSelectAll(id) {
  var wrap = document.getElementById(id);
  _msState[id].selected.clear();
  wrap.querySelectorAll('.ms-opt input').forEach(function(cb) { cb.checked = false; });
  updateMsDisplay(id);
  applyFilters();
}

function msClearAll(id) {
  msSelectAll(id); // "Limpar" = voltar para "Todas"
}

function msGetSelected(id) {
  return _msState[id] ? _msState[id].selected : new Set();
}

function msReset(id) {
  if (!_msState[id]) return;
  _msState[id].selected.clear();
  var wrap = document.getElementById(id);
  if (wrap) wrap.querySelectorAll('.ms-opt input').forEach(function(cb) { cb.checked = false; });
  updateMsDisplay(id);
}

// Fechar dropdown ao clicar fora
document.addEventListener('click', function(e) {
  if (!e.target.closest('.ms-wrap')) {
    document.querySelectorAll('.ms-dropdown.open').forEach(function(d) { d.classList.remove('open'); });
    document.querySelectorAll('.ms-trigger.open').forEach(function(t) { t.classList.remove('open'); });
  }
});

function populateFilters() {
  // ── Bandeira multi-select com normalização ──
  var groups = buildBandeiraGroups();
  // Também contar "Não identificado" e "Carregando..."
  var naoIdCount = allData.filter(function(r) { return !r.bandeira || r.bandeira === 'Não identificado' || r.bandeira === 'Carregando...'; }).length;

  var options = Object.keys(groups).sort().map(function(key) {
    return { value: groups[key].display, label: groups[key].display, count: groups[key].count };
  });
  if (naoIdCount > 0) {
    options.push({ value: 'Não identificado', label: 'Não identificado', count: naoIdCount });
  }
  initMultiSelect('ms-bandeira', options);

  const selUf = document.getElementById('f-uf');
  selUf.innerHTML = '<option value="">Todos os estados</option>';
  const ufs = [...new Set(allData.map(r => r.uf || '').filter(Boolean))].sort();
  ufs.forEach(u => {
    const opt = document.createElement('option'); opt.value = u; opt.textContent = u;
    selUf.appendChild(opt);
  });

  // ── Ranges dinâmicos baseados nos dados reais ──────────────────────
  const ticketsArr = allData.map(r => parseInt(r.tickets_amostra || 0)).filter(v => v > 0);
  const sharesArr  = allData.map(r => parseFloat(r.share_reais_sku_dimensao || 0) * 100).filter(v => v > 0);

  if (ticketsArr.length) {
    const maxT = Math.max(...ticketsArr);
    // Step inteligente baseado no máximo real
    const stepT = maxT <= 50 ? 1 : maxT <= 200 ? 5 : maxT <= 1000 ? 10 : maxT <= 5000 ? 25 : 50;
    const maxTRounded = Math.ceil(maxT / stepT) * stepT;
    const sliderTMin = document.getElementById('f-tickets-min');
    if (sliderTMin) {
      sliderTMin.max = maxTRounded; sliderTMin.step = stepT; sliderTMin.value = 0;
      syncTicketRange();
    }
  }

  if (sharesArr.length) {
    // share_reais_sku_dimensao já é decimal (0.20 = 20%) — multiplicar por 100 para %
    const maxS = Math.min(Math.ceil(Math.max(...sharesArr)), 100);
    const shareSlider = document.getElementById('f-share-min');
    shareSlider.max   = maxS;
    shareSlider.value = 0;
    updateRangeLabel('f-share-min', 'lbl-share-min');
  }
}

function applyFilters() {
  _lastFilteredHash = ''; // invalidar cache de panels
  const selBandeiras = msGetSelected('ms-bandeira');
  const uf = document.getElementById('f-uf').value;
  const shareMin = parseFloat(document.getElementById('f-share-min').value) / 100;
  const ticketsMinEl = document.getElementById('f-tickets-min');
  const ticketsMin = ticketsMinEl ? parseInt(ticketsMinEl.value) : 0;
  const oport = document.querySelector('#f-oport .badge.active')?.dataset.v || '';
  const perf = document.querySelector('#f-perf .badge.active')?.dataset.v || '';

  filteredData = allData.filter(r => {
    if (selBandeiras.size > 0) {
      // Checar pelo nome agrupado (display) via _bandeiraGroupMap
      const grouped = _bandeiraGroupMap[r.bandeira] || r.bandeira;
      if (!selBandeiras.has(grouped)) return false;
    }
    if (uf && r.uf !== uf) return false;
    if (parseFloat(r.share_reais_sku_dimensao || 0) < shareMin) return false;
    if (parseInt(r.tickets_amostra || 0) < ticketsMin) return false;
    if (oport) {
      const o = parseFloat(r.oportunidade_dimensao || 0);
      if (oport === 'alta'  && o <= 0.05) return false;
      if (oport === 'media' && (o < -0.03 || o > 0.05)) return false;
      if (oport === 'baixa' && o >= -0.03) return false;
    }
    if (perf) {
      const d = parseFloat(r.percentual_diff_media_dimensao || 0);
      if (perf === 'acima' && d <= 2) return false;
      if (perf === 'abaixo' && d >= -2) return false;
    }
    return true;
  });

  renderMarkers();
  updatePanels();
  updateOverlay();
}

function syncTicketRange() {
  const minEl = document.getElementById('f-tickets-min');
  const lblEl = document.getElementById('lbl-tickets-min');
  if (minEl && lblEl) lblEl.textContent = parseInt(minEl.value).toLocaleString('pt-BR');
}

function updateRangeLabel(id, labelId, unit = '%') {
  const val = document.getElementById(id).value;
  document.getElementById(labelId).textContent = val + unit;
}

function toggleBadge(el, groupId) {
  document.querySelectorAll(`#${groupId} .badge`).forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function resetFilters() {
  _lastFilteredHash = '';
  msReset('ms-bandeira');
  document.getElementById('f-uf').value = '';
  document.getElementById('f-share-min').value = 0;
  if (document.getElementById('f-tickets-min')) {
    document.getElementById('f-tickets-min').value = 0;
    syncTicketRange();
  }
  document.getElementById('lbl-share-min').textContent = '0%';
  // lbl-tickets atualizado por syncTicketRange
  ['f-oport','f-perf'].forEach(gid => {
    const badges = document.querySelectorAll(`#${gid} .badge`);
    badges.forEach(b => b.classList.remove('active'));
    badges[0]?.classList.add('active');
  });
  filteredData = [...allData];
  renderMarkers();
  updatePanels();
  updateOverlay();
}

function updateHeader() {
  const winCount = filteredData.filter(r => parseFloat(r.percentual_diff_media_dimensao||0) > 2).length;
  const shareAvg = avg(filteredData, 'share_reais_sku_dimensao') * 100;
  const bandeiras = new Set(filteredData.map(r => r.bandeira || 'Outros')).size;

  document.getElementById('h-pdvs').textContent = filteredData.length.toLocaleString('pt-BR');
  document.getElementById('h-share').textContent = shareAvg.toFixed(1) + '%';
  document.getElementById('h-win').textContent = winCount.toLocaleString('pt-BR');
  document.getElementById('h-bandeiras').textContent = bandeiras;
}

var _lastFilteredLength = -1;
var _lastFilteredHash = '';
var _panelRafId = null;

// ─── Overview Tab ────────────────────────────────────────────────────────────


// ─── window.* exports ──────────────────────────────────────────────────
window.applyFilters = applyFilters;
window.filterMultiSelect = filterMultiSelect;
window.initMultiSelect = initMultiSelect;
window.msClearAll = msClearAll;
window.msGetSelected = msGetSelected;
window.msReset = msReset;
window.msSelectAll = msSelectAll;
window.populateFilters = populateFilters;
window.resetFilters = resetFilters;
window.syncTicketRange = syncTicketRange;
window.toggleBadge = toggleBadge;
window.toggleMultiSelect = toggleMultiSelect;
window.updateHeader = updateHeader;
window.updateMsDisplay = updateMsDisplay;
window.updateRangeLabel = updateRangeLabel;
