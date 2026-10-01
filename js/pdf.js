/* pdf.js — genera el PDF del presupuesto con formato profesional */

const PDFGen = (() => {

  function fmtMoney(n) {
    return (Number(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
  function fmtDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('es-ES');
  }

  function generate(oferta, totals) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const company = Store.getCompany();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 40;
    // Colores corporativos Disano Iluminación (muestreados del logo)
    const amber = [219, 150, 0];
    const ink = [33, 25, 21];
    const gray = [120, 113, 106];

    // ---- Cabecera ----
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageW, 96, 'F');
    doc.setDrawColor(...amber);
    doc.setLineWidth(2.2);
    doc.line(0, 96, pageW, 96);

    const logoDataUrl = company.logo || (typeof DEFAULT_LOGO_DATAURL !== 'undefined' ? DEFAULT_LOGO_DATAURL : null);
    if (logoDataUrl) {
      // el logo original es 1920x1080 (relación 16:9)
      const logoH = 46;
      const logoW = logoH * (1920 / 1080);
      doc.addImage(logoDataUrl, 'PNG', margin, 26, logoW, logoH);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(...ink);
      doc.text(company.empresa || 'Tu Empresa', margin, 50);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...gray);
    const infoLines = [
      [company.direccion].filter(Boolean).join(''),
      [company.telefono, company.email].filter(Boolean).join('  ·  '),
      company.cif ? ('CIF: ' + company.cif) : ''
    ].filter(Boolean);
    doc.text(infoLines, margin, 82);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...ink);
    doc.text('PRESUPUESTO', pageW - margin, 42, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...amber);
    doc.text('Nº ' + (oferta.numero || ''), pageW - margin, 58, { align: 'right' });
    doc.setTextColor(...gray);
    doc.text('Fecha: ' + fmtDate(oferta.fecha), pageW - margin, 72, { align: 'right' });

    // ---- Datos cliente / obra ----
    let y = 118;
    doc.setTextColor(...ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('CLIENTE', margin, y);
    doc.text('OBRA', pageW / 2 + 10, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(oferta.cliente || '-', margin, y + 16);
    doc.text(oferta.obra || '-', pageW / 2 + 10, y + 16);

    doc.setDrawColor(225, 222, 214);
    doc.line(margin, y + 30, pageW - margin, y + 30);

    // ---- Tabla de líneas ----
    const lineasValidas = (oferta.lineas || []).filter(l => l.codigo || l.desc);
    const rows = lineasValidas.map((l, i) => [
      String(i + 1),
      String(l.cant ?? ''),
      l.codigo || '',
      l.desc || '',
      fmtMoney(l.netoUd),
      fmtMoney(l.subtotal)
    ]);

    doc.autoTable({
      startY: y + 42,
      head: [['#', 'Cant.', 'Código', 'Descripción', 'Precio/ud', 'Subtotal']],
      body: rows,
      margin: { left: margin, right: margin },
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 6, textColor: ink },
      headStyles: { fillColor: ink, textColor: amber, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [246, 244, 238] },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 45, halign: 'right' },
        2: { cellWidth: 75, textColor: amber },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 75, halign: 'right' },
        5: { cellWidth: 80, halign: 'right' }
      },
      didDrawCell: (data) => {
        // columna 2 = Código: si el producto tiene ficha técnica, lo convertimos en enlace clicable
        if (data.section === 'body' && data.column.index === 2) {
          const linea = lineasValidas[data.row.index];
          if (linea && linea.ficha) {
            doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: linea.ficha });
          }
        }
      }
    });

    let finalY = doc.lastAutoTable.finalY + 20;

    // salto de página si no cabe el bloque de totales
    if (finalY > doc.internal.pageSize.getHeight() - 160) {
      doc.addPage();
      finalY = 50;
    }

    // ---- Totales ----
    const boxW = 220;
    const boxX = pageW - margin - boxW;
    const totalLines = [
      ['Neto sin RAEE ni IVA', fmtMoney(totals.neto)],
      ['RAEE', fmtMoney(totals.raee)],
      ['Base imponible', fmtMoney(totals.base)],
      [`IVA (${totals.ivaPct}%)`, fmtMoney(totals.iva)]
    ];
    doc.setFontSize(9.5);
    doc.setTextColor(...gray);
    let ty = finalY;
    totalLines.forEach(([label, val]) => {
      doc.text(label, boxX, ty);
      doc.text(val, boxX + boxW, ty, { align: 'right' });
      ty += 15;
    });
    doc.setDrawColor(...amber);
    doc.setLineWidth(1);
    doc.line(boxX, ty, boxX + boxW, ty);
    ty += 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...ink);
    doc.text('TOTAL', boxX, ty);
    doc.setTextColor(...amber);
    doc.text(fmtMoney(totals.total), boxX + boxW, ty, { align: 'right' });

    // ---- Condiciones ----
    let cy = ty + 34;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...gray);
    const validez = company.validez || 30;
    const condiciones = [
      `Oferta válida durante ${validez} días desde la fecha de emisión.`,
      'Precios sujetos a modificación sin previo aviso salvo pedido en firme.',
      'IVA no incluido en los precios unitarios, se aplica en el total.',
      'Haz clic sobre el código de un producto para abrir su ficha técnica.'
    ];
    condiciones.forEach(line => { doc.text(line, margin, cy); cy += 12; });

    // ---- Pie ----
    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      const h = doc.internal.pageSize.getHeight();
      doc.setDrawColor(225, 222, 214);
      doc.line(margin, h - 36, pageW - margin, h - 36);
      doc.setFontSize(8);
      doc.setTextColor(...gray);
      doc.text(company.empresa || '', margin, h - 22);
      doc.text(`Página ${p} de ${pageCount}`, pageW - margin, h - 22, { align: 'right' });
    }

    function slug(str) {
      return (str || '')
        .toString()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // sin acentos
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40);
    }
    const partes = [oferta.numero || 'oferta', slug(oferta.cliente), slug(oferta.obra)].filter(Boolean);
    const filename = `Presupuesto_${partes.join('_')}.pdf`;
    doc.save(filename);
  }

  return { generate };
})();
