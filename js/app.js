/* app.js — lógica principal: formulario de oferta, cálculo, registro, PDF */

(function () {
  let lineSeq = 0;
  let currentNumero = null; // si estamos editando una oferta ya guardada

  // ---------- utilidades ----------
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function generarNumeroOferta() {
    const d = new Date();
    return 'OF' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
      pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  }
  function toISODate(d) {
    return d.toISOString().slice(0, 10);
  }
  function money(n) {
    return (Number(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
  function num(v) {
    if (v === null || v === undefined || v === '') return 0;
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._h);
    toast._h = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------- tabs ----------
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('view-' + btn.dataset.view).classList.add('active');
      if (btn.dataset.view === 'registro') renderRegistro();
    });
  });

  // ---------- motor de cálculo (replica la fórmula del Excel) ----------
  // ="(K*(L-100)/-100*(M-100)/-100*(N-100)/-100*(O-100)/-100*(P-100)/-100)/(1-Q)"
  // K=PVP, L=Descuento, M=Extra 1, N=Extra 2, Q=Margen comercial (por línea)
  function calcLinea(line) {
    const pvp = num(line.pvp);
    const dto = num(line.dto);
    const extra = num(line.extra);
    const extra2 = num(line.extra2);
    const margen = num(line.margen) / 100;
    let netoUd = pvp * (1 - dto / 100) * (1 - extra / 100) * (1 - extra2 / 100);
    if (margen < 1) netoUd = netoUd / (1 - margen);
    const subtotal = num(line.cant) * netoUd;
    const raeeTotal = num(line.raee) * num(line.cant);
    return { netoUd, subtotal, raeeTotal };
  }

  function recalcAll() {
    let neto = 0, raee = 0;
    document.querySelectorAll('#linesBody tr').forEach(tr => {
      const line = readLineRow(tr);
      const { netoUd, subtotal, raeeTotal } = calcLinea(line);
      tr.querySelector('.out-neto').value = netoUd ? netoUd.toFixed(2) : '';
      tr.querySelector('.out-subtotal').value = subtotal ? subtotal.toFixed(2) : '';
      neto += subtotal;
      raee += raeeTotal;
    });
    const ivaPct = num(document.getElementById('cfg-iva').value || 21);
    const base = neto + raee;
    const iva = base * ivaPct / 100;
    const total = base + iva;
    document.getElementById('t-neto').textContent = money(neto);
    document.getElementById('t-raee').textContent = money(raee);
    document.getElementById('t-base').textContent = money(base);
    document.getElementById('t-iva').textContent = money(iva);
    document.getElementById('t-total').textContent = money(total);
    return { neto, raee, base, iva, total, ivaPct };
  }

  function readLineRow(tr) {
    return {
      cant: tr.querySelector('.in-cant').value,
      codigo: tr.querySelector('.in-codigo').value,
      desc: tr.querySelector('.in-desc').value,
      pvp: tr.querySelector('.in-pvp').value,
      dto: tr.querySelector('.in-dto').value,
      extra: tr.querySelector('.in-extra').value,
      extra2: tr.querySelector('.in-extra2').value,
      raee: tr.querySelector('.in-raee').value,
      margen: tr.querySelector('.in-margen').value,
      ficha: tr.dataset.ficha || ''
    };
  }

  // ---------- navegación por teclado dentro de una línea ----------
  function getRowInputsOrder(tr) {
    return Array.from(tr.querySelectorAll('input')).filter(inp => !inp.readOnly);
  }

  function focusNextInRow(tr, currentInput) {
    const inputs = getRowInputsOrder(tr);
    const idx = inputs.indexOf(currentInput);
    if (idx >= 0 && idx < inputs.length - 1) {
      const next = inputs[idx + 1];
      next.focus();
      if (next.select) next.select();
      return true;
    }
    return false;
  }

  function focusNextRowOrCreate(tr) {
    const rows = Array.from(document.querySelectorAll('#linesBody tr'));
    const idx = rows.indexOf(tr);
    let nextRow = rows[idx + 1];
    if (!nextRow) nextRow = addLine();
    const inputs = getRowInputsOrder(nextRow);
    if (inputs[0]) {
      inputs[0].focus();
      inputs[0].select();
    }
  }

  function attachEnterNavigation(tr, input) {
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (!focusNextInRow(tr, input)) focusNextRowOrCreate(tr);
    });
  }

  // ---------- filas de la tabla ----------
  function addLine(data) {
    data = data || {};
    lineSeq++;
    const tr = document.createElement('tr');
    tr.dataset.seq = lineSeq;
    tr.dataset.ficha = data.ficha || '';
    tr.innerHTML = `
      <td class="num">${document.querySelectorAll('#linesBody tr').length + 1}</td>
      <td><input type="number" class="in-cant" min="0" value="${data.cant ?? ''}"></td>
      <td class="col-codigo" style="position:relative;">
        <input type="text" class="in-codigo" autocomplete="off" value="${data.codigo ?? ''}" placeholder="Código">
      </td>
      <td class="col-desc" style="position:relative;">
        <input type="text" class="in-desc" value="${data.desc ?? ''}" placeholder="Descripción">
      </td>
      <td class="num"><input type="number" class="in-pvp" step="0.01" value="${data.pvp ?? ''}"></td>
      <td class="num"><input type="number" class="in-dto" step="0.5" value="${data.dto ?? document.getElementById('f-dtogeneral').value}"></td>
      <td class="num"><input type="number" class="in-extra" step="0.5" value="${data.extra ?? 0}"></td>
      <td class="num"><input type="number" class="in-extra2" step="0.5" value="${data.extra2 ?? 0}"></td>
      <td class="num"><input type="number" class="in-raee" step="0.01" value="${data.raee ?? ''}"></td>
      <td class="num"><input type="number" class="in-margen" step="0.5" value="${data.margen ?? document.getElementById('f-benf').value}"></td>
      <td class="num"><input type="text" class="out-neto" readonly></td>
      <td class="num row-total"><input type="text" class="out-subtotal" readonly></td>
      <td><button class="btn btn-ghost btn-sm btn-del" title="Eliminar línea">✕</button></td>
    `;
    document.getElementById('linesBody').appendChild(tr);

    tr.querySelector('.btn-del').addEventListener('click', () => {
      tr.remove();
      renumberLines();
      recalcAll();
    });

    tr.querySelectorAll('input:not(.in-codigo)').forEach(inp => {
      inp.addEventListener('input', recalcAll);
      attachEnterNavigation(tr, inp);
    });

    setupCodigoAutocomplete(tr);
    recalcAll();
    return tr;
  }

  function renumberLines() {
    document.querySelectorAll('#linesBody tr').forEach((tr, i) => {
      tr.querySelector('td.num').textContent = i + 1;
    });
  }

  function applyProductToRow(tr, product) {
    tr.querySelector('.in-codigo').value = product.codigo;
    tr.querySelector('.in-desc').value = product.desc || '';
    tr.querySelector('.in-pvp').value = product.pvp ?? '';
    if (product.dto1 !== null && product.dto1 !== undefined) {
      tr.querySelector('.in-dto').value = product.dto1;
    }
    tr.querySelector('.in-raee').value = product.raee ?? 0;
    tr.dataset.ficha = product.ficha || '';
    if (!tr.querySelector('.in-cant').value) tr.querySelector('.in-cant').value = 1;
    recalcAll();
  }

  function setupCodigoAutocomplete(tr) {
    const input = tr.querySelector('.in-codigo');
    let list;
    let hiIdx = -1;
    let currentResults = [];

    function closeList() { if (list) { list.remove(); list = null; hiIdx = -1; currentResults = []; } }

    function selectResult(p) {
      applyProductToRow(tr, p);
      closeList();
    }

    input.addEventListener('input', () => {
      closeList();
      const q = input.value.trim();
      if (q.length < 2) return;
      currentResults = Catalog.search(q, 20);
      if (!currentResults.length) return;
      list = document.createElement('div');
      list.className = 'autocomplete-list';
      currentResults.forEach((p, i) => {
        const item = document.createElement('div');
        item.innerHTML = `<span class="ac-code">${p.codigo}</span>${(p.desc || '').slice(0, 60)}`;
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          selectResult(p);
        });
        list.appendChild(item);
      });
      tr.querySelector('.col-codigo').appendChild(list);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (currentResults.length) {
          selectResult(currentResults[hiIdx >= 0 ? hiIdx : 0]);
        } else {
          const exact = Catalog.findByCode(input.value.trim());
          if (exact) applyProductToRow(tr, exact);
        }
        if (!focusNextInRow(tr, input)) focusNextRowOrCreate(tr);
        return;
      }
      if (!list) return;
      const items = list.querySelectorAll('div');
      if (e.key === 'ArrowDown') { e.preventDefault(); hiIdx = Math.min(hiIdx + 1, items.length - 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); hiIdx = Math.max(hiIdx - 1, 0); }
      else if (e.key === 'Escape') { closeList(); return; }
      else return;
      items.forEach(it => it.classList.remove('hi'));
      if (items[hiIdx]) items[hiIdx].classList.add('hi');
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        closeList();
        // si el código coincide exacto con uno del catálogo, autocompletar igualmente
        const exact = Catalog.findByCode(input.value.trim());
        if (exact && !tr.querySelector('.in-desc').value) applyProductToRow(tr, exact);
      }, 120);
    });
  }

  // ---------- oferta: nueva / cargar / guardar / borrar ----------
  function nuevaOferta() {
    currentNumero = null;
    document.getElementById('f-numero').value = generarNumeroOferta();
    document.getElementById('f-fecha').value = toISODate(new Date());
    document.getElementById('f-cliente').value = '';
    document.getElementById('f-obra').value = '';
    document.getElementById('f-dtogeneral').value = 40;
    document.getElementById('f-benf').value = 7;
    document.getElementById('f-estado').value = 'pendiente';
    document.getElementById('linesBody').innerHTML = '';
    document.getElementById('btnEliminar').style.display = 'none';
    document.getElementById('btnDuplicar').style.display = 'none';
    for (let i = 0; i < 3; i++) addLine();
    recalcAll();
  }

  function cargarOferta(numero) {
    const o = Store.getOferta(numero);
    if (!o) return toast('No se encontró la oferta.');
    currentNumero = o.numero;
    document.getElementById('f-numero').value = o.numero;
    document.getElementById('f-fecha').value = (o.fecha || '').slice(0, 10);
    document.getElementById('f-cliente').value = o.cliente || '';
    document.getElementById('f-obra').value = o.obra || '';
    document.getElementById('f-dtogeneral').value = o.dtoGeneral ?? 40;
    document.getElementById('f-benf').value = o.benf ?? 7;
    document.getElementById('f-estado').value = o.estado || 'pendiente';
    document.getElementById('linesBody').innerHTML = '';
    (o.lineas || []).forEach(l => addLine(l));
    if (!(o.lineas || []).length) addLine();
    document.getElementById('btnEliminar').style.display = 'inline-flex';
    document.getElementById('btnDuplicar').style.display = 'inline-flex';
    recalcAll();
    document.querySelector('.tab-btn[data-view="oferta"]').click();
    toast('Oferta ' + numero + ' cargada para edición.');
  }

  function recogerLineas() {
    return Array.from(document.querySelectorAll('#linesBody tr')).map(tr => {
      const line = readLineRow(tr);
      const { netoUd, subtotal } = calcLinea(line);
      return { ...line, netoUd, subtotal };
    }).filter(l => l.codigo || l.desc || num(l.cant) > 0);
  }

  async function guardarOferta() {
    const numero = document.getElementById('f-numero').value.trim();
    const cliente = document.getElementById('f-cliente').value.trim();
    const obra = document.getElementById('f-obra').value.trim();
    if (!numero) return toast('Falta el número de oferta.');
    if (!cliente && !obra) return toast('Indica al menos el cliente o la obra.');

    const totals = recalcAll();
    const lineas = recogerLineas();
    if (!lineas.length) return toast('Añade al menos una línea con datos.');

    const oferta = {
      numero,
      fecha: document.getElementById('f-fecha').value || toISODate(new Date()),
      cliente, obra,
      dtoGeneral: num(document.getElementById('f-dtogeneral').value),
      benf: num(document.getElementById('f-benf').value),
      estado: document.getElementById('f-estado').value || 'pendiente',
      lineas,
      totales: totals,
      importeTotal: totals.total
    };

    try {
      await Store.saveOferta(oferta);
      currentNumero = numero;
      document.getElementById('btnEliminar').style.display = 'inline-flex';
      document.getElementById('btnDuplicar').style.display = 'inline-flex';
      toast('Oferta guardada correctamente (' + Store.getMode() + ').');
    } catch (err) {
      console.error(err);
      toast('Error al guardar: ' + err.message);
    }
  }

  async function eliminarOferta() {
    if (!currentNumero) return;
    if (!confirm('¿Eliminar la oferta ' + currentNumero + '? Esta acción no se puede deshacer.')) return;
    await Store.deleteOferta(currentNumero);
    toast('Oferta eliminada.');
    nuevaOferta();
  }

  async function duplicarOferta() {
    // genera un número nuevo y guarda el estado actual del formulario (con los cambios
    // hechos: cliente, obra, líneas, cantidades...) como una oferta independiente,
    // sin tocar ni sobrescribir la oferta original.
    const nuevoNumero = generarNumeroOferta();
    document.getElementById('f-numero').value = nuevoNumero;
    document.getElementById('f-fecha').value = toISODate(new Date());
    document.getElementById('f-estado').value = 'pendiente';
    currentNumero = null;
    document.getElementById('btnEliminar').style.display = 'none';
    document.getElementById('btnDuplicar').style.display = 'none';
    await guardarOferta();
    toast('Oferta duplicada como ' + nuevoNumero + '. La original no se ha modificado.');
  }

  function generarPDF() {
    const totals = recalcAll();
    const oferta = {
      numero: document.getElementById('f-numero').value,
      fecha: document.getElementById('f-fecha').value,
      cliente: document.getElementById('f-cliente').value,
      obra: document.getElementById('f-obra').value,
      lineas: recogerLineas()
    };
    if (!oferta.lineas.length) return toast('Añade líneas antes de generar el PDF.');
    PDFGen.generate(oferta, totals);
  }

  // ---------- registro ----------
  const DIAS_AVISO = 60; // 2 meses aprox.

  function diasDesde(fechaStr) {
    if (!fechaStr) return null;
    const f = new Date(fechaStr);
    if (isNaN(f)) return null;
    const hoy = new Date();
    return Math.floor((hoy - f) / 86400000);
  }

  function fmtAntiguedad(dias) {
    if (dias === null) return '-';
    if (dias < 1) return 'Hoy';
    if (dias < 30) return dias + ' días';
    const meses = Math.floor(dias / 30);
    return meses + (meses === 1 ? ' mes' : ' meses');
  }

  const ESTADO_LABEL = {
    pendiente: { icon: '🟡', text: 'Pendiente' },
    ganada: { icon: '🟢', text: 'Ganada' },
    perdida: { icon: '🔴', text: 'Perdida' }
  };

  function renderRegistro(filter) {
    const body = document.getElementById('regBody');
    const empty = document.getElementById('regEmpty');
    const soloPendientes = document.getElementById('regSoloPendientes').checked;
    const filtroEstado = document.getElementById('regFiltroEstado').value;
    let list = Store.list();
    if (filter) {
      const q = filter.toLowerCase();
      list = list.filter(o =>
        (o.cliente || '').toLowerCase().includes(q) ||
        (o.obra || '').toLowerCase().includes(q) ||
        (o.numero || '').toLowerCase().includes(q)
      );
    }
    if (filtroEstado !== 'todas') {
      list = list.filter(o => (o.estado || 'pendiente') === filtroEstado);
    }
    if (soloPendientes) {
      list = list.filter(o => {
        const d = diasDesde(o.fecha);
        return d !== null && d >= DIAS_AVISO;
      });
    }
    body.innerHTML = '';
    empty.style.display = list.length ? 'none' : 'block';
    list.forEach(o => {
      const dias = diasDesde(o.fecha);
      const estado = o.estado || 'pendiente';
      // el aviso de "reclamar" solo tiene sentido mientras la oferta sigue pendiente
      const stale = estado === 'pendiente' && dias !== null && dias >= DIAS_AVISO;
      const tr = document.createElement('tr');
      if (stale) tr.classList.add('row-stale');
      const fecha = o.fecha ? new Date(o.fecha).toLocaleDateString('es-ES') : '';
      const est = ESTADO_LABEL[estado] || ESTADO_LABEL.pendiente;
      tr.innerHTML = `
        <td>${fecha}</td>
        <td>${stale ? '🔴 ' : ''}${fmtAntiguedad(dias)}</td>
        <td><span class="badge">${o.numero}</span></td>
        <td>${o.cliente || ''}</td>
        <td>${o.obra || ''}</td>
        <td><span class="badge-estado ${estado}">${est.icon} ${est.text}</span></td>
        <td class="num">${money(o.importeTotal || (o.totales && o.totales.total) || 0)}</td>
        <td><button class="btn btn-sm btn-open">Abrir</button></td>
      `;
      tr.querySelector('.btn-open').addEventListener('click', () => cargarOferta(o.numero));
      body.appendChild(tr);
    });
  }

  document.getElementById('regSearch').addEventListener('input', (e) => renderRegistro(e.target.value));
  document.getElementById('btnRefreshReg').addEventListener('click', () => renderRegistro(document.getElementById('regSearch').value));
  document.getElementById('regFiltroEstado').addEventListener('change', () => renderRegistro(document.getElementById('regSearch').value));
  document.getElementById('regSoloPendientes').addEventListener('change', () => renderRegistro(document.getElementById('regSearch').value));

  // ---------- ajustes ----------
  let currentLogoDataUrl = null; // null = usar el logo por defecto (Disano)

  function updateLogoPreview() {
    const img = document.getElementById('logoPreview');
    img.src = currentLogoDataUrl || DEFAULT_LOGO_DATAURL;
    img.style.display = 'inline-block';
  }

  function loadAjustesUI() {
    const cfg = Store.getConfig();
    if (cfg) document.getElementById('firebaseConfigInput').value = JSON.stringify(cfg, null, 2);
    const company = Store.getCompany();
    document.getElementById('cfg-empresa').value = company.empresa || '';
    document.getElementById('cfg-cif').value = company.cif || '';
    document.getElementById('cfg-telefono').value = company.telefono || '';
    document.getElementById('cfg-direccion').value = company.direccion || '';
    document.getElementById('cfg-email').value = company.email || '';
    document.getElementById('cfg-validez').value = company.validez || 30;
    document.getElementById('cfg-iva').value = company.iva || 21;
    document.getElementById('cfg-iva').dispatchEvent(new Event('change'));
    if (company.empresa) document.getElementById('companyNameTag').textContent = company.empresa;
    currentLogoDataUrl = company.logo || null;
    updateLogoPreview();
  }

  document.getElementById('cfg-logo').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      currentLogoDataUrl = reader.result;
      updateLogoPreview();
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('btnLogoDefault').addEventListener('click', () => {
    currentLogoDataUrl = null;
    document.getElementById('cfg-logo').value = '';
    updateLogoPreview();
  });

  document.getElementById('btnSaveConfig').addEventListener('click', async () => {
    const raw = document.getElementById('firebaseConfigInput').value.trim();
    if (!raw) return toast('Pega primero la configuración de Firebase.');
    try {
      const cfg = JSON.parse(raw);
      await Store.saveConfig(cfg);
      toast('Configuración guardada.');
    } catch (err) {
      toast('JSON inválido: revisa el formato.');
    }
  });
  document.getElementById('btnClearConfig').addEventListener('click', () => {
    if (confirm('¿Quitar la sincronización y volver a modo local?')) Store.clearConfig();
  });

  document.getElementById('btnSaveCompany').addEventListener('click', () => {
    const company = {
      empresa: document.getElementById('cfg-empresa').value.trim(),
      cif: document.getElementById('cfg-cif').value.trim(),
      telefono: document.getElementById('cfg-telefono').value.trim(),
      direccion: document.getElementById('cfg-direccion').value.trim(),
      email: document.getElementById('cfg-email').value.trim(),
      validez: num(document.getElementById('cfg-validez').value),
      iva: num(document.getElementById('cfg-iva').value),
      logo: currentLogoDataUrl || null
    };
    Store.saveCompany(company);
    if (company.empresa) document.getElementById('companyNameTag').textContent = company.empresa;
    toast('Datos de empresa guardados.');
  });

  // ---------- botones principales ----------
  document.getElementById('btnAddLine').addEventListener('click', () => addLine());
  document.getElementById('btnGuardar').addEventListener('click', guardarOferta);
  document.getElementById('btnPDF').addEventListener('click', generarPDF);
  document.getElementById('btnNueva').addEventListener('click', () => {
    if (confirm('¿Empezar una oferta nueva en blanco? Se perderán los cambios no guardados.')) nuevaOferta();
  });
  document.getElementById('btnEliminar').addEventListener('click', eliminarOferta);
  document.getElementById('btnDuplicar').addEventListener('click', duplicarOferta);
  document.getElementById('f-dtogeneral').addEventListener('change', () => {
    // aplica el nuevo % por defecto solo a líneas que aún no se han tocado manualmente
  });
  document.getElementById('cfg-iva').addEventListener('change', recalcAll);

  // ---------- arranque ----------
  async function boot() {
    await Catalog.load();
    await Store.init();
    Store.onChange(() => {
      if (document.getElementById('view-registro').classList.contains('active')) {
        renderRegistro(document.getElementById('regSearch').value);
      }
    });
    loadAjustesUI();
    nuevaOferta();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  boot();
})();
