// ─── modals ─────────────────────────────────────────────────────────
// Extracted from app-legacy.js — domain module

function openMapTypeModal() {
  const m = document.getElementById('map-type-modal');
  m.style.display = 'flex';
  m.style.opacity = '1';
  m.style.pointerEvents = 'all';
  m.classList.add('active');
}
function closeMapTypeModal() {
  const m = document.getElementById('map-type-modal');
  m.classList.remove('active');
  m.style.display = 'none';
  m.style.opacity = '0';
  m.style.pointerEvents = 'none';
}
// Fechar modal ao clicar no backdrop
document.addEventListener('click', e => {
  const modal = document.getElementById('map-type-modal');
  if (modal?.classList.contains('active') && e.target === modal) closeMapTypeModal();
});
function selectMapType(type) {
  currentMapType = type;
  closeMapTypeModal();
  // Limpar dados do mapa anterior — evita sobrescrever mapa existente
  allData = [];
  filteredData = [];
  rawCSVData = [];
  window._pendingMapName = null;
  window._pendingMapDesc = null;
  window._pendingMapType = type;
  window._pendingPeriodo = null;

  // Adaptar UI conforme o tipo
  const periodoEl = document.getElementById('step2-periodo');
  const uploadSub = document.querySelector('#upload-zone .upload-sub');
  const formatsMsg = document.getElementById('upload-formats-msg');
  const startBtn = document.getElementById('btn-start-geo');
  const uploadTitle = document.querySelector('#drop-zone .upload-title');

  if (type === 'geocoder') {
    if (uploadTitle) uploadTitle.textContent = 'Gerar Lat/Lon';
    if (uploadSub) uploadSub.textContent = 'Suba um CSV com endereços. O sistema geocodifica cada linha e gera as coordenadas (lat/lon).';
    if (formatsMsg) formatsMsg.textContent = 'Aceita endereço por extenso com cidade e UF';
    if (startBtn) startBtn.textContent = 'Iniciar geocodificação →';
    if (periodoEl) periodoEl.style.display = 'none';
    renderUploadTemplate('geocoder');
  } else if (type === 'reverse_geocoder') {
    if (uploadTitle) uploadTitle.textContent = 'Gerar Endereços';
    if (uploadSub) uploadSub.textContent = 'Suba um CSV com colunas lat e lon. O sistema busca o endereço completo de cada coordenada via reverse geocoding.';
    if (formatsMsg) formatsMsg.textContent = 'Colunas obrigatórias: lat · lon — opcionais: nome · categoria';
    if (startBtn) startBtn.textContent = 'Iniciar reverse geocoding →';
    if (periodoEl) periodoEl.style.display = 'none';
    renderUploadTemplate('reverse_geocoder');
  } else if (type === 'places_discovery') {
    // Places Discovery: abrir setup overlay em vez do upload zone
    showPlacesSetup();
    return; // não chamar showUploadZone()
  } else {
    if (uploadTitle) uploadTitle.textContent = 'Mapa de Share por PDV';
    if (uploadSub) uploadSub.innerHTML = 'Exporte do Varejo 360 o share da marca aberto por <strong>Loja (CNPJ)</strong>. O sistema geocodifica cada PDV e plota o share no mapa.';
    if (formatsMsg) formatsMsg.textContent = 'Formato HYPR/Kantar · CSV com cnpj + share · CNPJ raiz (8 dígitos)';
    if (startBtn) startBtn.textContent = 'Iniciar geocodificação →';
    if (periodoEl) periodoEl.style.display = 'flex';
    renderUploadTemplate('varejo360');
  }

  // Mostrar view toggle só para geocoder
  const vtBtns = document.getElementById('view-toggle-btns');
  if (vtBtns) vtBtns.style.display = type !== 'varejo360' ? 'flex' : 'none';

  showUploadZone();
}

// ─── Template preview e download por tipo de mapa ────────────────────────────

function openVarejoSubModal() {
  closeMapTypeModal();
  var m = document.getElementById('varejo-sub-modal');
  m.style.display = 'flex';
  m.style.opacity = '1';
  m.style.pointerEvents = 'all';
  m.classList.add('active');
}
function closeVarejoSubModal() {
  var m = document.getElementById('varejo-sub-modal');
  m.classList.remove('active');
  m.style.display = 'none';
  m.style.opacity = '0';
  m.style.pointerEvents = 'none';
}
document.addEventListener('click', function(e) {
  var modal = document.getElementById('varejo-sub-modal');
  if (modal && modal.classList.contains('active') && e.target === modal) closeVarejoSubModal();
});
function selectVarejoSubType(subType) {
  closeVarejoSubModal();
  if (subType === 'comparativo') {
    window.location.href = '/comparativo.html';
  } else {
    selectMapType('varejo360');
  }
}

// ─── View toggle mapa/lista ───────────────────────────────────────────────────


// ─── window.* exports ──────────────────────────────────────────────────
window.closeMapTypeModal = closeMapTypeModal;
window.closeVarejoSubModal = closeVarejoSubModal;
window.openMapTypeModal = openMapTypeModal;
window.openVarejoSubModal = openVarejoSubModal;
window.selectMapType = selectMapType;
window.selectVarejoSubType = selectVarejoSubType;
