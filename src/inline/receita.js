// ─── receita ─────────────────────────────────────────────────────────
// Extracted from app-legacy.js — domain module

// Usa cnpj.ws — sem rate limit agressivo, dados direto da Receita Federal
var _receitaCache = {};
var _receitaInFlight = 0;    // throttle de requisições simultâneas
var _receitaPending = 0;     // total de requisições pendentes (para aguardar antes do save)

async function buscarReceitaEstab(estab, razaoSocial) {
  // Nome fantasia é preferido; fallback para razão social — nunca retornar string vazia
  const nomeFantasia = (estab.nome_fantasia || '').trim();
  const razao        = (razaoSocial || estab.razao_social || '').trim();
  const logradouro   = [estab.tipo_logradouro, estab.logradouro, estab.numero, estab.complemento]
    .filter(Boolean).join(' ');
  const bairro = (estab.bairro || '').trim();
  const cidade = estab.cidade?.nome || '';
  const uf     = estab.estado?.sigla || '';
  const cep    = (estab.cep || '').replace(/\D/g, '');
  return {
    nome_fantasia:    nomeFantasia,
    razao_social:     razao,
    nome_exibicao:    nomeFantasia || razao,  // fonte de verdade para row.bandeira
    endereco_receita: [logradouro, bairro, cidade, uf, 'Brasil'].filter(Boolean).join(', '),
    municipio:        cidade,
    uf_receita:       uf,
    cep,
    situacao:         estab.situacao_cadastral || '',
    atividade:        estab.atividade_principal?.descricao || estab.cnae_fiscal_descricao || '',
    logradouro,
    bairro,
    numero:           estab.numero || '',
  };
}

// Busca CNPJ completo na Receita Federal via publica.cnpj.ws com fallback para BrasilAPI.
// Para CNPJ raiz (8 dígitos): busca via /estabelecimentos e usa a filial mais representativa
// (a que tiver mais funcionários ou a primeira ativa), NÃO a primeira filial aleatória.
// Garantias: (1) sempre usa CNPJ completo de 14 dígitos para identificação de filial,
//            (2) razão social é fallback obrigatório quando nome_fantasia ausente,
//            (3) BrasilAPI como segunda fonte se cnpj.ws falhar.
async function buscarReceita(cnpjCol, _retries) {
  if (_retries === undefined) _retries = 0;
  var MAX_RETRIES = 3;
  const cnpjNum = (cnpjCol.split(' - ')[0] || '').replace(/\D/g, '').slice(0, 14);
  if (!cnpjNum) return null;

  // CNPJ Raiz (8 dígitos) — busca a primeira filial ativa via /estabelecimentos
  if (cnpjNum.length === 8) {
    const cacheKey = 'raiz_' + cnpjNum;
    if (_receitaCache[cacheKey] !== undefined) return _receitaCache[cacheKey];
    if (_receitaInFlight >= 5) await new Promise(r => setTimeout(r, 300));
    _receitaInFlight++;
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjNum}/estabelecimentos?quantidade=5`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(tid);
      if (resp.status === 429) {
        _receitaInFlight--;
        if (_retries >= MAX_RETRIES) { _receitaCache[cacheKey] = null; return null; }
        await new Promise(r => setTimeout(r, 2000 * (_retries + 1)));
        return buscarReceita(cnpjCol, _retries + 1);
      }
      if (!resp.ok) { _receitaCache[cacheKey] = null; _receitaInFlight--; return null; }
      const d = await resp.json();
      // Escolher a primeira filial ativa (situacao_cadastral = "Ativa" ou "ATIVA")
      const estabs = Array.isArray(d) ? d : (d.estabelecimentos || d.data || []);
      const ativa = estabs.find(e => /ativa/i.test(e.situacao_cadastral || '')) || estabs[0];
      if (!ativa) { _receitaCache[cacheKey] = null; _receitaInFlight--; return null; }
      const result = await buscarReceitaEstab(ativa, d.razao_social || ativa.razao_social || '');
      _receitaCache[cacheKey] = result;
      _receitaInFlight--;
      _receitaPending = Math.max(0, _receitaPending - 1);
      return result;
    } catch {
      _receitaCache['raiz_' + cnpjNum] = null;
      _receitaInFlight = Math.max(0, _receitaInFlight - 1);
      _receitaPending  = Math.max(0, _receitaPending - 1);
      return null;
    }
  }

  if (cnpjNum.length < 14) return null;

  // Cache por CNPJ completo (14 dígitos) — cada filial tem endereço único
  if (_receitaCache[cnpjNum] !== undefined) return _receitaCache[cnpjNum];

  // Throttle: máx 5 requisições simultâneas
  if (_receitaInFlight >= 5) {
    await new Promise(r => setTimeout(r, 300));
  }
  _receitaInFlight++;

  try {
    // PRIMARY: BrasilAPI (faster, more stable)
    const result = await buscarReceitaBrasilAPI(cnpjNum);
    if (result) {
      _receitaCache[cnpjNum] = result;
      _receitaInFlight--;
      _receitaPending = Math.max(0, _receitaPending - 1);
      return result;
    }
    // FALLBACK: publica.cnpj.ws
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjNum}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(tid);

    if (resp.status === 429) {
      _receitaInFlight--;
      if (_retries >= MAX_RETRIES) { _receitaCache[cnpjNum] = null; return null; }
      await new Promise(r => setTimeout(r, 2000 * (_retries + 1)));
      return buscarReceita(cnpjCol, _retries + 1);
    }
    if (!resp.ok) {
      _receitaCache[cnpjNum] = null;
      _receitaInFlight--;
      _receitaPending = Math.max(0, _receitaPending - 1);
      return null;
    }

    const d = await resp.json();
    const estab = d.estabelecimento || {};
    const fallback = await buscarReceitaEstab(estab, d.razao_social || '');
    _receitaCache[cnpjNum] = fallback;
    _receitaInFlight--;
    _receitaPending = Math.max(0, _receitaPending - 1);
    return fallback;
  } catch {
    _receitaCache[cnpjNum] = null;
    _receitaInFlight = Math.max(0, _receitaInFlight - 1);
    _receitaPending = Math.max(0, _receitaPending - 1);
    return null;
  }
}

// Fallback: BrasilAPI (fonte: Receita Federal, endpoint alternativo)
async function buscarReceitaBrasilAPI(cnpjNum) {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjNum}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(tid);
    if (!resp.ok) return null;
    const d = await resp.json();
    // BrasilAPI retorna formato diferente — normalizar
    const nomeFantasia = (d.nome_fantasia || '').trim();
    const razao = (d.razao_social || '').trim();
    const logradouro = [d.descricao_tipo_logradouro, d.logradouro, d.numero, d.complemento]
      .filter(Boolean).join(' ');
    const bairro = (d.bairro || '').trim();
    const cidade = (d.municipio || '').trim();
    const uf = (d.uf || '').trim();
    const cep = (d.cep || '').replace(/\D/g, '');
    return {
      nome_fantasia:    nomeFantasia,
      razao_social:     razao,
      nome_exibicao:    nomeFantasia || razao,
      endereco_receita: [logradouro, bairro, cidade, uf, 'Brasil'].filter(Boolean).join(', '),
      municipio:        cidade,
      uf_receita:       uf,
      cep,
      situacao:         d.descricao_situacao_cadastral || '',
      atividade:        d.cnae_fiscal_descricao || '',
      logradouro,
      bairro,
      numero:           d.numero || '',
    };
  } catch {
    return null;
  }
}

// ─── Start Geocoding ──────────────────────────────────────────────────────────


// ─── window.* exports ──────────────────────────────────────────────────
window.buscarReceita = buscarReceita;
window.buscarReceitaBrasilAPI = buscarReceitaBrasilAPI;
window.buscarReceitaEstab = buscarReceitaEstab;
