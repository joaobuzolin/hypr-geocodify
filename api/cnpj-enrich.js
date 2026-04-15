// Vercel Serverless Function — Batch CNPJ enrichment proxy
// Receives up to 30 CNPJs, queries BrasilAPI + fallback in parallel server-side.
// Server-side requests have much higher rate limits than browser requests.
// Also reads/writes Supabase cnpj_cache for instant lookups.

const SUPABASE_URL  = process.env.SUPABASE_URL || 'https://qfyqvcxhcmduhknbpofx.supabase.co';
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmeXF2Y3hoY21kdWhrbmJwb2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Mjk1NjAsImV4cCI6MjA4OTAwNTU2MH0.k92V1LN4OqqdtfF86iml4L-gVg0AabENKt7S5vlP2dk';

const ALLOWED_ORIGINS = [
  'https://geocodify.hypr.mobi',
  'https://hypr-geocodify.vercel.app',
];

function getCorsOrigin(req) {
  const origin = req.headers?.origin || '';
  if (ALLOWED_ORIGINS.some(o => origin === o)) return origin;
  if (/^https:\/\/hypr-geocodify[a-z0-9-]*\.vercel\.app$/.test(origin)) return origin;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

export default async function handler(req, res) {
  const corsOrigin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { cnpjs } = body;
  if (!cnpjs || !Array.isArray(cnpjs) || cnpjs.length === 0) {
    return res.status(400).json({ error: 'cnpjs array required' });
  }

  // Limit batch size
  const batch = cnpjs.slice(0, 30).map(c => c.replace(/\D/g, '').slice(0, 14)).filter(c => c.length >= 8);
  if (batch.length === 0) return res.json({ results: {} });

  // Step 1: Check Supabase cache
  const results = {};
  let uncached = [...batch];

  if (SUPABASE_KEY) {
    try {
      const cacheUrl = `${SUPABASE_URL}/rest/v1/cnpj_cache?cnpj=in.(${batch.map(encodeURIComponent).join(',')})&select=*`;
      const cacheResp = await fetch(cacheUrl, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      });
      if (cacheResp.ok) {
        const cached = await cacheResp.json();
        const NINETY_DAYS = 90 * 86400 * 1000;
        for (const c of cached) {
          if (c.updated_at && (Date.now() - new Date(c.updated_at).getTime()) > NINETY_DAYS) continue;
          if (c.nome_exibicao || c.nome_fantasia || c.razao_social) {
            results[c.cnpj] = c;
            uncached = uncached.filter(x => x !== c.cnpj);
          }
        }
      }
    } catch {}
  }

  // Step 2: Fetch uncached from APIs — parallel, 3s timeout
  if (uncached.length > 0) {
    const lookups = uncached.map(cnpj => lookupCNPJ(cnpj));
    const settled = await Promise.allSettled(lookups);
    const newEntries = [];

    for (let i = 0; i < uncached.length; i++) {
      const cnpj = uncached[i];
      if (settled[i].status === 'fulfilled' && settled[i].value) {
        results[cnpj] = settled[i].value;
        newEntries.push({ cnpj, ...settled[i].value });
      }
    }

    // Step 3: Save to cache (fire-and-forget)
    if (newEntries.length > 0 && SUPABASE_KEY) {
      fetch(`${SUPABASE_URL}/rest/v1/cnpj_cache`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(newEntries),
      }).catch(() => {});
    }
  }

  return res.json({ results, cached: batch.length - uncached.length, fetched: uncached.length });
}

// Parallel API race: BrasilAPI vs OpenCNPJ — first valid response wins
async function lookupCNPJ(cnpj) {
  const isRaiz = cnpj.length === 8;

  if (isRaiz) {
    // CNPJ raiz: only cnpj.ws supports /estabelecimentos
    return lookupCNPJws(cnpj).catch(() => null);
  }

  // Full CNPJ: race BrasilAPI vs OpenCNPJ
  const controller1 = new AbortController();
  const controller2 = new AbortController();

  const apis = [
    fetchBrasilAPI(cnpj, controller1.signal).then(r => { controller2.abort(); return r; }),
    fetchOpenCNPJ(cnpj, controller2.signal).then(r => { controller1.abort(); return r; }),
  ];

  try {
    // Promise.any: first successful result wins
    return await Promise.any(apis);
  } catch {
    return null;
  }
}

async function fetchBrasilAPI(cnpj, signal) {
  const tid = setTimeout(() => signal?.dispatchEvent?.(new Event('abort')), 3500);
  const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
    signal, headers: { 'Accept': 'application/json' },
  });
  clearTimeout(tid);
  if (!resp.ok) throw new Error(resp.status + '');
  const d = await resp.json();
  const nome = (d.nome_fantasia || '').trim();
  const razao = (d.razao_social || '').trim();
  return {
    nome_fantasia: nome || null, razao_social: razao || null,
    nome_exibicao: nome || razao || null,
    municipio: (d.municipio || '').trim() || null,
    uf: (d.uf || '').trim() || null,
    cep: (d.cep || '').replace(/\D/g, '') || null,
    situacao: d.descricao_situacao_cadastral || null,
    atividade: d.cnae_fiscal_descricao || null,
    endereco_receita: [d.descricao_tipo_logradouro, d.logradouro, d.numero, d.complemento, d.bairro, d.municipio, d.uf].filter(Boolean).join(', ') || null,
    logradouro: [d.descricao_tipo_logradouro, d.logradouro, d.numero].filter(Boolean).join(' ') || null,
    bairro: d.bairro || null, numero: d.numero || null,
  };
}

async function fetchOpenCNPJ(cnpj, signal) {
  const tid = setTimeout(() => signal?.dispatchEvent?.(new Event('abort')), 3500);
  const resp = await fetch(`https://api.opencnpj.org/${cnpj}`, {
    signal, headers: { 'Accept': 'application/json' },
  });
  clearTimeout(tid);
  if (!resp.ok) throw new Error(resp.status + '');
  const d = await resp.json();
  const nome = (d.nome_fantasia || '').trim();
  const razao = (d.razao_social || '').trim();
  return {
    nome_fantasia: nome || null, razao_social: razao || null,
    nome_exibicao: nome || razao || null,
    municipio: (d.municipio || '').trim() || null,
    uf: (d.uf || '').trim() || null,
    cep: (d.cep || '').replace(/\D/g, '') || null,
    situacao: d.situacao_cadastral || null,
    atividade: d.cnae_fiscal_descricao || null,
  };
}

async function lookupCNPJws(cnpjRaiz) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 5000);
  const resp = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjRaiz}`, {
    signal: controller.signal, headers: { 'Accept': 'application/json' },
  });
  clearTimeout(tid);
  if (!resp.ok) return null;
  const d = await resp.json();
  const est = d.estabelecimento || {};
  const nome = (est.nome_fantasia || '').trim();
  const razao = (d.razao_social || '').trim();
  return {
    nome_fantasia: nome || null, razao_social: razao || null,
    nome_exibicao: nome || razao || null,
    municipio: est.cidade?.nome || null,
    uf: est.estado?.sigla || null,
  };
}
