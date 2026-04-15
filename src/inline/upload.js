// ─── upload ─────────────────────────────────────────────────────────
// Extracted from app-legacy.js — domain module

async function loadData(data) {
  // Remover linha de totais
  data = data.filter(r => r.cnpj && !r.cnpj.toUpperCase().includes('TODOS OS CNPJS'));

  allData = data.filter(r => r.lat && r.lon && parseFloat(r.lat) && parseFloat(r.lon));
  filteredData = [...allData];

  document.getElementById('upload-zone').classList.add('hidden');
  document.getElementById('app').style.display = 'flex';
  await new Promise(r => setTimeout(r, 50));
  if (!map) initMap();
  await new Promise(r => setTimeout(r, 100));
  if (map) map.resize();

  // Fit bounds
  setTimeout(() => {
    const validPts = allData.filter(r => r.lat && r.lon);
    if (validPts.length) {
      if (!validPts.length) return;
      const bounds = validPts.reduce((b, r) => b.extend([parseFloat(r.lon), parseFloat(r.lat)]),
        new maplibregl.LngLatBounds([parseFloat(validPts[0].lon), parseFloat(validPts[0].lat)], [parseFloat(validPts[0].lon), parseFloat(validPts[0].lat)]));
      map.fitBounds(bounds, { padding: 40, animate: true });
    }
  }, 200);

  populateFilters();
  renderMarkers();
  updatePanels();
  updateOverlay();
}

// ─── Auth — Supabase Email + Senha ──────────────────────────────────────────

var _uploadTemplates = {
  geocoder: {
    label: 'Formato esperado do CSV',
    headers: ['endereco', 'nome'],
    rows: [
      ['RUA DO COMERCIO, 150, CENTRO, RECIFE, PE', 'Loja Centro'],
      ['AV PAULISTA, 1000, BELA VISTA, SAO PAULO, SP', 'Filial SP'],
      ['ROD BR-101, KM 45, CAMAÇARI, BA', 'CD Bahia'],
    ],
    tip: 'Inclua cidade e UF para maior precisão na geocodificação.',
    filename: 'template_geocoder.csv',
  },
  reverse_geocoder: {
    label: 'Formato esperado do CSV',
    headers: ['lat', 'lon', 'nome'],
    rows: [
      ['-23.56132', '-46.65618', 'Ponto A'],
      ['-22.90680', '-43.17290', 'Ponto B'],
      ['-19.91910', '-43.93860', 'Ponto C'],
    ],
    tip: 'Use coordenadas decimais (WGS84). A coluna "nome" é opcional.',
    filename: 'template_reverse_geocoder.csv',
  },
  varejo360: {
    label: 'Formato Varejo 360 — Share por Loja (CNPJ)',
    headers: ['marca', 'cnpj', 'percentual_dimensao', 'percentual_marca_dimensao', 'tickets_amostra'],
    displayHeaders: ['marca', 'cnpj', '% dimensão', '% marca', 'tickets'],
    rows: [
      ['ITALAC', '44480747000160 - PARADA PINTO, 2262 - V.N. CACHOEIRINHA', '0.47', '3.14', '9187'],
      ['ITALAC', '43559079000602 - LUIS STAMATIS, 431 - SAO PAULO/SP', '0.38', '20.78', '6168'],
      ['ITALAC', '06057223054697 - AV ANA COSTA, 340 - SANTOS/SP', '0.32', '22.89', '5234'],
    ],
    tip: 'No Varejo 360, exporte o share da marca aberto por dimensão <strong>Loja (CNPJ)</strong>.',
    filename: 'template_varejo360_share.csv',
  },
};

function renderUploadTemplate(type) {
  var tpl = _uploadTemplates[type];
  var preview = document.getElementById('upload-tpl-preview');
  var dlBtn = document.getElementById('upload-tpl-dl');
  if (!tpl || !preview) { if (preview) preview.style.display = 'none'; if (dlBtn) dlBtn.style.display = 'none'; return; }

  var html = '<div class="tpl-label"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> ' + tpl.label + '</div>';
  var displayH = tpl.displayHeaders || tpl.headers;
  html += '<table><thead><tr>' + displayH.map(function(h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>';
  tpl.rows.forEach(function(row) {
    html += '<tr>' + row.map(function(v) { return '<td>' + v + '</td>'; }).join('') + '</tr>';
  });
  html += '</tbody></table>';
  if (tpl.tip) html += '<div style="margin-top:8px;font-size:11px;color:var(--text-muted);line-height:1.5;text-align:left;">💡 ' + tpl.tip + '</div>';

  preview.innerHTML = html;
  preview.style.display = 'block';
  if (dlBtn) { dlBtn.style.display = 'inline-flex'; dlBtn.setAttribute('data-type', type); }
}

function downloadTemplate(e) {
  if (e) e.stopPropagation();
  var btn = document.getElementById('upload-tpl-dl');
  var type = btn?.getAttribute('data-type') || 'geocoder';
  var tpl = _uploadTemplates[type];
  if (!tpl) return;

  var csvRows = [tpl.headers.join(',')];
  tpl.rows.forEach(function(row) {
    csvRows.push(row.map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','));
  });
  var blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = tpl.filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Varejo 360: Sub-modal de seleção ────────────────────────────────────────

function handleCSVFile(file) {
  const isXLSX = /\.xlsx?$/i.test(file.name);
  const reader = new FileReader();

  reader.onload = ev => {
    let parsed;
    try {
      if (isXLSX) {
        // Ler XLSX com SheetJS
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        // Usar primeira aba
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Converter para array de objetos, headers normalizados (lowercase, sem acentos)
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
        parsed = raw.map(row => {
          const normalized = {};
          Object.entries(row).forEach(([k, v]) => {
            const key = String(k).toLowerCase()
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
              .trim().replace(/\s+/g, '_');
            normalized[key] = v != null ? String(v) : '';
          });
          return normalized;
        });
      } else {
        // Ler CSV normalmente
        parsed = parseCSV(ev.target.result);
      }
    } catch(e) {
      document.getElementById('upload-formats-msg').textContent = '⚠️ Erro ao ler arquivo: ' + e.message;
      return;
    }

    // Filtrar linhas inválidas (totalizadores, linhas vazias)
    const cleaned = parsed.filter(r => {
      const vals = Object.values(r);
      if (!vals.some(v => v)) return false; // linha vazia
      const cnpjVal = r.cnpj || r['cnpj'] || '';
      if (cnpjVal.toUpperCase().includes('TODOS OS CNPJS')) return false;
      return true;
    });

    if (cleaned.length === 0) {
      document.getElementById('upload-formats-msg').textContent = '⚠️ Nenhum dado válido encontrado. Verifique o formato do arquivo.';
      return;
    }

    // Detectar formato e normalizar
    const { rows, formato, info } = detectAndNormalize(cleaned);

    // Lat/Lon direto: só plotar sem geocodificar se NÃO for reverse_geocoder
    // Para reverse_geocoder, lat/lon são os INPUTS — precisa buscar endereços
    if (formato === 'latlon' && currentMapType !== 'reverse_geocoder') {
      document.getElementById('upload-formats-msg').textContent = `✅ ${rows.length.toLocaleString('pt-BR')} pontos com coordenadas — plotando direto no mapa.`;
      loadData(rows);
      return;
    }

    // Mensagem de info conforme formato e tipo selecionado
    if (formato === 'latlon' && currentMapType === 'reverse_geocoder') {
      window._formatoCSV = 'latlon';
      document.getElementById('upload-formats-msg').textContent = `✅ ${rows.length.toLocaleString('pt-BR')} coordenadas detectadas — endereços serão gerados via HERE API.`;
    } else if (formato === 'cnpj_raiz') {
      window._formatoCSV = 'cnpj_raiz';
      document.getElementById('upload-formats-msg').textContent = `✅ ${rows.length.toLocaleString('pt-BR')} PDVs por CNPJ Raiz detectados — endereços e bandeiras via Receita Federal.`;
    } else if (formato === 'cnpj_puro') {
      window._formatoCSV = 'cnpj_puro';
      document.getElementById('upload-formats-msg').textContent = `✅ ${rows.length.toLocaleString('pt-BR')} CNPJs detectados — endereços serão buscados na Receita Federal.`;
    } else if (formato === 'endereco') {
      window._formatoCSV = 'endereco';
      document.getElementById('upload-formats-msg').textContent = `✅ ${rows.length.toLocaleString('pt-BR')} endereços detectados — pronto para geocodificar.`;
    } else {
      window._formatoCSV = 'hypr';
      document.getElementById('upload-formats-msg').textContent = `✅ ${rows.length.toLocaleString('pt-BR')} registros carregados de "${file.name}".`;
    }

    rawCSVData = rows;
    document.getElementById('step-apikey-sub').textContent =
      `${info} — ${rows.length.toLocaleString('pt-BR')} linhas. Clique em iniciar para geocodificar.`;

    goToStep(2);
  };
  if (isXLSX) {
    reader.readAsArrayBuffer(file);
  } else {
    // Ler como ArrayBuffer primeiro para detectar encoding
    var encodingReader = new FileReader();
    encodingReader.onload = function(ev2) {
      var bytes = new Uint8Array(ev2.target.result);

      // 1. Tentar UTF-8 (encoding correto)
      try {
        var decoded = new TextDecoder('UTF-8', { fatal: true }).decode(bytes);
        reader.onload({ target: { result: decoded } });
        return;
      } catch(e) { /* não é UTF-8 válido */ }

      // 2. Detectar se é MacRoman ou Windows-1252/Latin-1
      //    MacRoman usa bytes 0x80-0x9F para caracteres visíveis (Ä, Å, Ç, É, etc.)
      //    Windows-1252 usa 0x80-0x9F para controle/pontuação (€, ‚, ƒ, „, etc.)
      //    Heurística: contar bytes no range 0x80-0x9F que são letras comuns em pt-BR no MacRoman
      var macHits = 0, winHits = 0;
      // MacRoman: 0x87=á, 0x88=à, 0x89=â, 0x8A=ä, 0x8B=ã, 0x8C=å, 0x8E=é, 0x8F=è,
      //           0x90=ê, 0x91=ë, 0x92=í, 0x93=ì, 0x94=î, 0x95=ï, 0x96=ñ, 0x97=ó,
      //           0x98=ò, 0x99=ô, 0x9A=ö, 0x9B=õ, 0x9C=ú, 0x9D=ù, 0x9E=û, 0x9F=ü
      var macLetters = {0x87:1,0x88:1,0x89:1,0x8A:1,0x8B:1,0x8C:1,0x8E:1,0x8F:1,
                        0x90:1,0x91:1,0x92:1,0x93:1,0x94:1,0x95:1,0x96:1,0x97:1,
                        0x98:1,0x99:1,0x9A:1,0x9B:1,0x9C:1,0x9D:1,0x9E:1,0x9F:1};
      for (var bi = 0; bi < bytes.length; bi++) {
        var b = bytes[bi];
        if (b >= 0x80 && b <= 0x9F) {
          if (macLetters[b]) macHits++;
          else winHits++;
        }
      }

      var text;
      if (macHits > winHits && macHits > 0) {
        // MacRoman — TextDecoder não suporta, decodificar manualmente
        var macMap = {
          0x80:0xC4,0x81:0xC5,0x82:0xC7,0x83:0xC9,0x84:0xD1,0x85:0xD6,0x86:0xDC,
          0x87:0xE1,0x88:0xE0,0x89:0xE2,0x8A:0xE4,0x8B:0xE3,0x8C:0xE5,0x8D:0xE7,
          0x8E:0xE9,0x8F:0xE8,0x90:0xEA,0x91:0xEB,0x92:0xED,0x93:0xEC,0x94:0xEE,
          0x95:0xEF,0x96:0xF1,0x97:0xF3,0x98:0xF2,0x99:0xF4,0x9A:0xF6,0x9B:0xF5,
          0x9C:0xFA,0x9D:0xF9,0x9E:0xFB,0x9F:0xFC,0xA1:0xB0,0xA2:0xA2,0xA3:0xA3,
          0xA4:0xA7,0xA5:0x2022,0xA6:0xB6,0xA7:0xDF,0xA8:0xAE,0xA9:0xA9,0xAA:0x2122,
          0xAB:0xB4,0xAC:0xA8,0xAD:0x2260,0xAE:0xC6,0xAF:0xD8,0xB0:0x221E,
          0xB1:0xB1,0xB2:0x2264,0xB3:0x2265,0xB4:0xA5,0xB5:0xB5,0xB7:0x2211,
          0xB8:0x220F,0xBA:0x2126,0xBB:0xAA,0xBC:0xBA,0xBF:0xBF,0xC0:0xA1,
          0xC1:0xAC,0xC7:0xAB,0xC8:0xBB,0xC9:0x2026,0xCA:0xA0,0xCB:0xC0,
          0xCC:0xC3,0xCD:0xD5,0xCE:0x152,0xCF:0x153,0xD0:0x2013,0xD1:0x2014,
          0xD2:0x201C,0xD3:0x201D,0xD4:0x2018,0xD5:0x2019,0xD6:0xF7,
          0xD8:0xFF,0xD9:0x178,0xDA:0x2044,0xDB:0x20AC,0xDC:0x2039,0xDD:0x203A,
          0xDE:0xFB01,0xDF:0xFB02,0xE0:0x2021,0xE1:0xB7,0xE5:0xC2,0xE6:0xCA,
          0xE7:0xC1,0xE8:0xCB,0xE9:0xC8,0xEA:0xCD,0xEB:0xCE,0xEC:0xCF,0xED:0xCC,
          0xEE:0xD3,0xEF:0xD4,0xF1:0xD2,0xF2:0xDA,0xF3:0xDB,0xF4:0xD9
        };
        var chars = [];
        for (var ci = 0; ci < bytes.length; ci++) {
          var bv = bytes[ci];
          if (bv < 0x80) chars.push(String.fromCharCode(bv));
          else if (macMap[bv]) chars.push(String.fromCharCode(macMap[bv]));
          else chars.push(String.fromCharCode(bv)); // fallback
        }
        text = chars.join('');
      } else {
        // Windows-1252 (superset de Latin-1 — TextDecoder suporta como 'windows-1252')
        try {
          text = new TextDecoder('windows-1252').decode(bytes);
        } catch(e2) {
          text = new TextDecoder('ISO-8859-1').decode(bytes);
        }
      }

      reader.onload({ target: { result: text } });
    };
    encodingReader.readAsArrayBuffer(file);
  }
}

document.getElementById('file-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) handleCSVFile(file);
});

var dropZone = document.getElementById('drop-zone');
dropZone.addEventListener('click', e => {
  // Não disparar se clicou em botão, link ou input dentro do drop-zone
  if (e.target.closest('button, a, input, .upload-template-preview')) return;
  document.getElementById('file-input').click();
});
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && /\.(csv|xlsx|xls)$/i.test(file.name)) handleCSVFile(file);
  else if (file) document.getElementById('upload-formats-msg').textContent = '⚠️ Formato não suportado. Use CSV, XLSX ou XLS.';
});

// ─── Supabase DB helpers ──────────────────────────────────────────────────────


// ─── window.* exports ──────────────────────────────────────────────────
window.downloadTemplate = downloadTemplate;
window.handleCSVFile = handleCSVFile;
window.loadData = loadData;
window.renderUploadTemplate = renderUploadTemplate;
