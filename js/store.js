/* store.js — guarda y sincroniza ofertas.
   Si hay configuración de Firebase -> Firestore (sincronizado entre dispositivos).
   Si no -> localStorage (solo este dispositivo). La app funciona igual en ambos casos. */

const Store = (() => {
  const LS_CONFIG = 'ofertasApp_firebaseConfig';
  const LS_COMPANY = 'ofertasApp_company';
  const LS_LOCAL_DATA = 'ofertasApp_localOfertas';

  let db = null;
  let mode = 'local'; // 'local' | 'cloud'
  let listeners = [];
  let cache = []; // lista de ofertas (cabeceras + detalle)

  function notify() {
    listeners.forEach(fn => fn(cache.slice()));
  }
  function onChange(fn) {
    listeners.push(fn);
  }

  function getConfig() {
    try {
      const raw = localStorage.getItem(LS_CONFIG);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function setSyncUI(state, text) {
    const dot = document.getElementById('syncDot');
    const label = document.getElementById('syncText');
    if (!dot || !label) return;
    dot.classList.remove('on', 'off');
    dot.classList.add(state === 'on' ? 'on' : 'off');
    label.textContent = text;
  }

  function saveConfig(configObj) {
    localStorage.setItem(LS_CONFIG, JSON.stringify(configObj));
    return init();
  }

  function clearConfig() {
    localStorage.removeItem(LS_CONFIG);
    location.reload();
  }

  function getCompany() {
    try {
      const raw = localStorage.getItem(LS_COMPANY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveCompany(obj) {
    localStorage.setItem(LS_COMPANY, JSON.stringify(obj));
  }

  function readLocal() {
    try {
      const raw = localStorage.getItem(LS_LOCAL_DATA);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function writeLocal(arr) {
    localStorage.setItem(LS_LOCAL_DATA, JSON.stringify(arr));
  }

  async function init() {
    const cfg = getConfig();
    const statusEl = document.getElementById('configStatus');
    if (cfg && cfg.apiKey && cfg.projectId) {
      try {
        if (!firebase.apps.length) firebase.initializeApp(cfg);
        db = firebase.firestore();
        mode = 'cloud';
        setSyncUI('on', 'Sincronizado');
        if (statusEl) statusEl.textContent = 'Conectado a Firebase correctamente.';
        db.collection('ofertas').orderBy('fecha', 'desc')
          .onSnapshot(snap => {
            cache = snap.docs.map(d => d.data());
            notify();
          }, err => {
            console.error(err);
            setSyncUI('off', 'Error de sincronización');
            if (statusEl) statusEl.textContent = 'Error conectando con Firebase: ' + err.message;
          });
        return true;
      } catch (err) {
        console.error(err);
        mode = 'local';
        setSyncUI('off', 'Error, usando modo local');
        if (statusEl) statusEl.textContent = 'Error en la configuración: ' + err.message;
      }
    } else {
      mode = 'local';
      setSyncUI('off', 'Modo local (sin sincronizar)');
    }
    cache = readLocal();
    notify();
    return false;
  }

  async function saveOferta(oferta) {
    oferta.actualizadoEn = new Date().toISOString();
    if (mode === 'cloud' && db) {
      await db.collection('ofertas').doc(oferta.numero).set(oferta, { merge: true });
    } else {
      const list = readLocal();
      const idx = list.findIndex(o => o.numero === oferta.numero);
      if (idx >= 0) list[idx] = oferta; else list.unshift(oferta);
      writeLocal(list);
      cache = list;
      notify();
    }
  }

  async function deleteOferta(numero) {
    if (mode === 'cloud' && db) {
      await db.collection('ofertas').doc(numero).delete();
    } else {
      const list = readLocal().filter(o => o.numero !== numero);
      writeLocal(list);
      cache = list;
      notify();
    }
  }

  function getOferta(numero) {
    return cache.find(o => o.numero === numero) || null;
  }

  function list() {
    return cache.slice();
  }

  function getMode() { return mode; }

  return {
    init, onChange, saveConfig, clearConfig, getConfig,
    getCompany, saveCompany,
    saveOferta, deleteOferta, getOferta, list, getMode
  };
})();
