// ─── save ─────────────────────────────────────────────────────────
// Extracted from app-legacy.js — domain module

function showSaveMapDialog() {
  if (!currentUser || allData.length === 0) {
    console.warn('Cannot save: currentUser=', currentUser, 'allData.length=', allData.length);
    return;
  }
  // Pré-preencher com o nome digitado no step 2
  document.getElementById('save-name').value = window._pendingMapName || '';
  document.getElementById('save-desc').value = window._pendingMapDesc || '';
  document.getElementById('save-status').textContent = '';
  document.getElementById('save-btn').disabled = false;
  // Se já tem nome (Places Discovery always has one), salvar automaticamente
  if (window._pendingMapName) {
    autoSaveAndNotify();
    return;
  }
  document.getElementById('save-modal').classList.add('active');
}

async function autoSaveAndNotify() {
  var summary = document.getElementById('places-results-summary');
  try {
    await saveMapToSupabase();
    if (summary) summary.innerHTML += '<br><span style="color:var(--win);font-size:11px;">✓ Mapa salvo automaticamente</span>';
  } catch(e) {
    console.error('Auto-save failed:', e);
    if (summary) summary.innerHTML += '<br><span style="color:var(--lose);font-size:11px;">⚠ Erro ao salvar: ' + escHtml(e.message) + '</span>';
    // Fallback: show modal so user can retry
    document.getElementById('save-modal').classList.add('active');
  }
}

function closeSaveModal() {
  document.getElementById('save-modal').classList.remove('active');
}

async function saveMapToSupabase() {
  const name = document.getElementById('save-name').value.trim();
  if (!name) { document.getElementById('save-status').textContent = '⚠️ Dê um nome ao mapa para salvar.'; return; }

  const btn = document.getElementById('save-btn');
  const status = document.getElementById('save-status');
  btn.disabled = true;
  status.textContent = 'Salvando mapa...';

  try {
    const colorIdx = Math.floor(Math.random()*THUMB_COLORS.length);
    // Build payload with search context for Places Discovery maps
    var savePayload = null;
    var effectiveMapType = window._pendingMapType || currentMapType || 'varejo360';
    if (effectiveMapType === 'places_discovery') {
      savePayload = {
        search_query: (document.getElementById('places-query-input')?.value || '').trim() || window._placesSearchQuery || null,
        search_mode: window._placesSearchMode || _placesMode || 'pin',
        search_states: window._placesSearchStates || Array.from(_selectedStates),
        search_radius_km: parseFloat(document.getElementById('pin-radius-km')?.value) || 5,
      };
    }
    const saved = await sbFetch('saved_maps', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description: document.getElementById('save-desc').value.trim() || null,
        created_by: currentUser.email,
        row_count: allData.length,
        thumbnail_color: THUMB_COLORS[colorIdx],
        map_type: effectiveMapType,
        periodo_mes: window._pendingPeriodo?.mes || null,
        periodo_ano: window._pendingPeriodo?.ano || null,
        periodo_label: window._pendingPeriodo?.label || null,
        payload: savePayload,
      }),
    });
    const mapId = Array.isArray(saved) ? saved[0].id : saved.id;

    // Inserir PDVs em lotes de 500
    const CHUNK = 500;
    const saveable = allData.filter(r => r.lat != null && r.lon != null && parseFloat(r.lat) && parseFloat(r.lon));
    for (let i = 0; i < saveable.length; i += CHUNK) {
      const chunk = saveable.slice(i, i+CHUNK).map(r => ({
        // NUNCA enviar 'id' — evita upsert acidental em PDVs de outros mapas
        map_id: mapId,
        cnpj: r.cnpj||null, bandeira: r.bandeira||null,
        nome: r.nome||null,
        lat: r.lat, lon: r.lon,
        geo_address: r.geo_address||null,
        marca: r.marca||null, uf: r.uf||null,
        nome_fantasia: r.nome_fantasia||null,
        razao_social: r.razao_social||null,
        situacao: r.situacao||null,
        atividade: r.atividade||null,
        cep: r.cep||null,
        place_id: r.place_id||null,
        place_types: r.place_types||null,
        place_status: r.place_status||null,
        percentual_dimensao: parseFloat(r.percentual_dimensao)||null,
        percentual_marca_dimensao: parseFloat(r.percentual_marca_dimensao)||null,
        percentual_diff_media_dimensao: parseFloat(r.percentual_diff_media_dimensao)||null,
        oportunidade_dimensao: r.oportunidade_dimensao||null,
        share_reais_sku: parseFloat(r.share_reais_sku)||null,
        share_volume_sku: parseFloat(r.share_volume_sku)||null,
        share_unidades_sku: parseFloat(r.share_unidades_sku)||null,
        share_reais_dimensao: parseFloat(r.share_reais_dimensao)||null,
        share_volume_dimensao: parseFloat(r.share_volume_dimensao)||null,
        share_unidades_dimensao: parseFloat(r.share_unidades_dimensao)||null,
        share_reais_sku_dimensao: parseFloat(r.share_reais_sku_dimensao)||null,
        share_volume_sku_dimensao: parseFloat(r.share_volume_sku_dimensao)||null,
        share_unidades_sku_dimensao: parseFloat(r.share_unidades_sku_dimensao)||null,
        share_reais_sku_diff_media_dimensao: parseFloat(r.share_reais_sku_diff_media_dimensao)||null,
        share_volume_sku_diff_media_dimensao: parseFloat(r.share_volume_sku_diff_media_dimensao)||null,
        share_unidades_sku_diff_media_dimensao: parseFloat(r.share_unidades_sku_diff_media_dimensao)||null,
        tickets_amostra: parseInt(r.tickets_amostra)||null,
      }));
      await sbFetch('map_pdvs', { method:'POST', headers:{'Prefer':'return=minimal'}, body: JSON.stringify(chunk) });
      const pct = Math.round((i+chunk.length)/saveable.length*100);
      status.textContent = `Salvando PDVs... ${pct}%`;
    }

    status.innerHTML = `<span style="color:var(--win)">✓ Mapa salvo com sucesso!</span>`;
    setTimeout(closeSaveModal, 1500);
  } catch(e) {
    status.innerHTML = `<span style="color:var(--lose)">Erro: ${escHtml(e.message)}</span>`;
    btn.disabled = false;
    throw e; // Re-throw so autoSaveAndNotify can catch it
  }
}
// ─── Places Discovery ─────────────────────────────────────────────────────────


// ─── window.* exports ──────────────────────────────────────────────────
window.autoSaveAndNotify = autoSaveAndNotify;
window.closeSaveModal = closeSaveModal;
window.saveMapToSupabase = saveMapToSupabase;
window.showSaveMapDialog = showSaveMapDialog;
