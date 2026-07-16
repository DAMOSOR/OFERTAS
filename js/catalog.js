/* catalog.js — carga la tarifa de productos y ofrece búsqueda rápida */

const Catalog = (() => {
  let products = [];
  let byCode = new Map();
  let ready = null;

  function normalize(str) {
    return (str || '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  async function load() {
    if (ready) return ready;
    ready = fetch('data/products.json')
      .then(r => r.json())
      .then(data => {
        products = data;
        byCode = new Map(products.map(p => [normalize(p.codigo), p]));
        const statusEl = document.getElementById('catalogStatus');
        if (statusEl) statusEl.textContent = `Catálogo cargado: ${products.length.toLocaleString('es-ES')} productos.`;
        return products;
      })
      .catch(err => {
        const statusEl = document.getElementById('catalogStatus');
        if (statusEl) statusEl.textContent = 'No se pudo cargar el catálogo (data/products.json).';
        console.error('Error cargando catálogo', err);
        return [];
      });
    return ready;
  }

  function findByCode(codigo) {
    return byCode.get(normalize(codigo)) || null;
  }

  function search(query, limit = 25) {
    const q = normalize(query).trim();
    if (!q) return [];
    const starts = [];
    const contains = [];
    for (const p of products) {
      const code = normalize(p.codigo);
      const desc = normalize(p.desc);
      if (code.startsWith(q)) { starts.push(p); continue; }
      if (code.includes(q) || desc.includes(q)) { contains.push(p); }
      if (starts.length + contains.length > 400) break;
    }
    return [...starts, ...contains].slice(0, limit);
  }

  return { load, findByCode, search, all: () => products };
})();
