import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { MongoClient } from 'mongodb';
import PDFDocument from 'pdfkit';
import path from 'path';

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || 'garment_erp';
const JWT_SECRET = process.env.JWT_SECRET || 'garment_erp_jwt_secret_2025';

const FONT_REGULAR = path.join(process.cwd(), 'public', 'fonts', 'LiberationSans-Regular.ttf');
const FONT_BOLD = path.join(process.cwd(), 'public', 'fonts', 'LiberationSans-Bold.ttf');

async function getDB() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  return { db: client.db(DB_NAME), client };
}

function authUser(req) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtNum(n) {
  return (n || 0).toLocaleString('id-ID');
}

// ─── Create PDF document with TTF fonts ─────────────────────────────────────
function createPDFDoc() {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 60, left: 50, right: 50 },
    bufferPages: true,
    autoFirstPage: true,
  });
  try {
    doc.registerFont('Regular', FONT_REGULAR);
    doc.registerFont('Bold', FONT_BOLD);
    doc.font('Regular');
  } catch (e) {
    // fallback to built-in font if TTF not available
    console.warn('TTF font not found, using Helvetica fallback:', e.message);
  }
  return doc;
}

// ─── Helper to collect PDF buffer ───────────────────────────────────────────
function collectBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

// ─── PDF Builder helpers ─────────────────────────────────────────────────────

function addHeader(doc, title, docNumber, date, companySettings = {}) {
  const companyName = companySettings.company_name || 'PT Garment ERP System';
  const line1 = companySettings.pdf_header_line1 || 'Sistem Manajemen Produksi Garmen';
  const line2 = companySettings.pdf_header_line2;
  const addr = companySettings.company_address;
  const contact = [companySettings.company_phone, companySettings.company_email].filter(Boolean).join(' | ');

  try { doc.font('Bold'); } catch (e) { /* ignore */ }
  doc.fontSize(16).fillColor('#1e3a5f').text(companyName, { align: 'center' });
  try { doc.font('Regular'); } catch (e) { /* ignore */ }
  doc.fontSize(9).fillColor('#666').text(line1, { align: 'center' });
  if (line2) doc.fontSize(8).fillColor('#888').text(line2, { align: 'center' });
  if (addr) doc.fontSize(8).fillColor('#888').text(addr, { align: 'center' });
  if (contact) doc.fontSize(8).fillColor('#888').text(contact, { align: 'center' });
  doc.moveDown(0.4);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(2).strokeColor('#1e3a5f').stroke();
  doc.moveDown(0.5);

  try { doc.font('Bold'); } catch (e) { /* ignore */ }
  doc.fontSize(13).fillColor('#1e3a5f').text(title, { align: 'center' });
  try { doc.font('Regular'); } catch (e) { /* ignore */ }
  doc.moveDown(0.2);
  doc.fontSize(9).fillColor('#555');
  doc.text(`No. Dokumen: ${docNumber}`, { align: 'center' });
  doc.text(`Tanggal: ${date}`, { align: 'center' });
  doc.moveDown(0.6);
}

function addInfoBlock(doc, rows) {
  const startY = doc.y;
  rows.forEach((row, i) => {
    const y = startY + (i * 17);
    try { doc.font('Bold'); } catch (e) { /* ignore */ }
    doc.fontSize(9).fillColor('#444').text(row[0] + ':', 50, y, { width: 140 });
    try { doc.font('Regular'); } catch (e) { /* ignore */ }
    doc.fontSize(9).fillColor('#222').text(row[1] || '-', 195, y, { width: 350 });
  });
  doc.y = startY + rows.length * 17 + 10;
}

function addTable(doc, headers, rows, colWidths) {
  const startX = 50;
  let y = doc.y + 5;
  const rowHeight = 18;
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  // Header row
  doc.rect(startX, y, totalWidth, rowHeight).fillColor('#1e3a5f').fill();
  try { doc.font('Bold'); } catch (e) { /* ignore */ }
  doc.fontSize(8).fillColor('#ffffff');
  let x = startX;
  headers.forEach((h, i) => {
    doc.text(h, x + 3, y + 4, { width: colWidths[i] - 6, align: i === 0 ? 'left' : 'center' });
    x += colWidths[i];
  });

  try { doc.font('Regular'); } catch (e) { /* ignore */ }
  // Data rows
  rows.forEach((row, rowIdx) => {
    y += rowHeight;
    if (y + rowHeight > doc.page.height - 80) {
      doc.addPage();
      y = 50;
      // Redraw header
      doc.rect(startX, y, totalWidth, rowHeight).fillColor('#1e3a5f').fill();
      try { doc.font('Bold'); } catch (e) { /* ignore */ }
      doc.fontSize(8).fillColor('#ffffff');
      let hx = startX;
      headers.forEach((h, i) => {
        doc.text(h, hx + 3, y + 4, { width: colWidths[i] - 6, align: i === 0 ? 'left' : 'center' });
        hx += colWidths[i];
      });
      try { doc.font('Regular'); } catch (e) { /* ignore */ }
      y += rowHeight;
    }

    const bgColor = rowIdx % 2 === 0 ? '#ffffff' : '#f5f8fc';
    doc.rect(startX, y, totalWidth, rowHeight).fillColor(bgColor).fill();
    doc.rect(startX, y, totalWidth, rowHeight).strokeColor('#dde3ea').lineWidth(0.5).stroke();

    doc.fontSize(8).fillColor('#222');
    x = startX;
    row.forEach((cell, i) => {
      doc.text(String(cell == null ? '-' : cell), x + 3, y + 4, { width: colWidths[i] - 6, align: i === 0 ? 'left' : 'center' });
      x += colWidths[i];
    });
  });

  doc.y = y + rowHeight + 8;
}

function addFooter(doc, companySettings = {}) {
  const footerText = companySettings.pdf_footer_text || 'Dokumen ini dicetak secara otomatis oleh sistem';
  const companyName = companySettings.company_name || 'PT Garment ERP System';
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor('#999')
      .text(`Halaman ${i + 1} dari ${pageCount}   |   Dicetak: ${fmtDate(new Date())}   |   ${companyName}`,
        50, doc.page.height - 35, { align: 'center', width: 495 });
    doc.moveTo(50, doc.page.height - 45).lineTo(545, doc.page.height - 45).lineWidth(0.5).strokeColor('#ccc').stroke();
    if (footerText) {
      doc.fontSize(7).fillColor('#bbb').text(footerText, 50, doc.page.height - 25, { align: 'center', width: 495 });
    }
  }
}

function addSignatureArea(doc, signatories) {
  if (doc.y > 650) doc.addPage();
  doc.moveDown(1.2);
  try { doc.font('Bold'); } catch (e) { /* ignore */ }
  doc.fontSize(9).fillColor('#333').text('Tanda Tangan / Persetujuan:', 50);
  try { doc.font('Regular'); } catch (e) { /* ignore */ }
  doc.moveDown(0.3);

  const sigWidth = 495 / signatories.length;
  const startX = 50;
  const y = doc.y;

  signatories.forEach((sig, i) => {
    const x = startX + i * sigWidth;
    try { doc.font('Bold'); } catch (e) { /* ignore */ }
    doc.fontSize(9).fillColor('#1e3a5f').text(sig.role, x, y, { width: sigWidth, align: 'center' });
    try { doc.font('Regular'); } catch (e) { /* ignore */ }
    doc.y = y;
    doc.rect(x + 8, y + 14, sigWidth - 16, 55).strokeColor('#bbb').lineWidth(0.5).stroke();
    doc.fontSize(8).fillColor('#999').text('( ___________________ )', x + 8, y + 72, { width: sigWidth - 16, align: 'center' });
  });
  doc.y = y + 95;
}

// ─── Export handlers ──────────────────────────────────────────────────────────

async function exportProductionPO(db, id, companySettings) {
  const po = await db.collection('production_pos').findOne({ id });
  if (!po) return null;
  const items = await db.collection('po_items').find({ po_id: id }).toArray();

  const doc = createPDFDoc();
  const bufferPromise = collectBuffer(doc);

  addHeader(doc, 'SURAT PERINTAH PRODUKSI (SPP)', po.po_number || id, fmtDate(po.po_date || po.created_at), companySettings);

  addInfoBlock(doc, [
    ['Nomor PO', po.po_number || '-'],
    ['Vendor / Penjahit', po.vendor_name || '-'],
    ['Customer / Pembeli', po.customer_name || '-'],
    ['Deadline Produksi', fmtDate(po.deadline)],
    ['Deadline Pengiriman', fmtDate(po.delivery_deadline)],
    ['Status', po.status || '-'],
    ['Catatan', po.notes || '-'],
  ]);

  doc.moveDown(0.4);
  try { doc.font('Bold'); } catch (e) { /* ignore */ }
  doc.fontSize(10).fillColor('#1e3a5f').text('Daftar Item Produksi:');
  try { doc.font('Regular'); } catch (e) { /* ignore */ }
  doc.moveDown(0.2);

  addTable(doc,
    ['No. Seri', 'SKU', 'Nama Produk', 'Size', 'Warna', 'Qty Order'],
    items.map((item, idx) => [
      item.serial_number || String(idx + 1),
      item.sku || '-',
      item.product_name || '-',
      item.size || '-',
      item.color || '-',
      fmtNum(item.qty)
    ]),
    [70, 75, 155, 50, 65, 80]
  );

  const totalQty = items.reduce((s, i) => s + (i.qty || 0), 0);
  try { doc.font('Bold'); } catch (e) { /* ignore */ }
  doc.fontSize(9).fillColor('#1e3a5f').text(`Total Qty: ${fmtNum(totalQty)} pcs`, { align: 'right' });
  try { doc.font('Regular'); } catch (e) { /* ignore */ }

  addSignatureArea(doc, [{ role: 'Admin / Pembuat' }, { role: 'Manajer Produksi' }, { role: 'Vendor / Penjahit' }]);
  addFooter(doc, companySettings);
  doc.end();

  const buffer = await bufferPromise;
  return { buffer, filename: `SPP-${po.po_number || id}.pdf` };
}

async function exportVendorShipment(db, id, companySettings) {
  const shipment = await db.collection('vendor_shipments').findOne({ id });
  if (!shipment) return null;
  const items = await db.collection('vendor_shipment_items').find({ shipment_id: id }).toArray();

  const enrichedItems = await Promise.all(items.map(async si => {
    const poItem = si.po_item_id ? await db.collection('po_items').findOne({ id: si.po_item_id }) : null;
    return { ...si, serial_number: poItem?.serial_number || si.serial_number || '-' };
  }));

  const doc = createPDFDoc();
  const bufferPromise = collectBuffer(doc);

  const typeLabel = shipment.shipment_type === 'ADDITIONAL' ? 'TAMBAHAN'
    : shipment.shipment_type === 'REPLACEMENT' ? 'PENGGANTI' : 'NORMAL';
  addHeader(doc, `SURAT JALAN MATERIAL VENDOR (${typeLabel})`, shipment.shipment_number || id, fmtDate(shipment.shipment_date || shipment.created_at), companySettings);

  addInfoBlock(doc, [
    ['No. Shipment', shipment.shipment_number || '-'],
    ['Tipe Shipment', shipment.shipment_type || 'NORMAL'],
    ['Vendor / Penjahit', shipment.vendor_name || '-'],
    ['Tanggal Kirim', fmtDate(shipment.shipment_date)],
    ['No. Surat Jalan', shipment.delivery_note_number || '-'],
    ['Status', shipment.status || '-'],
    ['Status Inspeksi', shipment.inspection_status || 'Pending'],
    ['Catatan', shipment.notes || '-'],
  ]);

  doc.moveDown(0.4);
  try { doc.font('Bold'); } catch (e) { /* ignore */ }
  doc.fontSize(10).fillColor('#1e3a5f').text('Daftar Material:');
  try { doc.font('Regular'); } catch (e) { /* ignore */ }
  doc.moveDown(0.2);

  addTable(doc,
    ['No. Seri', 'SKU', 'Nama Material', 'Size', 'Warna', 'Qty Kirim'],
    enrichedItems.map((item, idx) => [
      item.serial_number || String(idx + 1),
      item.sku || '-',
      item.product_name || '-',
      item.size || '-',
      item.color || '-',
      fmtNum(item.qty_sent)
    ]),
    [70, 75, 150, 50, 65, 85]
  );

  const totalQty = items.reduce((s, i) => s + (i.qty_sent || 0), 0);
  try { doc.font('Bold'); } catch (e) { /* ignore */ }
  doc.fontSize(9).fillColor('#1e3a5f').text(`Total Qty: ${fmtNum(totalQty)} pcs`, { align: 'right' });
  try { doc.font('Regular'); } catch (e) { /* ignore */ }

  addSignatureArea(doc, [{ role: 'Gudang / Pengirim' }, { role: 'Admin' }, { role: 'Vendor / Penerima' }]);
  addFooter(doc, companySettings);
  doc.end();

  const buffer = await bufferPromise;
  return { buffer, filename: `SJ-Material-${shipment.shipment_number || id}.pdf` };
}

async function exportBuyerShipment(db, id, companySettings) {
  const shipment = await db.collection('buyer_shipments').findOne({ id });
  if (!shipment) return null;
  const items = await db.collection('buyer_shipment_items').find({ shipment_id: id }).toArray();

  const doc = createPDFDoc();
  const bufferPromise = collectBuffer(doc);

  addHeader(doc, 'SURAT JALAN PENGIRIMAN KE BUYER', shipment.shipment_number || id, fmtDate(shipment.shipment_date || shipment.created_at), companySettings);

  addInfoBlock(doc, [
    ['No. Shipment', shipment.shipment_number || '-'],
    ['Buyer / Customer', shipment.buyer_name || shipment.customer_name || '-'],
    ['Referensi PO', shipment.po_number || '-'],
    ['Tanggal Kirim', fmtDate(shipment.shipment_date)],
    ['Status', shipment.status || '-'],
    ['Catatan', shipment.notes || '-'],
  ]);

  doc.moveDown(0.4);
  try { doc.font('Bold'); } catch (e) { /* ignore */ }
  doc.fontSize(10).fillColor('#1e3a5f').text('Daftar Produk:');
  try { doc.font('Regular'); } catch (e) { /* ignore */ }
  doc.moveDown(0.2);

  addTable(doc,
    ['No. Seri', 'SKU', 'Nama Produk', 'Size', 'Warna', 'Qty Kirim'],
    items.map((item, idx) => [
      item.serial_number || String(idx + 1),
      item.sku || '-',
      item.product_name || '-',
      item.size || '-',
      item.color || '-',
      fmtNum(item.qty_shipped)
    ]),
    [70, 75, 150, 50, 65, 85]
  );

  const totalQty = items.reduce((s, i) => s + (i.qty_shipped || 0), 0);
  try { doc.font('Bold'); } catch (e) { /* ignore */ }
  doc.fontSize(9).fillColor('#1e3a5f').text(`Total Qty: ${fmtNum(totalQty)} pcs`, { align: 'right' });
  try { doc.font('Regular'); } catch (e) { /* ignore */ }

  addSignatureArea(doc, [{ role: 'Gudang / Pengirim' }, { role: 'Admin' }, { role: 'Buyer / Penerima' }]);
  addFooter(doc, companySettings);
  doc.end();

  const buffer = await bufferPromise;
  return { buffer, filename: `SJ-Buyer-${shipment.shipment_number || id}.pdf` };
}

async function exportMaterialRequest(db, id, companySettings) {
  const request = await db.collection('material_requests').findOne({ id });
  if (!request) return null;

  const shipment = request.shipment_id ? await db.collection('vendor_shipments').findOne({ id: request.shipment_id }) : null;
  const inspection = shipment ? await db.collection('vendor_material_inspections').findOne({ shipment_id: shipment.id }) : null;
  const inspItems = inspection ? await db.collection('vendor_material_inspection_items').find({ inspection_id: inspection.id }).toArray() : [];

  const doc = createPDFDoc();
  const bufferPromise = collectBuffer(doc);

  const typeLabel = request.request_type === 'ADDITIONAL' ? 'MATERIAL TAMBAHAN' : 'PENGGANTI MATERIAL CACAT';
  const docNum = request.request_number || id.slice(0, 8).toUpperCase();
  addHeader(doc, `SURAT PERMOHONAN ${typeLabel}`, docNum, fmtDate(request.created_at), companySettings);

  addInfoBlock(doc, [
    ['No. Permintaan', request.request_number || '-'],
    ['Tipe Permintaan', request.request_type || '-'],
    ['Vendor / Pemohon', request.vendor_name || '-'],
    ['Shipment Referensi', shipment?.shipment_number || '-'],
    ['Tanggal Inspeksi', fmtDate(inspection?.created_at)],
    ['Status', request.status || 'Pending'],
    ['Keterangan', request.notes || '-'],
  ]);

  doc.moveDown(0.4);
  try { doc.font('Bold'); } catch (e) { /* ignore */ }
  doc.fontSize(10).fillColor('#1e3a5f').text('Detail Material:');
  try { doc.font('Regular'); } catch (e) { /* ignore */ }
  doc.moveDown(0.2);

  if (inspItems.length > 0) {
    addTable(doc,
      ['SKU', 'Nama Material', 'Qty Order', 'Qty Diterima', 'Qty Kurang'],
      inspItems.map(item => [
        item.sku || '-',
        item.product_name || '-',
        fmtNum(item.ordered_qty || item.qty_sent),
        fmtNum(item.received_qty),
        fmtNum(item.missing_qty)
      ]),
      [80, 175, 75, 85, 80]
    );
  } else if (request.sku) {
    addTable(doc,
      ['SKU', 'Qty Diminta', 'Alasan'],
      [[request.sku, fmtNum(request.requested_qty), request.reason || '-']],
      [100, 100, 295]
    );
  }

  addSignatureArea(doc, [{ role: 'Vendor QC' }, { role: 'Manajer Vendor' }, { role: 'Admin ERP' }]);
  addFooter(doc, companySettings);
  doc.end();

  const buffer = await bufferPromise;
  return { buffer, filename: `Permohonan-${request.request_type}-${docNum}.pdf` };
}

async function exportProductionReturn(db, id, companySettings) {
  const ret = await db.collection('production_returns').findOne({ id });
  if (!ret) return null;
  const items = await db.collection('production_return_items').find({ return_id: id }).toArray();

  const doc = createPDFDoc();
  const bufferPromise = collectBuffer(doc);

  addHeader(doc, 'SURAT RETUR PRODUKSI', ret.return_number || id, fmtDate(ret.return_date || ret.created_at), companySettings);

  addInfoBlock(doc, [
    ['No. Retur', ret.return_number || '-'],
    ['Vendor / Penjahit', ret.vendor_name || '-'],
    ['Referensi PO', ret.po_number || '-'],
    ['Tanggal Retur', fmtDate(ret.return_date)],
    ['Status', ret.status || '-'],
    ['Alasan', ret.reason || '-'],
    ['Catatan', ret.notes || '-'],
  ]);

  doc.moveDown(0.4);
  try { doc.font('Bold'); } catch (e) { /* ignore */ }
  doc.fontSize(10).fillColor('#1e3a5f').text('Detail Item Retur:');
  try { doc.font('Regular'); } catch (e) { /* ignore */ }
  doc.moveDown(0.2);

  addTable(doc,
    ['No. Seri', 'SKU', 'Nama Produk', 'Size', 'Warna', 'Qty Retur'],
    items.map((item, idx) => [
      item.serial_number || String(idx + 1),
      item.sku || '-',
      item.product_name || '-',
      item.size || '-',
      item.color || '-',
      fmtNum(item.qty || item.return_qty)
    ]),
    [70, 75, 150, 50, 65, 85]
  );

  const totalQty = items.reduce((s, i) => s + (i.qty || i.return_qty || 0), 0);
  try { doc.font('Bold'); } catch (e) { /* ignore */ }
  doc.fontSize(9).fillColor('#1e3a5f').text(`Total Qty Retur: ${fmtNum(totalQty)} pcs`, { align: 'right' });
  try { doc.font('Regular'); } catch (e) { /* ignore */ }

  addSignatureArea(doc, [{ role: 'Vendor / Pengirim' }, { role: 'QC Admin' }, { role: 'Manajer Produksi' }]);
  addFooter(doc, companySettings);
  doc.end();

  const buffer = await bufferPromise;
  return { buffer, filename: `Retur-${ret.return_number || id}.pdf` };
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(req) {
  const user = authUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  const id = url.searchParams.get('id');

  if (!type || !id) return NextResponse.json({ error: 'Parameter type dan id diperlukan' }, { status: 400 });

  let client;
  try {
    const conn = await getDB();
    client = conn.client;
    const db = conn.db;

    let result = null;
    // Fetch company settings for PDF header
    const companySettings = await db.collection('company_settings').findOne({ type: 'general' }) || {};
    
    switch (type) {
      case 'production-po':      result = await exportProductionPO(db, id, companySettings);      break;
      case 'vendor-shipment':    result = await exportVendorShipment(db, id, companySettings);    break;
      case 'buyer-shipment':     result = await exportBuyerShipment(db, id, companySettings);     break;
      case 'material-request':   result = await exportMaterialRequest(db, id, companySettings);   break;
      case 'production-return':  result = await exportProductionReturn(db, id, companySettings);  break;
      default:
        return NextResponse.json({ error: 'Tipe ekspor tidak dikenal' }, { status: 400 });
    }

    if (!result) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 });

    return new Response(result.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Content-Length': String(result.buffer.length),
      }
    });
  } catch (err) {
    console.error('[export-pdf] Error:', err);
    return NextResponse.json({ error: 'Gagal membuat PDF: ' + err.message }, { status: 500 });
  } finally {
    if (client) await client.close();
  }
}
