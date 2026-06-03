const { Op } = require('sequelize');
const {
  ProcurementDraft,
  ProcurementItem,
  ProcurementReceipt,
  Inventory,
  Bhp,
  User
} = require('../models');
const {
  formatRupiah,
  drawHeader,
  drawSection,
  drawKeyValues,
  drawTable,
  streamPdf
} = require('../utils/pdfReport');

function getReceivedTotal(item) {
  return (item.receipts || []).reduce(
    (total, receipt) => total + Number(receipt.quantity_received || 0),
    0
  );
}

function getLabeledTotal(item) {
  return item.receivedInventories ? item.receivedInventories.length : 0;
}

function pdfFilename(prefix) {
  const date = new Date().toISOString().slice(0, 10);
  return `${prefix}-${date}.pdf`;
}

function statusLabel(status) {
  const map = {
    Draft: 'Draft',
    Submitted: 'Diajukan',
    Locked: 'Menunggu Finalisasi',
    Approved: 'Disetujui',
    Rejected: 'Ditolak'
  };
  return map[status] || status || '-';
}

function itemStatusLabel(status) {
  const map = {
    Approved: 'Disetujui',
    Rejected: 'Ditolak',
    Pending: 'Menunggu'
  };
  return map[status] || status || '-';
}

exports.getLabHeadReportPdf = async (req, res, next) => {
  try {
    const user = req.session.user;
    const drafts = await ProcurementDraft.findAll({
      where: { lab_head_id: user.id },
      include: [{ model: ProcurementItem, as: 'items' }],
      order: [['year', 'DESC'], ['id', 'DESC']]
    });

    const statusCounts = {};
    let totalItems = 0;
    let totalValue = 0;

    drafts.forEach((draft) => {
      statusCounts[draft.status] = (statusCounts[draft.status] || 0) + 1;
      (draft.items || []).forEach((item) => {
        totalItems += 1;
        totalValue += Number(item.quantity || 0) * Number(item.price || 0);
      });
    });

    const draftRows = drafts.map((draft) => [
      String(draft.year || '-'),
      statusLabel(draft.status),
      String((draft.items || []).length),
      formatRupiah(
        (draft.items || []).reduce(
          (sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0),
          0
        )
      )
    ]);

    const itemRows = [];
    drafts.forEach((draft) => {
      (draft.items || []).forEach((item) => {
        itemRows.push([
          String(draft.year),
          item.item_name || '-',
          item.item_type || '-',
          String(item.quantity || 0),
          formatRupiah(item.price),
          itemStatusLabel(item.status)
        ]);
      });
    });

    streamPdf(res, pdfFilename('laporan-kepala-lab'), (doc) => {
      drawHeader(doc, {
        title: 'Laporan Pengadaan Laboratorium',
        subtitle: 'Kepala Laboratorium — Ringkasan Draf & Item Pengadaan',
        generatedBy: `${user.name} (${user.role})`
      });

      drawSection(doc, 'Ringkasan');
      drawKeyValues(doc, [
        ['Total Draf', String(drafts.length)],
        ['Total Item', String(totalItems)],
        ['Estimasi Nilai', formatRupiah(totalValue)],
        ['Draf Draft', String(statusCounts.Draft || 0)],
        ['Draf Diajukan', String(statusCounts.Submitted || 0)],
        ['Draf Terkunci', String(statusCounts.Locked || 0)],
        ['Draf Disetujui', String(statusCounts.Approved || 0)],
        ['Draf Ditolak', String(statusCounts.Rejected || 0)]
      ]);

      drawSection(doc, 'Daftar Draf Pengadaan');
      drawTable(
        doc,
        ['Tahun', 'Status', 'Jml Item', 'Nilai Estimasi'],
        draftRows,
        [70, 130, 80, 165]
      );

      drawSection(doc, 'Detail Item per Draf');
      drawTable(
        doc,
        ['Tahun', 'Nama Item', 'Tipe', 'Qty', 'Harga', 'Status Item'],
        itemRows,
        [45, 120, 55, 40, 85, 100]
      );

      doc.fontSize(8).fillColor('#888888').text(
        'Dokumen ini dihasilkan otomatis oleh Sistem Inventaris Laboratorium.',
        50,
        doc.page.height - 40,
        { align: 'center', width: doc.page.width - 100 }
      );
    });
  } catch (error) {
    next(error);
  }
};

exports.getKaprodiReportPdf = async (req, res, next) => {
  try {
    const user = req.session.user;
    const drafts = await ProcurementDraft.findAll({
      where: {
        status: { [Op.in]: ['Submitted', 'Locked', 'Approved', 'Rejected'] }
      },
      include: [
        { model: User, as: 'labHead' },
        { model: ProcurementItem, as: 'items' }
      ],
      order: [['year', 'DESC'], ['id', 'DESC']]
    });

    const pending = drafts.filter((d) => ['Submitted', 'Locked'].includes(d.status)).length;
    const approved = drafts.filter((d) => d.status === 'Approved').length;
    const rejected = drafts.filter((d) => d.status === 'Rejected').length;

    const draftRows = drafts.map((draft) => [
      String(draft.year || '-'),
      draft.labHead ? draft.labHead.name : '-',
      statusLabel(draft.status),
      String((draft.items || []).length),
      String((draft.items || []).filter((i) => i.status === 'Approved').length),
      String((draft.items || []).filter((i) => i.status === 'Rejected').length)
    ]);

    const reviewRows = [];
    drafts.forEach((draft) => {
      (draft.items || []).forEach((item) => {
        reviewRows.push([
          String(draft.year),
          draft.labHead ? draft.labHead.name : '-',
          item.item_name || '-',
          String(item.quantity || 0),
          formatRupiah(item.price),
          itemStatusLabel(item.status)
        ]);
      });
    });

    const totalInventories = await Inventory.count();
    const totalBhps = await Bhp.count();

    streamPdf(res, pdfFilename('laporan-kaprodi'), (doc) => {
      drawHeader(doc, {
        title: 'Laporan Validasi Pengadaan',
        subtitle: 'Ketua Program Studi — Status Review & Persetujuan Item',
        generatedBy: `${user.name} (${user.role})`
      });

      drawSection(doc, 'Ringkasan Validasi');
      drawKeyValues(doc, [
        ['Total Draf Direview', String(drafts.length)],
        ['Butuh Tindakan', String(pending)],
        ['Draf Disetujui', String(approved)],
        ['Draf Ditolak', String(rejected)],
        ['Total Inventaris Lab', String(totalInventories)],
        ['Total Stok BHP', String(totalBhps)]
      ]);

      drawSection(doc, 'Daftar Draf Pengadaan');
      drawTable(
        doc,
        ['Tahun', 'Kepala Lab', 'Status', 'Item', 'Setuju', 'Tolak'],
        draftRows,
        [50, 110, 110, 45, 55, 50]
      );

      drawSection(doc, 'Detail Item Pengadaan');
      drawTable(
        doc,
        ['Tahun', 'Kepala Lab', 'Item', 'Qty', 'Harga', 'Status'],
        reviewRows,
        [45, 95, 115, 40, 80, 75]
      );

      doc.fontSize(8).fillColor('#888888').text(
        'Dokumen ini dihasilkan otomatis oleh Sistem Inventaris Laboratorium.',
        50,
        doc.page.height - 40,
        { align: 'center', width: doc.page.width - 100 }
      );
    });
  } catch (error) {
    next(error);
  }
};

exports.getAdminStaffReportPdf = async (req, res, next) => {
  try {
    const user = req.session.user;
    const approvedDrafts = await ProcurementDraft.findAll({
      where: { status: 'Approved' },
      include: [
        { model: User, as: 'labHead' },
        {
          model: ProcurementItem,
          as: 'items',
          where: { status: 'Approved' },
          required: false,
          include: [
            { model: ProcurementReceipt, as: 'receipts' },
            { model: Inventory, as: 'receivedInventories' }
          ]
        }
      ],
      order: [['year', 'DESC'], ['id', 'DESC']]
    });

    const approvedItems = approvedDrafts.flatMap((draft) => draft.items || []);
    const totalRequested = approvedItems.reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    );
    const totalReceived = approvedItems.reduce(
      (total, item) => total + getReceivedTotal(item),
      0
    );
    const totalLabeled = approvedItems.reduce(
      (total, item) => total + getLabeledTotal(item),
      0
    );

    const draftRows = approvedDrafts.map((draft) => {
      const items = draft.items || [];
      const requested = items.reduce((t, item) => t + Number(item.quantity || 0), 0);
      const received = items.reduce((t, item) => t + getReceivedTotal(item), 0);
      const labeled = items.reduce((t, item) => t + getLabeledTotal(item), 0);
      return [
        String(draft.year),
        draft.labHead ? draft.labHead.name : '-',
        String(items.length),
        `${received} / ${requested}`,
        String(labeled),
        String(Math.max(received - labeled, 0))
      ];
    });

    const itemRows = approvedItems.map((item) => {
      const received = getReceivedTotal(item);
      const labeled = getLabeledTotal(item);
      return [
        item.item_name || '-',
        item.item_type || '-',
        String(item.quantity || 0),
        String(received),
        String(labeled),
        String(Math.max(received - labeled, 0))
      ];
    });

    const inventoryCount = await Inventory.count();
    const bhpCount = await Bhp.count();

    streamPdf(res, pdfFilename('laporan-staf-admin'), (doc) => {
      drawHeader(doc, {
        title: 'Laporan Administrasi Pengadaan',
        subtitle: 'Staf Administrasi — Penerimaan Barang & Input Inventaris',
        generatedBy: `${user.name} (${user.role})`
      });

      drawSection(doc, 'Ringkasan');
      drawKeyValues(doc, [
        ['Draf Disetujui', String(approvedDrafts.length)],
        ['Item Disetujui', String(approvedItems.length)],
        ['Qty Disetujui', String(totalRequested)],
        ['Barang Diterima', String(totalReceived)],
        ['Sudah Berlabel', String(totalLabeled)],
        ['Belum Berlabel', String(Math.max(totalReceived - totalLabeled, 0))],
        ['Total Inventaris', String(inventoryCount)],
        ['Jenis BHP Terdaftar', String(bhpCount)]
      ]);

      drawSection(doc, 'Progres per Draf Disetujui');
      drawTable(
        doc,
        ['Tahun', 'Kepala Lab', 'Item', 'Diterima', 'Label', 'Sisa'],
        draftRows,
        [50, 110, 45, 90, 55, 60]
      );

      drawSection(doc, 'Detail Item — Penerimaan & Label');
      drawTable(
        doc,
        ['Nama Item', 'Tipe', 'Disetujui', 'Diterima', 'Label', 'Sisa'],
        itemRows,
        [120, 55, 55, 55, 55, 60]
      );

      doc.fontSize(8).fillColor('#888888').text(
        'Dokumen ini dihasilkan otomatis oleh Sistem Inventaris Laboratorium.',
        50,
        doc.page.height - 40,
        { align: 'center', width: doc.page.width - 100 }
      );
    });
  } catch (error) {
    next(error);
  }
};
