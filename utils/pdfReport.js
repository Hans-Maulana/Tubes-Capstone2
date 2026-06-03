const PDFDocument = require('pdfkit');

function formatRupiah(value) {
  const num = Number(value || 0);
  return `Rp ${num.toLocaleString('id-ID')}`;
}

function formatDateId(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function formatDateTimeId(value = new Date()) {
  return new Date(value).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function truncateText(text, max = 42) {
  const value = String(text || '-');
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function ensureSpace(doc, needed = 60) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function drawHeader(doc, { title, subtitle, generatedBy }) {
  doc.fontSize(18).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(11).font('Helvetica').fillColor('#444444').text(subtitle, { align: 'center' });
  doc.moveDown(0.8);
  doc.fontSize(10).fillColor('#666666')
    .text(`Dicetak: ${formatDateTimeId()}`, { align: 'left' })
    .text(`Oleh: ${generatedBy || '-'}`, { align: 'left' });
  doc.moveDown(1);
  doc.strokeColor('#dddddd').moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
  doc.moveDown(0.8);
  doc.fillColor('#000000');
}

function drawSection(doc, title) {
  ensureSpace(doc, 40);
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a4fd6').text(title);
  doc.moveDown(0.4);
  doc.fillColor('#000000');
}

function drawKeyValues(doc, rows) {
  rows.forEach(([label, value]) => {
    ensureSpace(doc, 20);
    doc.fontSize(10).font('Helvetica-Bold').text(`${label}:`, { continued: true });
    doc.font('Helvetica').text(` ${value || '-'}`);
  });
  doc.moveDown(0.6);
}

function drawTable(doc, headers, rows, columnWidths) {
  const startX = doc.page.margins.left;
  const rowHeight = 22;
  const tableWidth = columnWidths.reduce((sum, w) => sum + w, 0);

  function drawRow(cells, isHeader = false) {
    ensureSpace(doc, rowHeight + 10);
    const y = doc.y;
    let x = startX;

    cells.forEach((cell, index) => {
      const width = columnWidths[index];
      doc.rect(x, y, width, rowHeight).stroke('#dddddd');
      doc.fontSize(isHeader ? 9 : 8)
        .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor('#000000')
        .text(truncateText(cell, Math.floor(width / 5)), x + 4, y + 6, {
          width: width - 8,
          height: rowHeight - 8,
          ellipsis: true
        });
      x += width;
    });

    doc.y = y + rowHeight;
  }

  drawRow(headers, true);
  if (rows.length === 0) {
    drawRow(['Tidak ada data', ...headers.slice(1).map(() => '')]);
  } else {
    rows.forEach((row) => drawRow(row));
  }

  doc.moveDown(0.8);
}

function streamPdf(res, filename, build) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);
  build(doc);
  doc.end();
}

module.exports = {
  PDFDocument,
  formatRupiah,
  formatDateId,
  formatDateTimeId,
  drawHeader,
  drawSection,
  drawKeyValues,
  drawTable,
  streamPdf
};
