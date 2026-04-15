// ─── geocoding ─────────────────────────────────────────────────────────
// Extracted from app-legacy.js — domain module

function downloadGeocoderCSV() {
  const data = allData.length ? allData : [];
  if (!data.length) { alert('Nenhum dado para exportar.'); return; }

  let cols, labels;
  if (currentMapType === 'geocoder') {
    cols   = ['_input', 'lat', 'lon', 'geo_address', 'uf', 'cep', '_status'];
    labels = ['Endereco_Original', 'Latitude', 'Longitude', 'Endereco_Geocodificado', 'UF', 'CEP', 'Status'];
  } else if (currentMapType === 'reverse_geocoder') {
    cols   = ['nome', 'input_lat', 'input_lon', 'geo_address', 'uf', 'cep', '_status'];
    labels = ['Nome', 'Lat_Input', 'Lon_Input', 'Endereco', 'UF', 'CEP', 'Status'];
  } else if (currentMapType === 'places_discovery') {
    cols   = ['nome', 'geo_address', 'lat', 'lon', 'place_id', 'place_types', 'place_status'];
    labels = ['Nome', 'Endereco', 'Latitude', 'Longitude', 'Google_Place_ID', 'Tipos', 'Status'];
  } else {
    // Varejo 360: full columns with CNPJ, bandeira, receita data
    cols   = ['bandeira', 'cnpj', 'lat', 'lon', 'geo_address', 'uf', 'nome_fantasia', 'razao_social', 'cep'];
    labels = ['Bandeira', 'CNPJ', 'Latitude', 'Longitude', 'Endereco', 'UF', 'Nome_Fantasia', 'Razao_Social', 'CEP'];
  }

  const esc = v => v == null ? '' : `"${String(v).replace(/"/g, '""')}"`;
  const rows = [labels.join(','), ...data.map(r => cols.map(c => {
    if (c === '_status') return esc(r._geocodeFailed ? 'Não identificado' : (r._ufMismatch ? 'UF Mismatch (' + r._expectedUF + '→' + (r.uf||'?') + ')' : 'OK'));
    if (c === '_input') return esc(r.endereco_geocode || r._endereco_livre || r.endereco || r['endereço'] || r.address || '');
    return esc(r[c]);
  }).join(','))];
  const blob = new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: `geocodify_${currentMapType}_${Date.now()}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Reverse Geocoding (lat/lon → endereço) ───────────────────────────────────

async function reverseGeocodeHERE(lat, lon) {
  const resp = await fetch(
    `/api/geocode?action=reverse&at=${lat},${lon}&lang=pt-BR&limit=1`
  );
  if (!resp.ok) return null;
  const d = await resp.json();
  const item = d.items?.[0];
  if (!item) return null;
  return {
    geo_address: item.address?.label || '',
    uf: item.address?.stateCode || '',
    cep: item.address?.postalCode || '',
  };
}

document.addEventListener('DOMContentLoaded', () => {
  initResizablePanels();
  // Restaurar estado de colapso
  try {
    if (localStorage.getItem('hypr_sidebar_collapsed') === 'true') toggleSidebar();
    if (localStorage.getItem('hypr_panel_collapsed') === 'true') togglePanel();
    if (localStorage.getItem('hypr_fullmap') === 'true') toggleFullMap();
  } catch(e) {}

  // Atalho de teclado: F = toggle tela cheia do mapa
  document.addEventListener('keydown', e => {
    if (e.key === 'f' || e.key === 'F') {
      // Não disparar se estiver em input/textarea
      if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
      toggleFullMap();
    }
    // ESC sai do modo tela cheia ou fecha modal/toast
    if (e.key === 'Escape') {
      var geoToast = document.getElementById('geo-toast');
      if (geoToast && geoToast.classList.contains('active')) { dismissGeoToast(); return; }
      var vsm = document.getElementById('varejo-sub-modal');
      if (vsm && vsm.classList.contains('active')) { closeVarejoSubModal(); return; }
      const modal = document.getElementById('map-type-modal');
      if (modal?.classList.contains('active')) { closeMapTypeModal(); return; }
      const app = document.getElementById('app');
      if (app.classList.contains('map-only')) toggleFullMap();
    }
  });

  initAuth();
});

async function initAuth() {
  if (!_supa && window.supabase) {
    _supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  }
  // Check existing session
  var sessionResult = await _supa.auth.getSession();
  var session = sessionResult.data ? sessionResult.data.session : null;
  if (session && session.user) {
    handleLoggedIn(session.user);
    return;
  }
  // Listen for auth changes (OAuth redirect callback)
  _supa.auth.onAuthStateChange(function(event, sess) {
    if (event === 'SIGNED_IN' && sess && sess.user) {
      handleLoggedIn(sess.user);
    }
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      document.getElementById('login-screen').style.display = '';
      document.getElementById('gallery-screen').classList.add('hidden');
    }
  });
  // No session - show login
  document.getElementById('login-screen').style.display = '';
}

async function doGoogleLogin() {
  if (!_supa) return;
  var btn = document.getElementById('login-google-btn');
  var errEl = document.getElementById('login-error');
  errEl.innerHTML = ''; errEl.classList.remove('visible');
  btn.disabled = true; btn.textContent = 'Conectando...';
  var result = await _supa.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: { hd: 'hypr.mobi' }
    }
  });
  if (result.error) {
    btn.disabled = false;
    btn.innerHTML = 'Entrar com Google';
    errEl.innerHTML = 'Erro: ' + escHtml(result.error.message);
    errEl.classList.add('visible');
  }
}

async function handleLoggedIn(user) {
  if (!user || !user.email || !user.email.endsWith('@hypr.mobi')) {
    await _supa.auth.signOut();
    var errEl = document.getElementById('login-error');
    if (errEl) {
      errEl.innerHTML = 'Acesso restrito a <strong>@hypr.mobi</strong>. Você entrou com: ' + escHtml(user ? user.email : 'desconhecido');
      errEl.classList.add('visible');
    }
    document.getElementById('login-screen').style.display = '';
    return;
  }
  currentUser = user;
  document.getElementById('login-screen').style.display = 'none';
  var emailEl = document.getElementById('gallery-user-email');
  var subEl = document.getElementById('gallery-user-sub');
  if (emailEl) emailEl.textContent = user.email;
  if (subEl) subEl.textContent = 'Seus mapas geocodificados';
  // Restore context
  try {
    var urlMapId = new URLSearchParams(location.search).get('map');
    var saved = sessionStorage.getItem('hypr_last_map');
    var targetId = urlMapId || (saved ? JSON.parse(saved).mapId : null);
    if (targetId) {
      if (allData.length > 0) {
        document.getElementById('gallery-screen').classList.add('hidden');
        document.getElementById('app').style.display = 'flex';
        await new Promise(function(r) { setTimeout(r, 50); });
        if (!map) initMap(); else map.resize();
        renderMarkers(); populateFilters(); updatePanels(); updateOverlay();
        return;
      }
      _supa.from('saved_maps').select('id,name,map_type').eq('id', targetId).single()
        .then(function(res) { if (res.data) openSavedMap(res.data.id, res.data.name, res.data.map_type); else showGallery(); })
        .catch(function() { showGallery(); });
      return;
    }
  } catch(e) {}
  if (window._pendingGeocodingAfterLogin && rawCSVData.length > 0) {
    window._pendingGeocodingAfterLogin = false;
    startGeocoding();
    return;
  }
  showGallery();
}

var rawCSVData = [];
var geocodingCancelled = false;
var geocodingActive = false;

// ─── Step Navigation ─────────────────────────────────────────────────────────

function goToStep(n) {
  document.getElementById('drop-zone').style.display = n === 1 ? 'block' : 'none';
  document.getElementById('step-apikey-box').style.display = n === 2 ? 'block' : 'none';

  [1,2].forEach(i => {
    const el = document.getElementById('step-' + i);
    if (!el) return;
    el.classList.remove('active','done');
    if (i < n) el.classList.add('done');
    if (i === n) el.classList.add('active');
  });
}

// ─── Address Parser ───────────────────────────────────────────────────────────

function extrairEndereco(cnpjCol) {
  // Formato: "CNPJ - RUA, NUM - BAIRRO - CIDADE/UF"
  const partes = cnpjCol.split(' - ');
  if (partes.length < 2) return { address: cnpjCol + ', Brasil', street: cnpjCol, city: '', state: '', district: '' };

  // partes[0] = CNPJ (ignorar)
  // partes[1] = Rua + número: "ALEXANDRE COLARES, 1188"
  // partes[2..n-1] = Bairro(s) intermediários
  // partes[último] = "CIDADE/UF"

  const ruaNum = (partes[1] || '').trim();

  const ultimo = partes[partes.length - 1] || '';
  const matchCidade = ultimo.match(/^(.+?)\/([A-Z]{2})\s*$/);
  const cidade = matchCidade ? matchCidade[1].trim() : '';
  const uf    = matchCidade ? matchCidade[2] : '';

  // Incluir bairro(s) intermediários para melhorar precisão do geocoding
  const bairros = partes.slice(2, partes.length - 1).map(b => b.trim()).filter(Boolean);
  const bairro = bairros.join(', ');

  const partesCombinadas = [ruaNum, bairro, cidade, uf, 'Brasil'].filter(Boolean);
  return {
    address: partesCombinadas.join(', '),
    street: ruaNum,
    city: cidade,
    state: uf,
    district: bairro,
  };
}

// ─── Tabela de bandeiras por CNPJ Raiz ───────────────────────────────────────

// ATENÇÃO: Esta tabela é usada APENAS como placeholder visual temporário enquanto
// a Receita Federal ainda não respondeu. O nome real (nome_fantasia da Receita)
// SEMPRE sobrescreve este valor. Nunca confiar nesta tabela como fonte de verdade.
// Fonte autoritativa: publica.cnpj.ws — consultada em tempo real para cada PDV.
// Tabela de bandeiras REMOVIDA — identificação 100% via Receita Federal (CNPJ completo).
// Usar CNPJ raiz para identificar bandeira é incorreto: filiais de empresas diferentes
// podem compartilhar os mesmos primeiros 8 dígitos por coincidência de numeração.
// Exemplo real: CNPJ 61585865/2819-08 = Raia Drogasil, não Carrefour.

// Placeholder visual temporário — exibido APENAS enquanto a Receita Federal ainda não respondeu.
// NUNCA usar como valor final. aplicarReceita() sempre sobrescreve com dado real da Receita.
// Não identificamos por CNPJ raiz (8 dígitos) pois filiais de empresas diferentes podem
// compartilhar os mesmos primeiros 8 dígitos (ex: Raia Drogasil vs Carrefour).
function identificarBandeira(cnpjCol) {
  return 'Carregando...'; // Receita Federal vai resolver via CNPJ completo
}

// Aplica dados da Receita Federal a um row — ÚNICA fonte autoritativa de bandeira/nome.
// Sempre chamada com await no loop de geocoding. Nunca usar identificarBandeira como valor final.
function aplicarReceita(row, receita) {
  if (!receita) {
    // Receita falhou — marcar como não identificado (nunca deixar "Carregando...")
    if (row.bandeira === 'Carregando...') row.bandeira = 'Não identificado';
    return;
  }
  // Nome fantasia > razão social > CNPJ como último recurso — nunca retornar vazio
  const nomeReal = receita.nome_exibicao || receita.nome_fantasia || receita.razao_social || '';
  // Sempre sobrescrever — mesmo que nomeReal seja razão social (mais verdadeiro que placeholder)
  row.nome_fantasia = receita.nome_fantasia || '';
  row.razao_social  = receita.razao_social  || '';
  row.bandeira      = nomeReal || row.cnpj || 'Não identificado';
  if (receita.municipio)         row.cidade            = receita.municipio;
  if (receita.uf_receita)        row.uf                = receita.uf_receita;
  if (receita.cep)               row.cep               = receita.cep;
  if (receita.situacao)          row.situacao          = receita.situacao;
  if (receita.atividade)         row.atividade         = receita.atividade;
  if (receita.endereco_receita)  row.endereco_receita  = receita.endereco_receita;
}

// ─── Geocoding HERE (endereço → lat/lon) ─────────────────────────────────────

// Usa structured geocoding (qq=) quando cidade/UF disponíveis para forçar
// localidade correta. Fallback para freeform (q=) quando sem contexto.
// Valida UF retornada vs esperada; busca até 5 resultados para cross-check.
var _geoCache = {};
var _GEO_SCORE_MIN = 0.5; // threshold mínimo de queryScore

// Converte item da resposta HERE em objeto padronizado
function _hereItemToResult(item, address) {
  return {
    lat: item.position.lat,
    lon: item.position.lng,
    geo_address: item.address?.label || address || '',
    geo_score: item.scoring?.queryScore || 0,
    uf: item.address?.stateCode || '',
    municipio: item.address?.city || item.address?.district || '',
    cep: item.address?.postalCode || '',
  };
}

// Limpa ruído de endereços comerciais (shoppings, lojas, pisos) para melhorar geocoding
function _cleanCommercialAddress(addr) {
  if (!addr) return addr;
  var s = addr;
  // Remover nome de shopping antes do endereço real: "NomeShopping - Rua..."
  s = s.replace(/^[\w\sÀ-ÿ\.]+Shopping\s*-\s*/i, '');
  s = s.replace(/^Shopping\s+[\w\sÀ-ÿ]+\s*-\s*/i, '');
  // Remover "Loja XXX" e "Piso XXX"
  s = s.replace(/\s*-?\s*Loja\s+\d+[A-Za-z]?\s*-?\s*/gi, ' ');
  s = s.replace(/\s+Piso\s+(?:Térreo|Trreo|Terreo|L\d+|\d+[ºª°]?\s*(?:Piso)?)\s*/gi, ' ');
  s = s.replace(/\s+\d+[ºª°]\s*(?:Andar|Piso)\s*/gi, ' ');
  // Remover "R. Eng." solto (fragmento)
  s = s.replace(/\s+R\.\s+Eng\.\s*/g, ' ');
  // Remover "Gleba XXXX" (loteamento)
  s = s.replace(/\s+Gleba\s+\w+\s*/gi, ' ');
  // Remover "Ac." (acesso)
  s = s.replace(/\s+Ac\.\s+/g, ' ');
  // Remover "PAVMTO1" e similares
  s = s.replace(/\s+PAVMT?O?\d*\s*/gi, ' ');
  // Limpar hifens duplos e espaços
  s = s.replace(/\s*-\s*-\s*/g, ' - ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

// opts: { street, city, state, district } — campos structured (opcional)
// Se presentes, usa qq= (structured); senão, usa q= (freeform)
async function geocodeHERE(address, opts) {
  if (!address && !opts?.street) return null;

  // Cache key inclui contexto structured
  const cacheExtra = opts ? `|${opts.city||''}|${opts.state||''}` : '';
  const key = (address || '').toLowerCase().trim() + cacheExtra;
  if (_geoCache[key] !== undefined) return _geoCache[key];

  try {
    let url;
    const hasStructured = opts && (opts.city || opts.state);

    if (hasStructured) {
      // Structured geocoding — HERE respeita city/state como restrições
      const parts = [];
      if (opts.street)   parts.push('street=' + encodeURIComponent(opts.street));
      if (opts.district) parts.push('district=' + encodeURIComponent(opts.district));
      if (opts.city)     parts.push('city=' + encodeURIComponent(opts.city));
      if (opts.state)    parts.push('state=' + encodeURIComponent(opts.state));
      parts.push('country=Brasil');
      url = `/api/geocode?qq=${parts.join(';')}&limit=5&lang=pt-BR`;
    } else {
      // Freeform — sem contexto de cidade/UF
      url = `/api/geocode?q=${encodeURIComponent(address)}&in=countryCode:BRA&limit=5&lang=pt-BR`;
    }

    const resp = await fetch(url);
    if (!resp.ok) { _geoCache[key] = null; return null; }
    const d = await resp.json();
    if (!d.items?.length) { _geoCache[key] = null; return null; }

    const expectedUF = (opts?.state || '').toUpperCase();
    const expectedCity = (opts?.city || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Se temos UF esperada, tentar encontrar resultado que bata
    if (expectedUF) {
      // 1) Procurar match exato de UF + melhor score
      const ufMatches = d.items
        .filter(it => (it.address?.stateCode || '').toUpperCase() === expectedUF)
        .map(it => _hereItemToResult(it, address));

      if (ufMatches.length > 0) {
        // Se temos cidade, preferir match de cidade dentro dos que batem UF
        if (expectedCity) {
          const cityMatch = ufMatches.find(r => {
            const rCity = (r.municipio || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return rCity === expectedCity;
          });
          if (cityMatch && cityMatch.geo_score >= _GEO_SCORE_MIN) {
            _geoCache[key] = cityMatch;
            return cityMatch;
          }
        }
        // Pegar melhor score entre os que batem UF
        const best = ufMatches.reduce((a, b) => b.geo_score > a.geo_score ? b : a);
        if (best.geo_score >= _GEO_SCORE_MIN) {
          _geoCache[key] = best;
          return best;
        }
      }

      // 2) Nenhum resultado bateu UF ou score muito baixo — fallback freeform se era structured
      if (hasStructured && address) {
        const fallUrl = `/api/geocode?q=${encodeURIComponent(address)}&in=countryCode:BRA&limit=5&lang=pt-BR`;
        const fallResp = await fetch(fallUrl);
        if (fallResp.ok) {
          const fallD = await fallResp.json();
          if (fallD.items?.length) {
            const fallUF = fallD.items
              .filter(it => (it.address?.stateCode || '').toUpperCase() === expectedUF)
              .map(it => _hereItemToResult(it, address));
            if (fallUF.length > 0) {
              const best2 = fallUF.reduce((a, b) => b.geo_score > a.geo_score ? b : a);
              if (best2.geo_score >= _GEO_SCORE_MIN) {
                _geoCache[key] = best2;
                return best2;
              }
            }
          }
        }
      }
    }

    // 3) Sem UF esperada ou nenhum match — pegar primeiro resultado com score aceitável
    const first = _hereItemToResult(d.items[0], address);
    if (first.geo_score >= _GEO_SCORE_MIN) {
      // Marcar mismatch se UF esperada e não bateu
      if (expectedUF && first.uf.toUpperCase() !== expectedUF) {
        first._ufMismatch = true;
        first._expectedUF = expectedUF;
      }
      _geoCache[key] = first;
      return first;
    }

    // Score abaixo do threshold — tentar com endereço limpo (sem shopping/loja/piso)
    var cleanedAddr = _cleanCommercialAddress(address);
    if (cleanedAddr && cleanedAddr !== address) {
      var cleanUrl = `/api/geocode?q=${encodeURIComponent(cleanedAddr)}&in=countryCode:BRA&limit=5&lang=pt-BR`;
      var cleanResp = await fetch(cleanUrl);
      if (cleanResp.ok) {
        var cleanD = await cleanResp.json();
        if (cleanD.items?.length) {
          // Se temos UF esperada, filtrar por ela
          if (expectedUF) {
            var cleanUF = cleanD.items
              .filter(function(it) { return (it.address?.stateCode || '').toUpperCase() === expectedUF; })
              .map(function(it) { return _hereItemToResult(it, address); });
            if (cleanUF.length > 0) {
              var bestClean = cleanUF.reduce(function(a, b) { return b.geo_score > a.geo_score ? b : a; });
              if (bestClean.geo_score >= _GEO_SCORE_MIN) {
                _geoCache[key] = bestClean;
                return bestClean;
              }
            }
          }
          // Sem UF ou sem match: pegar primeiro com score ok
          var firstClean = _hereItemToResult(cleanD.items[0], address);
          if (firstClean.geo_score >= _GEO_SCORE_MIN) {
            if (expectedUF && firstClean.uf.toUpperCase() !== expectedUF) {
              firstClean._ufMismatch = true;
              firstClean._expectedUF = expectedUF;
            }
            _geoCache[key] = firstClean;
            return firstClean;
          }
        }
      }
    }

    // Último fallback: tentar só com CEP se disponível
    var cepMatch = (address || '').match(/(\d{5}-?\d{3})/);
    if (cepMatch) {
      var cepUrl = `/api/geocode?q=${encodeURIComponent(cepMatch[1] + ' Brasil')}&in=countryCode:BRA&limit=1&lang=pt-BR`;
      var cepResp = await fetch(cepUrl);
      if (cepResp.ok) {
        var cepD = await cepResp.json();
        if (cepD.items?.length) {
          var cepResult = _hereItemToResult(cepD.items[0], address);
          cepResult._cepFallback = true;
          _geoCache[key] = cepResult;
          return cepResult;
        }
      }
    }

    _geoCache[key] = null;
    return null;
  } catch(e) {
    _geoCache[key] = null;
    return null;
  }
}

// ─── API CNPJ.ws (Receita Federal) ─────────────────────────────────────────

function startGeocodingFromStep2() {
  const nameInput = document.getElementById('map-name-input');
  const name = (nameInput?.value || '').trim();
  const errEl = document.getElementById('step2-error');

  if (!name) {
    if (errEl) errEl.style.display = 'block';
    if (nameInput) nameInput.style.borderColor = 'var(--lose)';
    return;
  }
  if (errEl) errEl.style.display = 'none';

  // Guardar nome/descrição para salvar depois
  window._pendingMapName = name;
  window._pendingMapDesc = (document.getElementById('map-desc-input')?.value || '').trim();
  window._pendingMapType = currentMapType;

  // Capturar período (Varejo 360)
  const mes = document.getElementById('periodo-mes')?.value || '';
  const ano = document.getElementById('periodo-ano')?.value || '';
  window._pendingPeriodo = { mes: mes ? parseInt(mes) : null, ano: ano ? parseInt(ano) : null };
  const mesNomes = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  window._pendingPeriodo.label = mes && ano ? `${mesNomes[parseInt(mes)]} ${ano}` : ano || '';

  // Mostrar/esconder view toggle e botão CSV conforme tipo
  const vtBtns = document.getElementById('view-toggle-btns');
  if (vtBtns) vtBtns.style.display = currentMapType !== 'varejo360' ? 'flex' : 'none';

  // Roteamento por tipo
  if (currentMapType === 'reverse_geocoder') {
    startReverseGeocoding();
  } else {
    startGeocoding(); // geocoder e varejo360 usam o mesmo fluxo
  }
}

async function startGeocoding() {
  if (!currentUser) {
    // Guardar intenção de geocoding para retomar após login
    window._pendingGeocodingAfterLogin = true;
    document.getElementById('login-screen').style.display = '';
    return;
  }

  // Mostrar mapa IMEDIATAMENTE — pins aparecerão em tempo real
  document.getElementById('gallery-screen').classList.add('hidden');
  document.getElementById('upload-zone').classList.add('hidden');
  // Limpar dados ANTES de mostrar o mapa — evita flash dos dados anteriores
  allData = []; filteredData = [];
  if (map && map.getSource('pdvs')) {
    map.getSource('pdvs').setData({ type: 'FeatureCollection', features: [] });
  }

  const appEl = document.getElementById('app');
  appEl.style.display = 'flex';
  applyMapMode(currentMapType);
  await new Promise(r => setTimeout(r, 50));
  if (!map) initMap();
  await new Promise(r => setTimeout(r, 100));
  if (map) map.resize();

  // Mostrar barra flutuante discreta
  document.getElementById('geo-title-text').textContent = 'Buscando Receita + Geocodificando';
  document.getElementById('geocoding-overlay').classList.add('active');

  // Centralizar mapa no Brasil enquanto carrega
  map.jumpTo({ center: [-47.93, -15.78], zoom: 4 });

  // Limpar cache de geocoding para nova sessão
  Object.keys(_geoCache).forEach(k => delete _geoCache[k]);
  geocodingCancelled = false;
  geocodingActive = true;

  // Avisar se tentar FECHAR a aba durante geocoding (trocar de aba é ok — continua em background)
  window._unloadHandler = (e) => {
    if (geocodingActive) {
      e.preventDefault();
      return e.returnValue = 'O geocoding ainda está em andamento. Se fechar, perderá o progresso.';
    }
  };
  window.addEventListener('beforeunload', window._unloadHandler);

  // Geocoding continua em background quando usuário troca de aba — não cancelar
  // Quando voltar, overlay reaparece automaticamente pois geocodingActive ainda é true
  window._visibilityHandler = () => {
    if (document.hidden || !geocodingActive) return;
    // Voltou para a aba com geocoding ativo — garantir que overlay está visível
    document.getElementById('geocoding-overlay')?.classList.add('active');
    if (map) map.resize();
  };
  document.addEventListener('visibilitychange', window._visibilityHandler);

  const total = rawCSVData.length;
  let ok = 0, fail = 0;
  const startTime = Date.now();

  // Geocoding rápido — Receita Federal buscada em background sem bloquear
  // HERE free: 250k req/mês — batch 8 concurrent com 80ms delay (~100 req/s)
  const BATCH = 8;
  const DELAY = 80;

  allData = [];

  for (let i = 0; i < rawCSVData.length; i += BATCH) {
    if (geocodingCancelled) break;

    const batch = rawCSVData.slice(i, Math.min(i + BATCH, rawCSVData.length));

    await Promise.all(batch.map(async (row) => {
      if (!row.bandeira || row.bandeira === 'Desconhecido') row.bandeira = 'Carregando...';

      // Extrair cidade/UF do campo cnpj como fallback (formato HYPR)
      const partes = (row.cnpj || '').split(' - ');
      const ultimo = partes[partes.length - 1] || '';
      const mUF = ultimo.match(/^(.+?)\/([A-Z]{2})\s*$/);
      row.cidade = mUF ? mUF[1].trim() : '';
      row.uf = mUF ? mUF[2] : '';

      // Endereço para geocoding — adaptar conforme formato detectado
      // geoOpts: campos structured para forçar localidade (city/state)
      let address, geoOpts = null;
      if (row._endereco_livre) {
        // Formato endereço livre — extrair campos structured das colunas originais
        address = row._endereco_livre;
        // Tentar extrair cidade/UF dos campos originais do CSV
        const csvCity  = row[Object.keys(row).find(k => /^(cidade|city|municipio)$/i.test(k))] || '';
        const csvState = row[Object.keys(row).find(k => /^(uf|estado|state)$/i.test(k))] || '';
        const csvBairro = row[Object.keys(row).find(k => /^(bairro|neighborhood)$/i.test(k))] || '';
        const csvEnd   = row[Object.keys(row).find(k => /^(endereco|endereço|address|logradouro|rua)$/i.test(k))] || '';
        if (csvCity || csvState) {
          geoOpts = { street: csvEnd, city: csvCity, state: csvState, district: csvBairro };
        }
      } else if (window._formatoCSV === 'cnpj_raiz' || window._formatoCSV === 'cnpj_puro') {
        // CNPJ raiz (8 dígitos) ou puro (14 dígitos) — AGUARDAR Receita Federal para obter endereço
        const receita = await buscarReceita(row.cnpj || '');
        aplicarReceita(row, receita);
        address = receita?.endereco_receita || null;
        // Campos structured da Receita Federal
        if (receita && (receita.municipio || receita.uf_receita)) {
          geoOpts = {
            street: [receita.logradouro, receita.numero].filter(Boolean).join(' '),
            city: receita.municipio || '',
            state: receita.uf_receita || '',
            district: receita.bairro || '',
          };
        }
      } else {
        // Formato HYPR — extrair do campo cnpj (agora retorna objeto structured)
        const parsed = extrairEndereco(row.cnpj || '');
        address = parsed.address;
        if (parsed.city || parsed.state) {
          geoOpts = { street: parsed.street, city: parsed.city, state: parsed.state, district: parsed.district };
        }
        // Nome será enriquecido na Fase 2 (após geocoding completo)
      }
      row.endereco_geocode = address;

      try {
        const geo = await geocodeHERE(address, geoOpts);
        if (geo) {
          row.lat = geo.lat;
          row.lon = geo.lon;
          row.geo_address = geo.geo_address;
          row.geo_score = geo.geo_score;
          // Marcar mismatch de UF para visibilidade na lista
          if (geo._ufMismatch) {
            row._ufMismatch = true;
            row._expectedUF = geo._expectedUF;
          }
          // Extrair UF, município e CEP da resposta HERE (se não vieram da Receita)
          if (!row.uf && geo.uf)         row.uf       = geo.uf;
          if (!row.cidade && geo.municipio) row.cidade = geo.municipio;
          if (!row.cep && geo.cep)       row.cep      = geo.cep;
          ok++;

          // Plot pin em tempo real — usuário já pode interagir
          allData.push(row);

          // Atualizar mapa a cada 50 novos pins (batch GeoJSON update é mais eficiente)
          if (allData.length % 100 === 0) {
            filteredData = [...allData];
            renderMarkers();
            updatePanels();
          }
        } else {
          fail++;
          row._geocodeFailed = true;
          row.geo_address = '';
          allData.push(row);
        }
      } catch (e) {
        fail++;
        row._geocodeFailed = true;
        row.geo_address = '';
        allData.push(row);
      }
    }));

    // Atualizar barra flutuante
    const done = Math.min(i + BATCH, total);
    const pct = Math.round(done / total * 100);
    document.getElementById('geo-fill').style.width = pct + '%';
    document.getElementById('geo-pct').textContent = pct + '%';
    const cacheHits = Object.keys(_geoCache).length;
    document.getElementById('geo-ok').textContent = ok.toLocaleString('pt-BR') + ' ✓';
    document.getElementById('geo-fail').textContent = fail > 0 ? fail.toLocaleString('pt-BR') + ' ✗' : '';
    document.getElementById('geo-current').textContent = extrairEndereco(batch[0]?.cnpj || '').address;

    // ETA
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = done / elapsed;
    const remaining = (total - done) / rate;
    if (remaining > 0 && isFinite(remaining)) {
      const min = Math.floor(remaining / 60);
      const sec = Math.round(remaining % 60);
      document.getElementById('geo-eta').textContent = min > 0 ? `~${min}m ${sec}s` : `~${sec}s`;
    }

    await new Promise(r => setTimeout(r, DELAY));
  }

  geocodingActive = false;
  window.removeEventListener('beforeunload', window._unloadHandler);
  document.removeEventListener('visibilitychange', window._visibilityHandler);

  filteredData = [...allData];
  document.getElementById('geocoding-overlay').classList.remove('active');

  if (allData.length === 0) {
    document.getElementById('upload-zone').classList.remove('hidden');
    goToStep(2);
    return;
  }

  // Fit map (only items with valid coordinates)
  const validPts = allData.filter(r => parseFloat(r.lat) && parseFloat(r.lon));
  if (validPts.length > 0) {
    const bounds = validPts.reduce((b, r) => b.extend([parseFloat(r.lon), parseFloat(r.lat)]), new maplibregl.LngLatBounds([parseFloat(validPts[0].lon), parseFloat(validPts[0].lat)], [parseFloat(validPts[0].lon), parseFloat(validPts[0].lat)]));
    map.fitBounds(bounds, { padding: 40, animate: true });
  }

  filteredData = [...allData];
  // Renderizar pins no mapa
  if (map.isStyleLoaded() && map.getSource('pdvs')) {
    renderMarkers();
  } else {
    map.once('styledata', () => renderMarkers());
  }

  populateFilters();
  updatePanels();
  updateOverlay();

  // Toast pós-geocoding com resumo e CTA de salvar
  var mismatchCount = allData.filter(r => r._ufMismatch).length;
  showGeoToast(ok, fail, mismatchCount, total);

  // ─── FASE 2: Enriquecimento de nomes via BrasilAPI ──────────────────────

  var needsEnrich = allData.filter(r => r.cnpj && (!r.bandeira || r.bandeira === 'Carregando...' || r.bandeira === 'Não identificado' || r.bandeira === 'Desconhecido'));
  if (needsEnrich.length > 0) {
    var overlay2 = document.getElementById('geocoding-overlay');
    document.getElementById('geo-title-text').textContent = 'Enriquecendo nomes';
    document.getElementById('geo-fill').style.width = '0%';
    document.getElementById('geo-pct').textContent = '0%';
    document.getElementById('geo-ok').textContent = '';
    document.getElementById('geo-fail').textContent = '';
    document.getElementById('geo-eta').textContent = '';
    document.getElementById('geo-current').textContent = needsEnrich.length + ' CNPJs para enriquecer...';
    overlay2.classList.add('active');
    
    // ── Helper: enrich a single row ──
    async function enrichRow(row) {
      var cnpjNum = (row.cnpj || '').split(' - ')[0].replace(/\D/g, '').slice(0, 14);
      if (!cnpjNum || cnpjNum.length < 14) return false;
      
      // Check cache first
      if (_receitaCache[cnpjNum] !== undefined) {
        aplicarReceita(row, _receitaCache[cnpjNum]);
        return !!_receitaCache[cnpjNum];
      }
      
      // Try OpenCNPJ → BrasilAPI → cnpj.ws
      var apis = [
        'https://api.opencnpj.org/' + cnpjNum,
        'https://brasilapi.com.br/api/cnpj/v1/' + cnpjNum,
        'https://publica.cnpj.ws/cnpj/' + cnpjNum
      ];
      for (var ai = 0; ai < apis.length; ai++) {
        try {
          var _ac = new AbortController();
          var _tid = setTimeout(function() { _ac.abort(); }, ai === 0 ? 4000 : 6000);
          var resp = await fetch(apis[ai], { signal: _ac.signal, headers: { 'Accept': 'application/json' } });
          clearTimeout(_tid);
          if (resp.ok) {
            var d = await resp.json();
            var nome, razao, mun, ufR, cepR, sit, ativ;
            if (ai === 2) {
              var est = d.estabelecimento || {};
              nome = (est.nome_fantasia || '').trim();
              razao = (d.razao_social || '').trim();
              mun = est.cidade?.nome || ''; ufR = est.estado?.sigla || '';
            } else {
              nome = (d.nome_fantasia || '').trim();
              razao = (d.razao_social || '').trim();
              mun = (d.municipio || '').trim();
              ufR = (d.uf || '').trim();
              cepR = (d.cep || '').replace(/\D/g, '');
              sit = d.situacao_cadastral || d.descricao_situacao_cadastral || '';
              ativ = d.cnae_fiscal_descricao || '';
            }
            var result = { nome_fantasia: nome, razao_social: razao, nome_exibicao: nome || razao, municipio: mun, uf_receita: ufR, cep: cepR || '', situacao: sit || '', atividade: ativ || '' };
            _receitaCache[cnpjNum] = result;
            aplicarReceita(row, result);
            return true;
          } else if (resp.status === 429) {
            // Rate limited — wait briefly then try next API
            await new Promise(r => setTimeout(r, 500));
            continue;
          }
        } catch(e) {
          continue;
        }
      }
      return false;
    }
    
    // ── Helper: update overlay UI ──
    function updateEnrichUI(enrichOk, enrichFail, enrichDone, total, startTime, phase) {
      var ePct = Math.round(enrichDone / total * 100);
      document.getElementById('geo-fill').style.width = ePct + '%';
      document.getElementById('geo-pct').textContent = ePct + '%';
      document.getElementById('geo-ok').textContent = enrichOk + ' nomes';
      document.getElementById('geo-fail').textContent = enrichFail > 0 ? enrichFail + ' ✗' : '';
      var eElapsed = (Date.now() - startTime) / 1000;
      var eRate = enrichDone / eElapsed;
      var eRemaining = (total - enrichDone) / eRate;
      if (eRemaining > 0 && isFinite(eRemaining)) {
        document.getElementById('geo-eta').textContent = eRemaining > 60 ? '~' + Math.ceil(eRemaining/60) + 'min' : '~' + Math.round(eRemaining) + 's';
      }
      var label = phase === 2 ? ' (retry)' : '';
      document.getElementById('geo-current').textContent = enrichOk + ' identificados · ' + enrichDone + '/' + total + label;
    }
    
    // ── PASS 1: batch 10, delay 200ms ──
    var enrichOk = 0, enrichFail = 0, enrichDone = 0;
    var ENRICH_BATCH = 10;
    var ENRICH_DELAY = 200;
    var enrichStart = Date.now();
    
    for (var ei = 0; ei < needsEnrich.length; ei += ENRICH_BATCH) {
      if (geocodingCancelled) break;
      var eBatch = needsEnrich.slice(ei, ei + ENRICH_BATCH);
      
      await Promise.all(eBatch.map(async function(row) {
        var ok = await enrichRow(row);
        if (ok) { enrichOk++; } else { enrichFail++; row.bandeira = 'Não identificado'; }
      }));
      
      enrichDone = Math.min(ei + ENRICH_BATCH, needsEnrich.length);
      updateEnrichUI(enrichOk, enrichFail, enrichDone, needsEnrich.length, enrichStart, 1);
      
      if (enrichDone % 100 === 0 || enrichDone >= needsEnrich.length) {
        filteredData = [...allData];
        populateFilters();
        applyFilters();
        updatePanels();
      }
      
      await new Promise(r => setTimeout(r, ENRICH_DELAY));
    }
    
    // ── PASS 2 (retry): re-attempt failed ones with batch 3, delay 400ms ──
    var retryList = needsEnrich.filter(r => r.bandeira === 'Não identificado' || r.bandeira === 'Carregando...');
    if (retryList.length > 0 && !geocodingCancelled) {
      // Clear cache for failed CNPJs so they get a fresh attempt
      retryList.forEach(function(row) {
        var cnpjNum = (row.cnpj || '').split(' - ')[0].replace(/\D/g, '').slice(0, 14);
        if (cnpjNum && _receitaCache[cnpjNum] === null) delete _receitaCache[cnpjNum];
      });
      
      document.getElementById('geo-title-text').textContent = 'Retry — recuperando nomes';
      document.getElementById('geo-fill').style.width = '0%';
      document.getElementById('geo-pct').textContent = '0%';
      document.getElementById('geo-eta').textContent = '';
      
      var RETRY_BATCH = 3;
      var RETRY_DELAY = 400;
      var retryOk = 0, retryDone = 0;
      var retryStart = Date.now();
      
      for (var ri = 0; ri < retryList.length; ri += RETRY_BATCH) {
        if (geocodingCancelled) break;
        var rBatch = retryList.slice(ri, ri + RETRY_BATCH);
        
        await Promise.all(rBatch.map(async function(row) {
          var ok = await enrichRow(row);
          if (ok) {
            retryOk++;
            enrichOk++;
            enrichFail--;
          }
        }));
        
        retryDone = Math.min(ri + RETRY_BATCH, retryList.length);
        updateEnrichUI(enrichOk, enrichFail, retryDone, retryList.length, retryStart, 2);
        
        await new Promise(r => setTimeout(r, RETRY_DELAY));
      }
      
      // Mark remaining failures definitively
      retryList.forEach(function(row) {
        if (row.bandeira === 'Carregando...' || !row.bandeira) row.bandeira = 'Não identificado';
      });
    }
    
    // Final render
    filteredData = [...allData];
    populateFilters();
    applyFilters();
    updatePanels();
    renderMarkers();
  }
  
  document.getElementById('geocoding-overlay').classList.remove('active');
  showSaveMapDialog();
}

async function startReverseGeocoding() {
  if (!rawCSVData.length) return;

  // Limpar dados ANTES de mostrar o mapa — evita flash dos dados anteriores
  allData = []; filteredData = [];
  if (map && map.getSource('pdvs')) {
    map.getSource('pdvs').setData({ type: 'FeatureCollection', features: [] });
  }

  document.getElementById('gallery-screen').classList.add('hidden');
  document.getElementById('upload-zone').classList.add('hidden');
  const appEl2 = document.getElementById('app');
  appEl2.style.display = 'flex';
  applyMapMode('reverse_geocoder');
  await new Promise(r => setTimeout(r, 50));
  if (!map) initMap();
  await new Promise(r => setTimeout(r, 100));
  if (map) map.resize();
  geocodingCancelled = false; geocodingActive = true;
  window.addEventListener('beforeunload', window._unloadHandler);

  const overlay = document.getElementById('geocoding-overlay');
  overlay.classList.add('active');
  document.getElementById('geo-current').textContent = 'Iniciando reverse geocoding...';
  document.getElementById('geo-fill').style.width = '0%';

  const total = rawCSVData.length;
  const BATCH = 5; const DELAY = 150;
  let ok = 0, fail = 0;

  for (let i = 0; i < total; i += BATCH) {
    if (geocodingCancelled) break;
    const batch = rawCSVData.slice(i, Math.min(i + BATCH, total));

    await Promise.all(batch.map(async row => {
      const lat = parseFloat(row.lat || row.latitude || row.lat_input || row.input_lat);
      const lon = parseFloat(row.lon || row.longitude || row.lng || row.input_lon);
      if (!lat || !lon) {
        fail++;
        row._geocodeFailed = true;
        row.geo_address = '';
        row.nome = row.nome || row.name || row.label || `Ponto ${i + 1}`;
        row.bandeira = row.nome;
        allData.push(row);
        return;
      }

      row.input_lat = lat; row.input_lon = lon;
      row.lat = lat; row.lon = lon;
      row.nome = row.nome || row.name || row.label || `Ponto ${allData.length + 1}`;
      row.bandeira = row.nome;

      try {
        const geo = await reverseGeocodeHERE(lat, lon);
        if (geo) {
          row.geo_address = geo.geo_address;
          row.uf = geo.uf;
          row.cep = geo.cep;
          ok++;
        } else { fail++; row._geocodeFailed = true; row.geo_address = ''; }
      } catch { fail++; row._geocodeFailed = true; row.geo_address = ''; }

      allData.push(row);
    }));

    const done = Math.min(i + BATCH, total);
    const pct = Math.round(done / total * 100);
    document.getElementById('geo-fill').style.width = pct + '%';
    document.getElementById('geo-pct').textContent = pct + '%';
    document.getElementById('geo-ok').textContent = ok + ' ✓';
    document.getElementById('geo-fail').textContent = fail > 0 ? fail + ' ✗' : '';
    document.getElementById('geo-current').textContent = `${done.toLocaleString('pt-BR')} / ${total.toLocaleString('pt-BR')} pontos`;

    if (done % 100 === 0) {
      filteredData = [...allData];
      renderMarkers();
    }
    await new Promise(r => setTimeout(r, DELAY));
  }

  overlay.classList.remove('active');
  geocodingActive = false;
  window.removeEventListener('beforeunload', window._unloadHandler);
  document.removeEventListener('visibilitychange', window._visibilityHandler);
  filteredData = [...allData];
  renderMarkers();
  updatePanels(); updateOverlay();

  // Mostrar lista automaticamente no reverse geocoder
  setMapView('list');

  // Salvar
  showSaveMapDialog();
}

function cancelGeocoding() {
  // Places Discovery cancel
  if (currentMapType === 'places_discovery') {
    _placesDiscoveryCancelled = true;
    geocodingActive = false;
    window.removeEventListener('beforeunload', window._unloadHandler);
    document.getElementById('geocoding-overlay').classList.remove('active');
    if (allData.length > 0) {
      filteredData = [...allData];
      renderMarkers();
      const pts = allData.filter(r => r.lat && r.lon);
      if (pts.length) {
        const bounds = pts.reduce((b, r) => b.extend([parseFloat(r.lon), parseFloat(r.lat)]),
          new maplibregl.LngLatBounds([parseFloat(pts[0].lon), parseFloat(pts[0].lat)], [parseFloat(pts[0].lon), parseFloat(pts[0].lat)]));
        map.fitBounds(bounds, { padding: 40, animate: true });
      }
    }
    // Always re-show panel on cancel so user can adjust
    document.getElementById('places-panel').style.display = 'block';
    if (_placesMode === 'pin') enablePinMode();
    return;
  }
  // Original cancel logic
  geocodingCancelled = true;
  geocodingActive = false;
  window.removeEventListener('beforeunload', window._unloadHandler);
  document.removeEventListener('visibilitychange', window._visibilityHandler);
  document.getElementById('geocoding-overlay').classList.remove('active');

  if (allData.length > 0) {
    filteredData = [...allData];
    const validCancel = allData.filter(r => parseFloat(r.lat) && parseFloat(r.lon));
    if (validCancel.length > 0) {
      const bounds = validCancel.reduce((b, r) => b.extend([parseFloat(r.lon), parseFloat(r.lat)]), new maplibregl.LngLatBounds([parseFloat(validCancel[0].lon), parseFloat(validCancel[0].lat)], [parseFloat(validCancel[0].lon), parseFloat(validCancel[0].lat)]));
      map.fitBounds(bounds, { padding: 40, animate: true });
    }
    populateFilters();
    updatePanels();
    updateOverlay();
  } else {
    document.getElementById('upload-zone').classList.remove('hidden');
    goToStep(1);
  }
}

// ─── Toast pós-geocoding ────────────────────────────────────────────────────

var _geoToastTimer = null;

function showGeoToast(okCount, failCount, mismatchCount, total) {
  var toast = document.getElementById('geo-toast');
  var title = document.getElementById('geo-toast-title');
  var stats = document.getElementById('geo-toast-stats');
  if (!toast) return;

  // Montar título
  var cancelled = geocodingCancelled;
  title.textContent = cancelled ? 'Geocodificação cancelada' : 'Geocodificação concluída';

  // Montar stats
  var parts = [];
  parts.push('<span class="t-ok">' + okCount.toLocaleString('pt-BR') + ' encontrados</span>');
  if (failCount > 0) parts.push('<span class="t-fail">' + failCount.toLocaleString('pt-BR') + ' não identificados</span>');
  if (mismatchCount > 0) parts.push('<span class="t-warn">' + mismatchCount.toLocaleString('pt-BR') + ' UF divergente</span>');
  parts.push(total.toLocaleString('pt-BR') + ' total');
  stats.innerHTML = parts.join(' · ');

  toast.classList.remove('hiding');
  toast.classList.add('active');

  // Auto-dismiss após 15s
  clearTimeout(_geoToastTimer);
  _geoToastTimer = setTimeout(dismissGeoToast, 15000);
}

function dismissGeoToast() {
  var toast = document.getElementById('geo-toast');
  if (!toast || !toast.classList.contains('active')) return;
  clearTimeout(_geoToastTimer);
  toast.classList.add('hiding');
  setTimeout(function() {
    toast.classList.remove('active', 'hiding');
  }, 200);
}

function openSaveModalFromToast() {
  dismissGeoToast();
  // Abrir o modal de salvar — preencher nome se já existe do step2
  var saveModal = document.getElementById('save-modal');
  if (saveModal) {
    saveModal.style.display = 'flex';
    var nameInput = document.getElementById('save-name');
    var pendingName = window._pendingMapName || document.getElementById('map-name-input')?.value || '';
    if (nameInput && !nameInput.value && pendingName) nameInput.value = pendingName;
    var descInput = document.getElementById('save-desc');
    var pendingDesc = window._pendingMapDesc || document.getElementById('map-desc-input')?.value || '';
    if (descInput && !descInput.value && pendingDesc) descInput.value = pendingDesc;
    nameInput?.focus();
  }
}

// ─── File Upload ─────────────────────────────────────────────────────────────


// ─── window.* exports ──────────────────────────────────────────────────
window._cleanCommercialAddress = _cleanCommercialAddress;
window._hereItemToResult = _hereItemToResult;
window.aplicarReceita = aplicarReceita;
window.cancelGeocoding = cancelGeocoding;
window.dismissGeoToast = dismissGeoToast;
window.doGoogleLogin = doGoogleLogin;
window.downloadGeocoderCSV = downloadGeocoderCSV;
window.enrichRow = enrichRow;
window.extrairEndereco = extrairEndereco;
window.geocodeHERE = geocodeHERE;
window.goToStep = goToStep;
window.handleLoggedIn = handleLoggedIn;
window.identificarBandeira = identificarBandeira;
window.initAuth = initAuth;
window.openSaveModalFromToast = openSaveModalFromToast;
window.reverseGeocodeHERE = reverseGeocodeHERE;
window.showGeoToast = showGeoToast;
window.startGeocoding = startGeocoding;
window.startGeocodingFromStep2 = startGeocodingFromStep2;
window.startReverseGeocoding = startReverseGeocoding;
window.updateEnrichUI = updateEnrichUI;
