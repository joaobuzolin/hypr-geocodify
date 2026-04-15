// ─── Utilidades compartilhadas ──────────────────────────────────────────────
// Funções puras, sem dependência de DOM ou state.

/** Escapa HTML pra evitar XSS em innerHTML */
export function escHtml(str) {
  if (str == null) return '';
  const el = document.createElement('div');
  el.textContent = String(str);
  return el.innerHTML;
}

/** Percentual formatado (decimal 0-1 → "12.3%") */
export function pct(v) {
  return v != null ? (parseFloat(v) * 100).toFixed(1) + '%' : '—';
}

/** Percentual formatado (já em % → "12.3%") */
export function pctRaw(v) {
  return v != null ? parseFloat(v).toFixed(1) + '%' : '—';
}

/** Formata número pt-BR (1234 → "1.234") */
export function formatNum(n) {
  return (n || 0).toLocaleString('pt-BR');
}

/** Agrupa array de objetos por chave */
export function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] || 'N/D';
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {});
}

/** Média de um campo numérico */
export function avg(arr, key) {
  if (!arr.length) return 0;
  return arr.reduce((s, r) => s + (parseFloat(r[key]) || 0), 0) / arr.length;
}

/** Lê CSS variable do :root */
export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Throttle simples */
export function throttle(fn, ms) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn.apply(this, args);
    }
  };
}
