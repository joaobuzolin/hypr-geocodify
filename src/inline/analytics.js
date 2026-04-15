// ─── analytics ─────────────────────────────────────────────────────────
// Extracted from app-legacy.js — domain module

function updateOverview() {
  const shareAvg = avg(filteredData, 'share_reais_sku_dimensao') * 100;
  const diffAvg = avg(filteredData, 'percentual_diff_media_dimensao');
  document.getElementById('ov-share-val').textContent = shareAvg.toFixed(1);
  const deltaEl = document.getElementById('ov-share-delta');
  deltaEl.textContent = (diffAvg > 0 ? '+' : '') + diffAvg.toFixed(1) + '% vs. média';
  deltaEl.className = 'share-delta ' + (diffAvg >= 0 ? 'pos' : 'neg');

  // Chart: shares (reais, volume, unidades)
  const shareR = avg(filteredData, 'share_reais_sku_dimensao') * 100;
  const shareV = avg(filteredData, 'share_volume_sku_dimensao') * 100;
  const shareU = avg(filteredData, 'share_unidades_sku_dimensao') * 100;
  renderBarChart('chart-shares',
    ['Reais', 'Volume', 'Unidades'],
    [shareR, shareV, shareU],
    [_cssVar('--accent'), _cssVar('--accent-light'), _cssVar('--blue-light')]
  );

  // Chart: PDVs por bandeira
  const grp = groupBy(filteredData, 'bandeira');
  const bandSort = Object.entries(grp).sort((a,b) => b[1].length - a[1].length).slice(0, 8);
  renderHorizBarChart('chart-bandeiras', bandSort.map(e => e[0]), bandSort.map(e => e[1].length));

  // Chart: distribuição de share
  const bins = [0,2,5,10,15,20,30,50,100];
  const labels = bins.slice(0,-1).map((v,i) => `${v}–${bins[i+1]}%`);
  const counts = bins.slice(0,-1).map((v,i) => filteredData.filter(r => {
    const s = parseFloat(r.share_reais_sku_dimensao||0)*100;
    return s >= v && s < bins[i+1];
  }).length);
  renderHistChart('chart-dist', labels, counts);
}

// ─── Ranking Tab ─────────────────────────────────────────────────────────────
function updateRanking() {
  const grp = groupBy(filteredData, 'bandeira');
  const ranked = Object.entries(grp).map(([b, rows]) => ({
    name: b,
    count: rows.length,
    shareAvg: avg(rows, 'share_reais_sku_dimensao') * 100,
    diffAvg: avg(rows, 'percentual_diff_media_dimensao'),
    oportAvg: avg(rows, 'oportunidade_dimensao'),
  })).sort((a,b) => b.shareAvg - a.shareAvg);

  const maxShare = Math.max(...ranked.map(r => r.shareAvg), 1);

  const top = ranked.slice(0, 7);
  const bottom = [...ranked].sort((a,b) => a.shareAvg - b.shareAvg).slice(0, 7);
  const topOport = [...ranked].sort((a,b) => b.oportAvg - a.oportAvg).slice(0, 7);

  function renderRankList(id, items, valueKey, label, badgeFn) {
    const el = document.getElementById(id);
    el.innerHTML = items.map((item, i) => {
      const val = item[valueKey];
      const badge = badgeFn ? badgeFn(item) : '';
      const barColor = item.diffAvg > 2 ? _cssVar('--win') : item.diffAvg < -2 ? _cssVar('--lose') : _cssVar('--neutral');
      return `<div class="rank-item">
        <span class="rank-num">${i+1}</span>
        <span class="rank-name" title="${_escForHtml(item.name)}">${_escForHtml(item.name)}</span>
        <div class="rank-bar-wrap"><div class="rank-bar" style="width:${Math.min(val/maxShare*100,100)}%;background:${barColor}"></div></div>
        <span class="rank-val" style="color:${barColor}">${val.toFixed(1)}%</span>
        ${badge}
      </div>`;
    }).join('');
  }

  renderRankList('rank-top', top, 'shareAvg', '%', item => {
    const cls = item.diffAvg > 2 ? 'win' : item.diffAvg < -2 ? 'lose' : 'neutral';
    const label = item.diffAvg > 2 ? '▲ ganha' : item.diffAvg < -2 ? '▼ perde' : '→ neutro';
    return `<span class="rank-badge ${cls}">${label}</span>`;
  });
  renderRankList('rank-bottom', bottom, 'shareAvg', '%', item => {
    const cls = item.diffAvg > 2 ? 'win' : item.diffAvg < -2 ? 'lose' : 'neutral';
    const label = item.diffAvg > 2 ? '▲ ganha' : item.diffAvg < -2 ? '▼ perde' : '→ neutro';
    return `<span class="rank-badge ${cls}">${label}</span>`;
  });

  // Oportunidade
  const maxOport = Math.max(...topOport.map(r => r.oportAvg), 1);
  const el = document.getElementById('rank-oport');
  el.innerHTML = topOport.map((item, i) => `
    <div class="rank-item">
      <span class="rank-num">${i+1}</span>
      <span class="rank-name" title="${_escForHtml(item.name)}">${_escForHtml(item.name)}</span>
      <div class="rank-bar-wrap"><div class="rank-bar" style="width:${Math.min(item.oportAvg/maxOport*100,100)}%;background:var(--accent)"></div></div>
      <span class="rank-val" style="color:var(--accent-light)">${item.oportAvg.toFixed(2)}</span>
      <span class="rank-badge neutral">${item.count} PDVs</span>
    </div>
  `).join('');
}

// ─── Analysis Tab ────────────────────────────────────────────────────────────
function updateAnalysis() {
  const grp = groupBy(filteredData, 'bandeira');
  const ranked = Object.entries(grp).map(([b, rows]) => ({
    name: b,
    count: rows.length,
    shareAvg: avg(rows, 'share_reais_sku_dimensao') * 100,
    diffAvg: avg(rows, 'percentual_diff_media_dimensao'),
    oportTotal: rows.reduce((s,r) => s + parseFloat(r.oportunidade_dimensao||0), 0),
  }));

  const winBandeiras = ranked.filter(r => r.diffAvg > 3).sort((a,b) => b.diffAvg - a.diffAvg).slice(0,3);
  const loseBandeiras = ranked.filter(r => r.diffAvg < -3).sort((a,b) => a.diffAvg - b.diffAvg).slice(0,3);
  const bestOport = ranked.sort((a,b) => b.oportTotal - a.oportTotal).slice(0,3);

  const totalPDVs = filteredData.length;
  const winCount = filteredData.filter(r => parseFloat(r.percentual_diff_media_dimensao||0) > 2).length;
  const loseCount = filteredData.filter(r => parseFloat(r.percentual_diff_media_dimensao||0) < -2).length;
  const winPct = totalPDVs ? (winCount / totalPDVs * 100).toFixed(0) : 0;
  const losePct = totalPDVs ? (loseCount / totalPDVs * 100).toFixed(0) : 0;

  const cards = [
    {
      icon: '📈',
      title: 'Onde a marca ganha share',
      body: winBandeiras.length
        ? `A marca está <span class="analysis-highlight win">acima da média</span> em ${winCount} PDVs (${winPct}% do total). ${winBandeiras.length ? `Melhor performance em: <span class="analysis-highlight">${winBandeiras.map(b => _escForHtml(b.name)).join(', ')}</span>.` : ''}`
        : `Nenhuma bandeira com performance significativamente acima da média nos filtros selecionados.`
    },
    {
      icon: '📉',
      title: 'Onde a marca perde share',
      body: loseBandeiras.length
        ? `A marca está <span class="analysis-highlight lose">abaixo da média</span> em ${loseCount} PDVs (${losePct}% do total). Risco concentrado em: <span class="analysis-highlight">${loseBandeiras.map(b => _escForHtml(b.name)).join(', ')}</span>.`
        : `Nenhuma bandeira com performance significativamente abaixo da média.`
    },
    {
      icon: '🎯',
      title: 'Maior oportunidade de investimento',
      body: bestOport.length
        ? `Priorizando bandeiras com maior score de oportunidade: <span class="analysis-highlight">${bestOport.map(b => `${_escForHtml(b.name)} (${b.count} PDVs)`).join(', ')}</span>. Esses PDVs têm maior potencial de crescimento de share.`
        : `Sem dados de oportunidade disponíveis.`
    },
    {
      icon: '⚖️',
      title: 'Balanço geral',
      body: `De ${totalPDVs.toLocaleString('pt-BR')} PDVs visíveis, <span class="analysis-highlight win">${winPct}% ganham</span> e <span class="analysis-highlight lose">${losePct}% perdem</span> share vs. a média da dimensão. ${parseFloat(winPct) > parseFloat(losePct) ? 'Cenário <span class="analysis-highlight win">favorável</span> para a marca.' : 'Há espaço relevante para <span class="analysis-highlight">recuperação de share</span>.'}`
    }
  ];

  document.getElementById('analysis-cards').innerHTML = cards.map(c => `
    <div class="analysis-card">
      <div class="analysis-card-header">
        <span class="analysis-card-icon">${c.icon}</span>
        <span class="analysis-card-title">${c.title}</span>
      </div>
      <div class="analysis-card-body">${c.body}</div>
    </div>
  `).join('');

  // Win/Lose chart
  const wlData = ranked.slice(0, 10);
  renderWinLoseChart('chart-winlose',
    wlData.map(r => r.name),
    wlData.map(r => Math.max(r.diffAvg, 0)),
    wlData.map(r => Math.min(r.diffAvg, 0))
  );

  // UF ranking
  const ufGrp = groupBy(filteredData, 'uf');
  const ufRanked = Object.entries(ufGrp)
    .map(([uf, rows]) => ({ name: uf, count: rows.length, shareAvg: avg(rows, 'share_reais_sku_dimensao') * 100 }))
    .sort((a,b) => b.count - a.count).slice(0, 10);
  const maxUf = Math.max(...ufRanked.map(r => r.count), 1);
  document.getElementById('rank-uf').innerHTML = ufRanked.map((item, i) => `
    <div class="rank-item">
      <span class="rank-num">${i+1}</span>
      <span class="rank-name">${_escForHtml(item.name)}</span>
      <div class="rank-bar-wrap"><div class="rank-bar" style="width:${item.count/maxUf*100}%;background:var(--accent)"></div></div>
      <span class="rank-val" style="color:var(--text-dim)">${item.count}</span>
      <span class="rank-badge neutral">${item.shareAvg.toFixed(1)}%</span>
    </div>
  `).join('');
}

// ─── Charts ──────────────────────────────────────────────────────────────────

var chartDefaults = {
  plugins: { legend: { display: false }, tooltip: {
    backgroundColor: _cssVar('--surface-solid'), borderColor: _cssVar('--border'), borderWidth: 1,
    titleColor: _cssVar('--text'), bodyColor: _cssVar('--text-dim'), padding: 10, cornerRadius: 6,
  }},
  scales: {},
};

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function renderBarChart(id, labels, data, colors) {
  destroyChart(id);
  const ctx = document.getElementById(id).getContext('2d');
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 4, borderSkipped: false }] },
    options: { ...chartDefaults, responsive: true, maintainAspectRatio: false,
      scales: { x: { grid: { color: _cssVar('--surface-subtle') }, ticks: { color: _cssVar('--text-muted'), font: { size: 10 } } },
        y: { grid: { color: _cssVar('--surface-subtle') }, ticks: { color: _cssVar('--text-muted'), font: { size: 10 }, callback: v => v.toFixed(1) + '%' } } }
    }
  });
}

function renderHorizBarChart(id, labels, data) {
  destroyChart(id);
  const ctx = document.getElementById(id).getContext('2d');
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: _cssVar('--accent'), borderRadius: 3, borderSkipped: false }] },
    options: { ...chartDefaults, indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { color: _cssVar('--surface-subtle') }, ticks: { color: _cssVar('--text-muted'), font: { size: 10 } } },
        y: { grid: { display: false }, ticks: { color: _cssVar('--text-dim'), font: { size: 10 }, callback: v => v.length > 14 ? v.slice(0,14)+'…' : v } }
      }
    }
  });
}

function renderHistChart(id, labels, data) {
  destroyChart(id);
  const ctx = document.getElementById(id).getContext('2d');
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: _cssVar('--accent-chart'), borderRadius: 2 }] },
    options: { ...chartDefaults, responsive: true, maintainAspectRatio: false,
      scales: { x: { grid: { display: false }, ticks: { color: _cssVar('--text-muted'), font: { size: 9 }, maxRotation: 45 } },
        y: { grid: { color: _cssVar('--surface-subtle') }, ticks: { color: _cssVar('--text-muted'), font: { size: 10 } } } }
    }
  });
}

function renderWinLoseChart(id, labels, wins, loses) {
  destroyChart(id);
  const ctx = document.getElementById(id).getContext('2d');
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Ganho', data: wins, backgroundColor: _cssVar('--win-chart'), borderRadius: 3 },
        { label: 'Perda', data: loses, backgroundColor: _cssVar('--lose-chart'), borderRadius: 3 },
      ]
    },
    options: { ...chartDefaults, indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { ...chartDefaults.plugins, legend: { display: true, labels: { color: _cssVar('--text-dim'), font: { size: 10 } } } },
      scales: {
        x: { stacked: false, grid: { color: _cssVar('--surface-subtle') }, ticks: { color: _cssVar('--text-muted'), font: { size: 10 } } },
        y: { grid: { display: false }, ticks: { color: _cssVar('--text-dim'), font: { size: 10 }, callback: v => v.length > 12 ? v.slice(0,12)+'…' : v } }
      }
    }
  });
}

// ─── Load Data ───────────────────────────────────────────────────────────────


// ─── window.* exports ──────────────────────────────────────────────────
window.destroyChart = destroyChart;
window.renderBarChart = renderBarChart;
window.renderHistChart = renderHistChart;
window.renderHorizBarChart = renderHorizBarChart;
window.renderRankList = renderRankList;
window.renderWinLoseChart = renderWinLoseChart;
window.updateAnalysis = updateAnalysis;
window.updateOverview = updateOverview;
window.updateRanking = updateRanking;
