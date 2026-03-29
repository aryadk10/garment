import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import jwt from 'jsonwebtoken';
import * as XLSX from 'xlsx';

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || 'garment_erp';
const JWT_SECRET = process.env.JWT_SECRET || 'garment_erp_jwt_secret_2025';

let client = null;
let db = null;

async function getDb() {
  if (!client) {
    client = new MongoClient(MONGO_URL);
    await client.connect();
    db = client.db(DB_NAME);
  }
  return db;
}

function verifyToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
  } catch (e) { return null; }
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatCurrency(n) {
  if (!n && n !== 0) return '';
  return Number(n).toLocaleString('id-ID');
}

export async function GET(request) {
  const user = verifyToken(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const type = sp.get('type');
  if (!type) return NextResponse.json({ error: 'Tipe export wajib diisi' }, { status: 400 });

  const db = await getDb();

  try {
    let sheetData, fileName, sheetName;
    
    // Parse common filters
    const dateFrom = sp.get('date_from');
    const dateTo = sp.get('date_to');
    const vendorId = sp.get('vendor_id');
    const status = sp.get('status');

    switch (type) {
      case 'production-pos':
        ({ sheetData, fileName, sheetName } = await exportProductionPOs(db, user, { dateFrom, dateTo, vendorId, status }));
        break;
      case 'vendor-shipments':
        ({ sheetData, fileName, sheetName } = await exportVendorShipments(db, user, { dateFrom, dateTo, vendorId, status }));
        break;
      case 'buyer-shipments':
        ({ sheetData, fileName, sheetName } = await exportBuyerShipments(db, user, { dateFrom, dateTo, vendorId, status }));
        break;
      case 'report-production':
        ({ sheetData, fileName, sheetName } = await exportProductionReport(db, user, { dateFrom, dateTo, vendorId, status, poId: sp.get('po_id'), serialNumber: sp.get('serial_number') }));
        break;
      case 'report-financial':
        ({ sheetData, fileName, sheetName } = await exportFinancialReport(db, user, { dateFrom, dateTo, vendorId, status }));
        break;
      case 'report-shipment':
        ({ sheetData, fileName, sheetName } = await exportShipmentReport(db, user, { dateFrom, dateTo, vendorId, status }));
        break;
      case 'invoices':
        ({ sheetData, fileName, sheetName } = await exportInvoices(db, user, { dateFrom, dateTo, vendorId, status }));
        break;
      default:
        return NextResponse.json({ error: `Tipe export tidak dikenal: ${type}` }, { status: 400 });
    }

    // Generate Excel
    const ws = XLSX.utils.json_to_sheet(sheetData);
    
    // Auto-fit column widths
    if (sheetData.length > 0) {
      const keys = Object.keys(sheetData[0]);
      ws['!cols'] = keys.map(key => ({
        wch: Math.min(40, Math.max(key.length + 2, ...sheetData.slice(0, 50).map(r => String(r[key] || '').length + 2)))
      }));
    }
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Data');
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Export Excel error:', error);
    return NextResponse.json({ error: `Export gagal: ${error.message}` }, { status: 500 });
  }
}

// ─── EXPORT PRODUCTION POs ──────────────────────────────────────────────────
async function exportProductionPOs(db, user, filters) {
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.vendorId) query.vendor_id = filters.vendorId;
  if (filters.dateFrom || filters.dateTo) {
    query.created_at = {};
    if (filters.dateFrom) query.created_at.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) { const d = new Date(filters.dateTo); d.setHours(23,59,59,999); query.created_at.$lte = d; }
  }
  
  const pos = await db.collection('production_pos').find(query).sort({ created_at: -1 }).toArray();
  const sheetData = [];
  
  for (const po of pos) {
    const items = await db.collection('po_items').find({ po_id: po.id }).toArray();
    if (items.length === 0) {
      sheetData.push({
        'No': sheetData.length + 1,
        'Tanggal PO': formatDate(po.po_date || po.created_at),
        'Nomor PO': po.po_number,
        'Customer': po.customer_name || '',
        'Vendor': po.vendor_name || '',
        'Status': po.status || '',
        'Deadline': formatDate(po.deadline),
        'Deadline Pengiriman': formatDate(po.delivery_deadline),
        'No Seri': '',
        'SKU': '',
        'Nama Produk': '',
        'Size': '',
        'Warna': '',
        'Qty': 0,
        'Harga Jual': '',
        'Harga CMT': '',
        'Total Jual': '',
        'Total CMT': '',
        'Catatan': po.notes || '',
      });
    }
    for (const item of items) {
      sheetData.push({
        'No': sheetData.length + 1,
        'Tanggal PO': formatDate(po.po_date || po.created_at),
        'Nomor PO': po.po_number,
        'Customer': po.customer_name || '',
        'Vendor': po.vendor_name || '',
        'Status': po.status || '',
        'Deadline': formatDate(po.deadline),
        'Deadline Pengiriman': formatDate(po.delivery_deadline),
        'No Seri': item.serial_number || '',
        'SKU': item.sku || '',
        'Nama Produk': item.product_name || '',
        'Size': item.size || '',
        'Warna': item.color || '',
        'Qty': item.qty || 0,
        'Harga Jual': item.selling_price_snapshot || 0,
        'Harga CMT': item.cmt_price_snapshot || 0,
        'Total Jual': (item.qty || 0) * (item.selling_price_snapshot || 0),
        'Total CMT': (item.qty || 0) * (item.cmt_price_snapshot || 0),
        'Catatan': po.notes || '',
      });
    }
  }
  
  return { sheetData, fileName: `production_po_export_${new Date().toISOString().slice(0, 10)}.xlsx`, sheetName: 'Production PO' };
}

// ─── EXPORT VENDOR SHIPMENTS ────────────────────────────────────────────────
async function exportVendorShipments(db, user, filters) {
  const query = {};
  if (filters.vendorId) query.vendor_id = filters.vendorId;
  if (filters.status) query.status = filters.status;
  if (user.role === 'vendor') query.vendor_id = user.vendor_id;
  if (filters.dateFrom || filters.dateTo) {
    query.created_at = {};
    if (filters.dateFrom) query.created_at.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) { const d = new Date(filters.dateTo); d.setHours(23,59,59,999); query.created_at.$lte = d; }
  }
  
  const shipments = await db.collection('vendor_shipments').find(query).sort({ created_at: -1 }).toArray();
  const sheetData = [];
  
  for (const ship of shipments) {
    const items = await db.collection('vendor_shipment_items').find({ shipment_id: ship.id }).toArray();
    for (const item of items) {
      sheetData.push({
        'No': sheetData.length + 1,
        'Tanggal Kirim': formatDate(ship.shipment_date || ship.created_at),
        'No Shipment': ship.shipment_number || '',
        'No Surat Jalan': ship.delivery_note_number || '',
        'Tipe': ship.shipment_type || 'NORMAL',
        'Vendor': ship.vendor_name || '',
        'Status': ship.status || '',
        'Inspeksi': ship.inspection_status || 'Pending',
        'No PO': item.po_number || '',
        'No Seri': item.serial_number || '',
        'SKU': item.sku || '',
        'Nama Produk': item.product_name || '',
        'Size': item.size || '',
        'Warna': item.color || '',
        'Qty Kirim': item.qty_sent || 0,
        'Qty Order': item.ordered_qty || 0,
        'Catatan': ship.notes || '',
      });
    }
  }
  
  return { sheetData, fileName: `vendor_shipment_export_${new Date().toISOString().slice(0, 10)}.xlsx`, sheetName: 'Vendor Shipments' };
}

// ─── EXPORT BUYER SHIPMENTS ─────────────────────────────────────────────────
async function exportBuyerShipments(db, user, filters) {
  const query = {};
  if (filters.vendorId) query.vendor_id = filters.vendorId;
  if (user.role === 'vendor') query.vendor_id = user.vendor_id;
  if (filters.dateFrom || filters.dateTo) {
    query.created_at = {};
    if (filters.dateFrom) query.created_at.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) { const d = new Date(filters.dateTo); d.setHours(23,59,59,999); query.created_at.$lte = d; }
  }
  
  const shipments = await db.collection('buyer_shipments').find(query).sort({ created_at: -1 }).toArray();
  const sheetData = [];
  
  for (const ship of shipments) {
    const items = await db.collection('buyer_shipment_items').find({ shipment_id: ship.id }).sort({ dispatch_seq: 1 }).toArray();
    for (const item of items) {
      sheetData.push({
        'No': sheetData.length + 1,
        'Tanggal Dispatch': formatDate(item.dispatch_date || item.created_at),
        'No Shipment': ship.shipment_number || '',
        'Dispatch Ke': item.dispatch_seq || 1,
        'Vendor': ship.vendor_name || '',
        'No PO': ship.po_number || '',
        'Customer': ship.customer_name || '',
        'No Seri': item.serial_number || '',
        'SKU': item.sku || '',
        'Nama Produk': item.product_name || '',
        'Size': item.size || '',
        'Warna': item.color || '',
        'Qty Order': item.ordered_qty || 0,
        'Qty Kirim': item.qty_shipped || 0,
        'Status': ship.ship_status || '',
      });
    }
  }
  
  return { sheetData, fileName: `buyer_shipment_export_${new Date().toISOString().slice(0, 10)}.xlsx`, sheetName: 'Buyer Shipments' };
}

// ─── EXPORT PRODUCTION REPORT ───────────────────────────────────────────────
async function exportProductionReport(db, user, filters) {
  const poQuery = {};
  if (filters.poId) poQuery.id = filters.poId;
  if (filters.status) poQuery.status = filters.status;
  if (filters.dateFrom || filters.dateTo) {
    poQuery.created_at = {};
    if (filters.dateFrom) poQuery.created_at.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) { const d = new Date(filters.dateTo); d.setHours(23,59,59,999); poQuery.created_at.$lte = d; }
  }
  
  const pos = await db.collection('production_pos').find(poQuery).sort({ created_at: -1 }).toArray();
  const sheetData = [];
  
  for (const po of pos) {
    if (filters.vendorId && po.vendor_id !== filters.vendorId) continue;
    const items = await db.collection('po_items').find({ po_id: po.id }).toArray();
    
    for (const item of items) {
      if (filters.serialNumber && item.serial_number !== filters.serialNumber) continue;
      
      // Get production quantities
      const jobItems = await db.collection('production_job_items').find({ po_item_id: item.id }).toArray();
      let totalProduced = 0;
      for (const ji of jobItems) {
        totalProduced += ji.produced_qty || 0;
        const parentJob = await db.collection('production_jobs').findOne({ id: ji.job_id });
        if (parentJob) {
          const childJobs = await db.collection('production_jobs').find({ parent_job_id: parentJob.id }).toArray();
          for (const cj of childJobs) {
            const cji = await db.collection('production_job_items').findOne({ job_id: cj.id, po_item_id: item.id });
            if (cji) totalProduced += cji.produced_qty || 0;
          }
        }
      }
      
      const buyerItems = await db.collection('buyer_shipment_items').find({ po_item_id: item.id }).toArray();
      const totalShipped = buyerItems.reduce((s, b) => s + (b.qty_shipped || 0), 0);
      const garment = po.vendor_id ? await db.collection('garments').findOne({ id: po.vendor_id }) : null;
      
      sheetData.push({
        'No': sheetData.length + 1,
        'TANGGAL': formatDate(po.po_date || po.created_at),
        'NO-PO': po.po_number || '',
        'NO-SERI': item.serial_number || '',
        'KODE PRODUK': item.sku || '',
        'NAMA PRODUK': item.product_name || '',
        'KATEGORI': item.category || '',
        'SIZE': item.size || '',
        'SKU': item.sku || '',
        'WARNA': item.color || '',
        'OUTPUT QTY': item.qty || 0,
        'HARGA': item.selling_price_snapshot || 0,
        'HPP': item.cmt_price_snapshot || 0,
        'HASIL PO (Rp)': (item.qty || 0) * (item.selling_price_snapshot || 0),
        'TOTAL HPP (Rp)': (item.qty || 0) * (item.cmt_price_snapshot || 0),
        'GARMENT': garment?.garment_name || po.vendor_name || '',
        'NOTE': po.notes || '',
        'QTY SUDAH DIPRODUKSI': totalProduced,
        'QTY BELUM DIPRODUKSI': Math.max(0, (item.qty || 0) - totalProduced),
        'QTY SUDAH DIKIRIM': totalShipped,
        'STATUS': po.status || '',
      });
    }
  }
  
  return { sheetData, fileName: `laporan_produksi_${new Date().toISOString().slice(0, 10)}.xlsx`, sheetName: 'Laporan Produksi' };
}

// ─── EXPORT FINANCIAL REPORT ────────────────────────────────────────────────
async function exportFinancialReport(db, user, filters) {
  const invQuery = {};
  if (filters.status) invQuery.status = filters.status;
  if (filters.vendorId) invQuery.$or = [{ garment_id: filters.vendorId }, { vendor_id: filters.vendorId }];
  if (filters.dateFrom || filters.dateTo) {
    invQuery.created_at = {};
    if (filters.dateFrom) invQuery.created_at.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) { const d = new Date(filters.dateTo); d.setHours(23,59,59,999); invQuery.created_at.$lte = d; }
  }
  
  const invoices = await db.collection('invoices').find(invQuery).sort({ created_at: -1 }).toArray();
  const sheetData = [];
  
  for (const inv of invoices) {
    const adjustments = await db.collection('invoice_adjustments').find({ invoice_id: inv.id }).toArray();
    const totalAdjAdd = adjustments.filter(a => a.adjustment_type === 'ADD').reduce((s, a) => s + (a.amount || 0), 0);
    const totalAdjDeduct = adjustments.filter(a => a.adjustment_type === 'DEDUCT').reduce((s, a) => s + (a.amount || 0), 0);
    const adjustedTotal = (inv.total_amount || 0) + totalAdjAdd - totalAdjDeduct;
    
    sheetData.push({
      'No': sheetData.length + 1,
      'Tanggal': formatDate(inv.created_at),
      'No Invoice': inv.invoice_number || '',
      'Kategori': inv.invoice_category || '',
      'No PO': inv.po_number || '',
      'Vendor/Customer': inv.vendor_or_customer_name || inv.vendor_name || inv.customer_name || '',
      'Total Dasar': inv.base_amount || inv.total_amount || 0,
      'Penyesuaian (+)': totalAdjAdd,
      'Penyesuaian (-)': totalAdjDeduct,
      'Total Akhir': adjustedTotal,
      'Sudah Dibayar': inv.total_paid || 0,
      'Sisa': adjustedTotal - (inv.total_paid || 0),
      'Status': inv.status || '',
      'Jumlah Penyesuaian': adjustments.length,
    });
  }
  
  return { sheetData, fileName: `laporan_keuangan_${new Date().toISOString().slice(0, 10)}.xlsx`, sheetName: 'Laporan Keuangan' };
}

// ─── EXPORT SHIPMENT REPORT ────────────────────────────────────────────────
async function exportShipmentReport(db, user, filters) {
  const vsQuery = {};
  const bsQuery = {};
  if (filters.vendorId) { vsQuery.vendor_id = filters.vendorId; bsQuery.vendor_id = filters.vendorId; }
  if (filters.status) { vsQuery.status = filters.status; bsQuery.status = filters.status; }
  if (filters.dateFrom || filters.dateTo) {
    const dRange = {};
    if (filters.dateFrom) dRange.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) { const d = new Date(filters.dateTo); d.setHours(23,59,59,999); dRange.$lte = d; }
    vsQuery.created_at = dRange;
    bsQuery.created_at = { ...dRange };
  }
  
  const vendorShipments = await db.collection('vendor_shipments').find(vsQuery).sort({ created_at: -1 }).toArray();
  const buyerShipments = await db.collection('buyer_shipments').find(bsQuery).sort({ created_at: -1 }).toArray();
  const sheetData = [];
  
  for (const vs of vendorShipments) {
    const items = await db.collection('vendor_shipment_items').find({ shipment_id: vs.id }).toArray();
    const totalQty = items.reduce((s, i) => s + (i.qty_sent || 0), 0);
    sheetData.push({
      'No': sheetData.length + 1,
      'Arah': 'VENDOR → PRODUKSI',
      'No Shipment': vs.shipment_number || '',
      'Tipe': vs.shipment_type || 'NORMAL',
      'Vendor': vs.vendor_name || '',
      'Tanggal': formatDate(vs.shipment_date || vs.created_at),
      'Total Qty': totalQty,
      'Jumlah Item': items.length,
      'Status': vs.status || '',
      'Inspeksi': vs.inspection_status || 'Pending',
      'Catatan': vs.notes || '',
    });
  }
  
  for (const bs of buyerShipments) {
    const items = await db.collection('buyer_shipment_items').find({ shipment_id: bs.id }).toArray();
    const totalQty = items.reduce((s, i) => s + (i.qty_shipped || 0), 0);
    sheetData.push({
      'No': sheetData.length + 1,
      'Arah': 'PRODUKSI → BUYER',
      'No Shipment': bs.shipment_number || '',
      'Tipe': 'NORMAL',
      'Vendor': bs.vendor_name || '',
      'Tanggal': formatDate(bs.shipment_date || bs.created_at),
      'Total Qty': totalQty,
      'Jumlah Item': items.length,
      'Status': bs.ship_status || '',
      'Inspeksi': '',
      'Catatan': bs.notes || '',
    });
  }
  
  return { sheetData, fileName: `laporan_shipment_${new Date().toISOString().slice(0, 10)}.xlsx`, sheetName: 'Laporan Shipment' };
}

// ─── EXPORT INVOICES ────────────────────────────────────────────────────────
async function exportInvoices(db, user, filters) {
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.vendorId) query.$or = [{ garment_id: filters.vendorId }, { vendor_id: filters.vendorId }];
  if (filters.dateFrom || filters.dateTo) {
    query.created_at = {};
    if (filters.dateFrom) query.created_at.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) { const d = new Date(filters.dateTo); d.setHours(23,59,59,999); query.created_at.$lte = d; }
  }
  
  const invoices = await db.collection('invoices').find(query).sort({ created_at: -1 }).toArray();
  const sheetData = [];
  
  for (const inv of invoices) {
    const items = inv.invoice_items || [];
    if (items.length === 0) {
      sheetData.push({
        'No': sheetData.length + 1,
        'Tanggal': formatDate(inv.created_at),
        'No Invoice': inv.invoice_number || '',
        'Kategori': inv.invoice_category || '',
        'No PO': inv.po_number || '',
        'Vendor/Customer': inv.vendor_or_customer_name || '',
        'Produk': '',
        'SKU': '',
        'Qty': '',
        'Harga': '',
        'Subtotal': '',
        'Total Invoice': inv.total_amount || 0,
        'Sudah Dibayar': inv.total_paid || 0,
        'Status': inv.status || '',
      });
    }
    for (const item of items) {
      sheetData.push({
        'No': sheetData.length + 1,
        'Tanggal': formatDate(inv.created_at),
        'No Invoice': inv.invoice_number || '',
        'Kategori': inv.invoice_category || '',
        'No PO': inv.po_number || '',
        'Vendor/Customer': inv.vendor_or_customer_name || '',
        'Produk': item.product_name || '',
        'SKU': item.sku || '',
        'Qty': item.invoice_qty || item.qty || 0,
        'Harga': item.selling_price || item.cmt_price || 0,
        'Subtotal': item.subtotal || 0,
        'Total Invoice': inv.total_amount || 0,
        'Sudah Dibayar': inv.total_paid || 0,
        'Status': inv.status || '',
      });
    }
  }
  
  return { sheetData, fileName: `invoice_export_${new Date().toISOString().slice(0, 10)}.xlsx`, sheetName: 'Invoices' };
}
