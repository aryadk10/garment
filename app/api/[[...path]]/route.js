import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { unlink } from 'fs/promises';

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
    await seedInitialData(db);
  }
  return db;
}

async function seedInitialData(db) {
  // Migration: clear old schema data that lacks new fields
  const firstProduct = await db.collection('products').findOne({});
  if (firstProduct && firstProduct.selling_price === undefined) {
    await Promise.all([
      db.collection('products').deleteMany({}),
      db.collection('garments').deleteMany({}),
      db.collection('production_pos').deleteMany({}),
      db.collection('po_items').deleteMany({}),
      db.collection('work_orders').deleteMany({}),
      db.collection('production_progress').deleteMany({}),
      db.collection('invoices').deleteMany({}),
      db.collection('payments').deleteMany({}),
      db.collection('product_variants').deleteMany({}),
      db.collection('vendor_shipments').deleteMany({}),
      db.collection('vendor_shipment_items').deleteMany({}),
      db.collection('buyer_shipments').deleteMany({}),
      db.collection('buyer_shipment_items').deleteMany({}),
    ]);
    console.log('Migration v2: cleared old schema data');
  }

  // Ensure superadmin exists
  const adminExists = await db.collection('users').findOne({ email: 'admin@garment.com' });
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    await db.collection('users').insertOne({
      id: uuidv4(), name: 'Super Admin', email: 'admin@garment.com',
      password: hashedPassword, role: 'superadmin', status: 'active',
      created_at: new Date(), updated_at: new Date()
    });
    console.log('Superadmin seeded: admin@garment.com / Admin@123');
  }
}

function verifyToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
  } catch (e) { return null; }
}

async function logActivity(db, userId, userName, action, module, details = '') {
  await db.collection('activity_logs').insertOne({
    id: uuidv4(), user_id: userId, user_name: userName,
    action, module, details, timestamp: new Date()
  });
}

// Superadmin bypasses all role checks
function checkRole(user, allowedRoles) {
  if (user.role === 'superadmin') return true;
  return allowedRoles.includes(user.role);
}

function generatePassword(length = 10) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  let result = '';
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

// ─── AUTO GENERATE INVOICES — DISABLED per business rule ──────────────────────
// Invoices must ONLY be created through the Manual Invoice Module.
// This function is kept for reference only and must NOT be called.
// async function autoGenerateInvoices(db, po, poItems, user, vendorName) { ... }

// ─── GET ────────────────────────────────────────────────────────────────────────
export async function GET(request, { params }) {
  const path = params?.path || [];
  const db = await getDb();
  const user = verifyToken(request);

  try {
    if (!path[0]) return NextResponse.json({ message: 'Garment ERP API v2.0' });

    if (path[0] === 'auth' && path[1] === 'me') {
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const userData = await db.collection('users').findOne({ id: user.id }, { projection: { password: 0 } });
      return NextResponse.json(userData);
    }

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sp = new URL(request.url).searchParams;

    // GARMENTS
    if (path[0] === 'garments') {
      if (path[1]) {
        const g = await db.collection('garments').findOne({ id: path[1] });
        return g ? NextResponse.json(g) : NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      const query = {};
      const search = sp.get('search'), status = sp.get('status');
      if (search) query.$or = [{ garment_name: { $regex: search, $options: 'i' } }, { garment_code: { $regex: search, $options: 'i' } }];
      if (status) query.status = status;
      if (user.role === 'vendor') query.id = user.vendor_id;
      return NextResponse.json(await db.collection('garments').find(query).sort({ created_at: -1 }).toArray());
    }

    // PRODUCTS
    if (path[0] === 'products') {
      if (path[1]) {
        const p = await db.collection('products').findOne({ id: path[1] });
        if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const variants = await db.collection('product_variants').find({ product_id: path[1] }).sort({ created_at: 1 }).toArray();
        return NextResponse.json({ ...p, variants });
      }
      const search = sp.get('search'), query = {};
      if (search) query.$or = [{ product_name: { $regex: search, $options: 'i' } }, { product_code: { $regex: search, $options: 'i' } }];
      return NextResponse.json(await db.collection('products').find(query).sort({ created_at: -1 }).toArray());
    }

    // PRODUCT VARIANTS
    if (path[0] === 'product-variants') {
      if (path[1]) {
        const v = await db.collection('product_variants').findOne({ id: path[1] });
        return v ? NextResponse.json(v) : NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      const query = {};
      const productId = sp.get('product_id');
      if (productId) query.product_id = productId;
      return NextResponse.json(await db.collection('product_variants').find(query).sort({ created_at: 1 }).toArray());
    }

    // PRODUCTION POs
    if (path[0] === 'production-pos') {
      if (path[1]) {
        const po = await db.collection('production_pos').findOne({ id: path[1] });
        if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const [items, wos] = await Promise.all([
          db.collection('po_items').find({ po_id: path[1] }).toArray(),
          db.collection('work_orders').find({ po_id: path[1] }).toArray()
        ]);
        return NextResponse.json({ ...po, items, distributions: wos });
      }
      const query = {};
      const search = sp.get('search'), status = sp.get('status');
      if (search) query.$or = [{ po_number: { $regex: search, $options: 'i' } }, { customer_name: { $regex: search, $options: 'i' } }];
      if (status) query.status = status;
      const pos = await db.collection('production_pos').find(query).sort({ created_at: -1 }).toArray();
      const posWithCounts = await Promise.all(pos.map(async (po) => {
        const items = await db.collection('po_items').find({ po_id: po.id }).toArray();
        const serialNumbers = [...new Set(items.map(i => i.serial_number).filter(Boolean))];
        // Composite identifier for display
        const composite_label = `${po.po_number} | ${po.vendor_name || ''} | ${po.created_at ? new Date(po.created_at).toLocaleDateString('id-ID') : ''}`;
        return { 
          ...po, items, item_count: items.length, 
          total_qty: items.reduce((s, i) => s + (i.qty || 0), 0),
          serial_numbers: serialNumbers,
          composite_label,
        };
      }));
      return NextResponse.json(posWithCounts);
    }

    // PO ITEMS
    if (path[0] === 'po-items') {
      const query = {};
      const poId = sp.get('po_id');
      if (poId) query.po_id = poId;
      return NextResponse.json(await db.collection('po_items').find(query).sort({ created_at: 1 }).toArray());
    }

    // WORK ORDERS
    if (path[0] === 'work-orders') {
      if (path[1]) {
        const wo = await db.collection('work_orders').findOne({ id: path[1] });
        return wo ? NextResponse.json(wo) : NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      const query = {};
      const poId = sp.get('po_id'), garmentId = sp.get('garment_id'), status = sp.get('status');
      if (poId) query.po_id = poId;
      if (garmentId) query.garment_id = garmentId;
      if (status) query.status = status;
      if (user.role === 'vendor') query.garment_id = user.vendor_id;
      const wos = await db.collection('work_orders').find(query).sort({ created_at: -1 }).toArray();
      // Enrich each work order with serial_numbers from po_items
      const enriched = await Promise.all(wos.map(async (wo) => {
        if (wo.po_id) {
          const poItems = await db.collection('production_po_items').find({ po_id: wo.po_id }).toArray();
          const serialNumbers = [...new Set(poItems.map(i => i.serial_number).filter(Boolean))];
          return { ...wo, serial_numbers: serialNumbers };
        }
        return { ...wo, serial_numbers: [] };
      }));
      return NextResponse.json(enriched);
    }

    // PRODUCTION PROGRESS
    if (path[0] === 'production-progress') {
      const query = {};
      const woId = sp.get('work_order_id');
      if (woId) query.work_order_id = woId;
      if (user.role === 'vendor') query.garment_id = user.vendor_id;
      return NextResponse.json(await db.collection('production_progress').find(query).sort({ progress_date: -1 }).toArray());
    }

    // VENDOR SHIPMENTS
    if (path[0] === 'vendor-shipments') {
      if (path[1]) {
        const s = await db.collection('vendor_shipments').findOne({ id: path[1] });
        if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const items = await db.collection('vendor_shipment_items').find({ shipment_id: path[1] }).toArray();
        // Get child shipments
        const childShipments = await db.collection('vendor_shipments').find({ parent_shipment_id: path[1] }).toArray();
        const childShipmentsWithItems = await Promise.all(childShipments.map(async cs => ({
          ...cs, items: await db.collection('vendor_shipment_items').find({ shipment_id: cs.id }).toArray()
        })));
        return NextResponse.json({ ...s, items, child_shipments: childShipmentsWithItems });
      }
      const query = {};
      if (user.role === 'vendor') query.vendor_id = user.vendor_id;
      // Only return parent shipments at top level, with children nested
      const shipments = await db.collection('vendor_shipments').find(query).sort({ created_at: -1 }).toArray();
      const result = await Promise.all(shipments.map(async (s) => {
        const items = await db.collection('vendor_shipment_items').find({ shipment_id: s.id }).toArray();
        // Find child shipments (additional/replacement)
        const childShipments = await db.collection('vendor_shipments').find({ parent_shipment_id: s.id }).toArray();
        return { ...s, items, child_shipment_count: childShipments.length, has_children: childShipments.length > 0 };
      }));
      return NextResponse.json(result);
    }

    // BUYER SHIPMENTS
    if (path[0] === 'buyer-shipments') {
      if (path[1]) {
        const s = await db.collection('buyer_shipments').findOne({ id: path[1] });
        if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const items = await db.collection('buyer_shipment_items').find({ shipment_id: path[1] }).sort({ dispatch_seq: 1, created_at: 1 }).toArray();
        
        // Group items by dispatch_seq for dispatch history
        const dispatchMap = {};
        // Also track cumulative per po_item for correct totals
        const poItemTotals = {};
        
        for (const item of items) {
          const seq = item.dispatch_seq || 1;
          if (!dispatchMap[seq]) {
            dispatchMap[seq] = { dispatch_seq: seq, dispatch_date: item.dispatch_date || item.created_at, items: [], total_qty: 0 };
          }
          dispatchMap[seq].items.push(item);
          dispatchMap[seq].total_qty += item.qty_shipped || 0;
          
          // Track per po_item_id — use internal UUID, NOT visible fields like sku
          const key = item.po_item_id || item.id;
          if (!poItemTotals[key]) {
            poItemTotals[key] = { 
              po_item_id: item.po_item_id, sku: item.sku, product_name: item.product_name,
              serial_number: item.serial_number || '', size: item.size, color: item.color,
              ordered_qty: item.ordered_qty || 0, // Original PO qty — fixed denominator
              cumulative_shipped: 0
            };
          }
          poItemTotals[key].cumulative_shipped += item.qty_shipped || 0;
        }
        
        const dispatches = Object.values(dispatchMap).sort((a, b) => a.dispatch_seq - b.dispatch_seq);
        // Add cumulative to each dispatch
        const runningCumulative = {};
        for (const d of dispatches) {
          for (const item of d.items) {
            const key = item.po_item_id || item.sku || item.id;
            if (!runningCumulative[key]) runningCumulative[key] = 0;
            runningCumulative[key] += item.qty_shipped || 0;
          }
          d.cumulative_shipped = Object.values(runningCumulative).reduce((s, v) => s + v, 0);
        }
        
        // Summary using FIXED ordered_qty from PO
        const summaryItems = Object.values(poItemTotals);
        const totalOrdered = summaryItems.reduce((s, i) => s + (i.ordered_qty || 0), 0);
        const totalShipped = summaryItems.reduce((s, i) => s + (i.cumulative_shipped || 0), 0);
        const remaining = Math.max(0, totalOrdered - totalShipped);
        const progressPct = totalOrdered > 0 ? Math.round((totalShipped / totalOrdered) * 100) : 0;
        
        return NextResponse.json({ 
          ...s, items, dispatches, 
          summary_items: summaryItems,
          total_ordered: totalOrdered, total_shipped: totalShipped, 
          remaining, progress_pct: progressPct
        });
      }
      const query = {};
      const poId = sp.get('po_id');
      if (poId) query.po_id = poId;
      if (user.role === 'vendor') query.vendor_id = user.vendor_id;
      const shipments = await db.collection('buyer_shipments').find(query).sort({ created_at: -1 }).toArray();
      
      const result = await Promise.all(shipments.map(async (s) => {
        const items = await db.collection('buyer_shipment_items').find({ shipment_id: s.id }).toArray();
        
        // Calculate using FIXED ordered_qty per unique po_item — use internal UUID
        const poItemMap = {};
        for (const item of items) {
          const key = item.po_item_id || item.id;
          if (!poItemMap[key]) {
            poItemMap[key] = { ordered_qty: item.ordered_qty || 0, shipped: 0 };
          }
          poItemMap[key].shipped += item.qty_shipped || 0;
        }
        
        const totalOrdered = Object.values(poItemMap).reduce((s, v) => s + v.ordered_qty, 0);
        const totalShipped = Object.values(poItemMap).reduce((s, v) => s + v.shipped, 0);
        const remaining = Math.max(0, totalOrdered - totalShipped);
        const progressPct = totalOrdered > 0 ? Math.round((totalShipped / totalOrdered) * 100) : 0;
        const maxDispatch = items.length > 0 ? Math.max(...items.map(i => i.dispatch_seq || 1)) : 0;
        
        return { 
          ...s, items,
          total_ordered: totalOrdered, total_shipped: totalShipped, 
          remaining, progress_pct: progressPct,
          dispatch_count: maxDispatch
        };
      }));
      return NextResponse.json(result);
    }

    // BUYER SHIPMENT DISPATCHES — grouped dispatch history for a master shipment
    if (path[0] === 'buyer-shipment-dispatches') {
      const shipmentId = sp.get('shipment_id');
      if (!shipmentId) return NextResponse.json({ error: 'shipment_id required' }, { status: 400 });
      const items = await db.collection('buyer_shipment_items').find({ shipment_id: shipmentId }).sort({ dispatch_seq: 1, created_at: 1 }).toArray();
      const dispatchMap = {};
      for (const item of items) {
        const seq = item.dispatch_seq || 1;
        if (!dispatchMap[seq]) {
          dispatchMap[seq] = { dispatch_seq: seq, dispatch_date: item.dispatch_date || item.created_at, items: [], total_qty: 0 };
        }
        dispatchMap[seq].items.push(item);
        dispatchMap[seq].total_qty += item.qty_shipped || 0;
      }
      return NextResponse.json(Object.values(dispatchMap).sort((a, b) => a.dispatch_seq - b.dispatch_seq));
    }

    // INVOICES
    if (path[0] === 'invoices') {
      if (path[1]) {
        const inv = await db.collection('invoices').findOne({ id: path[1] });
        if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const payments = await db.collection('payments').find({ invoice_id: path[1] }).toArray();
        const adjustments = await db.collection('invoice_adjustments').find({ invoice_id: path[1] }).sort({ created_at: -1 }).toArray();
        // Calculate adjusted total
        const totalAdd = adjustments.filter(a => a.adjustment_type === 'ADD').reduce((s, a) => s + (a.amount || 0), 0);
        const totalDeduct = adjustments.filter(a => a.adjustment_type === 'DEDUCT').reduce((s, a) => s + (a.amount || 0), 0);
        const baseAmount = inv.base_amount || inv.total_amount || 0;
        const adjustedTotal = baseAmount + totalAdd - totalDeduct;
        return NextResponse.json({ ...inv, payments, adjustments, base_amount: baseAmount, adjusted_total: adjustedTotal });
      }
      const query = {};
      const status = sp.get('status'), garmentId = sp.get('garment_id');
      const type = sp.get('type'), category = sp.get('category');
      const dateFrom = sp.get('date_from'), dateTo = sp.get('date_to');
      const invoiceSubtype = sp.get('invoice_type'); // MANUAL or AUTO_GENERATED
      if (status) query.status = status;
      if (garmentId) query.garment_id = garmentId;
      // Support both 'type' (vendor/customer) and 'category' (VENDOR/BUYER)
      if (type === 'vendor') query.invoice_category = 'VENDOR';
      else if (type === 'customer') query.invoice_category = 'BUYER';
      if (category) query.invoice_category = category;
      if (invoiceSubtype) query.invoice_type = invoiceSubtype;
      if (dateFrom || dateTo) {
        query.created_at = {};
        if (dateFrom) query.created_at.$gte = new Date(dateFrom);
        if (dateTo) { const d = new Date(dateTo); d.setHours(23,59,59,999); query.created_at.$lte = d; }
      }
      return NextResponse.json(await db.collection('invoices').find(query).sort({ created_at: -1 }).toArray());
    }

    // PAYMENTS
    if (path[0] === 'payments') {
      const query = {};
      const invoiceId = sp.get('invoice_id');
      const pType = sp.get('payment_type'); // VENDOR_PAYMENT or CUSTOMER_PAYMENT
      const dateFrom = sp.get('date_from'), dateTo = sp.get('date_to');
      if (invoiceId) query.invoice_id = invoiceId;
      if (pType) query.payment_type = pType;
      if (dateFrom || dateTo) {
        query.payment_date = {};
        if (dateFrom) query.payment_date.$gte = new Date(dateFrom);
        if (dateTo) { const d = new Date(dateTo); d.setHours(23,59,59,999); query.payment_date.$lte = d; }
      }
      return NextResponse.json(await db.collection('payments').find(query).sort({ payment_date: -1 }).toArray());
    }

    // USERS
    if (path[0] === 'users') {
      if (!checkRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (path[1]) {
        const u = await db.collection('users').findOne({ id: path[1] }, { projection: { password: 0 } });
        return u ? NextResponse.json(u) : NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json(await db.collection('users').find({}, { projection: { password: 0 } }).sort({ created_at: -1 }).toArray());
    }

    // ACTIVITY LOGS
    if (path[0] === 'activity-logs') {
      if (!checkRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const query = {};
      const module = sp.get('module'), limit = parseInt(sp.get('limit') || '100');
      if (module) query.module = module;
      return NextResponse.json(await db.collection('activity_logs').find(query).sort({ timestamp: -1 }).limit(limit).toArray());
    }

    // DASHBOARD
    if (path[0] === 'dashboard') {
      const now = new Date();
      const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const [totalPOs, activePOs, garments, products, invoices, payments] = await Promise.all([
        db.collection('production_pos').countDocuments(),
        db.collection('production_pos').countDocuments({ status: { $in: ['In Production', 'Distributed'] } }),
        db.collection('garments').countDocuments({ status: 'active' }),
        db.collection('products').countDocuments(),
        db.collection('invoices').find().toArray(),
        db.collection('payments').find().toArray(),
      ]);

      // === NEW: Production & Material stats ===
      const [
        activeJobs, pendingShipments, pendingAdditionalRequests, pendingReplacementRequests,
        pendingReturns, totalBuyerShipments, totalVendorShipments,
        allJobItems, allJobs
      ] = await Promise.all([
        db.collection('production_jobs').countDocuments({ status: 'In Progress', parent_job_id: { $in: [null, undefined, ''] } }),
        db.collection('vendor_shipments').countDocuments({ status: { $in: ['Sent', 'In Transit'] } }),
        db.collection('material_requests').countDocuments({ request_type: 'ADDITIONAL', status: 'Pending' }),
        db.collection('material_requests').countDocuments({ request_type: 'REPLACEMENT', status: 'Pending' }),
        db.collection('production_returns').countDocuments({ status: { $nin: ['Shipped Back', 'Closed'] } }),
        db.collection('buyer_shipments').countDocuments(),
        db.collection('vendor_shipments').countDocuments({ shipment_type: 'NORMAL' }),
        db.collection('production_job_items').find().toArray(),
        db.collection('production_jobs').find({ parent_job_id: { $in: [null, undefined, ''] } }).toArray(),
      ]);

      const totalProducedGlobal = allJobItems.reduce((s, i) => s + (i.produced_qty || 0), 0);
      const totalAvailableGlobal = allJobItems.reduce((s, i) => s + (i.available_qty ?? i.shipment_qty ?? 0), 0);
      const globalProgressPct = totalAvailableGlobal > 0 ? Math.round((totalProducedGlobal / totalAvailableGlobal) * 100) : 0;

      // === Financial (with adjustments) ===
      const allAdjustments = await db.collection('invoice_adjustments').find({}).toArray();
      const adjMap = {};
      for (const adj of allAdjustments) {
        if (!adjMap[adj.invoice_id]) adjMap[adj.invoice_id] = { add: 0, deduct: 0 };
        if (adj.adjustment_type === 'ADD') adjMap[adj.invoice_id].add += adj.amount || 0;
        else adjMap[adj.invoice_id].deduct += adj.amount || 0;
      }
      // Use adjusted totals for financial calcs
      const getAdjustedTotal = (inv) => {
        const a = adjMap[inv.id] || { add: 0, deduct: 0 };
        return (inv.base_amount || inv.total_amount || 0) + a.add - a.deduct;
      };
      const vendorInvoices = invoices.filter(i => i.invoice_category === 'VENDOR' || i.invoice_type === 'vendor' || (!i.invoice_category && !i.invoice_type));
      const customerInvoices = invoices.filter(i => i.invoice_category === 'BUYER' || i.invoice_type === 'customer');
      const totalVendorCost = vendorInvoices.reduce((s, i) => s + getAdjustedTotal(i), 0);
      const totalRevenue = customerInvoices.reduce((s, i) => s + getAdjustedTotal(i), 0);
      const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
      const totalInvoiced = invoices.reduce((s, i) => s + getAdjustedTotal(i), 0);
      const outstanding = totalInvoiced - totalPaid;
      const unpaidInvoices = invoices.filter(i => i.status === 'Unpaid').length;
      const partialInvoices = invoices.filter(i => i.status === 'Partial').length;
      const delayedPOs = await db.collection('production_pos').countDocuments({ status: { $in: ['Draft', 'Distributed', 'In Production'] }, deadline: { $lt: now } });

      const [overduePosList, nearDeadlinePosList, unpaidInvoicesList] = await Promise.all([
        db.collection('production_pos').find({ status: { $in: ['Draft', 'Distributed', 'In Production'] }, deadline: { $lt: now } }).sort({ deadline: 1 }).limit(5).toArray(),
        db.collection('production_pos').find({ status: { $in: ['Draft', 'Distributed', 'In Production'] }, deadline: { $gte: now, $lt: threeDays } }).sort({ deadline: 1 }).limit(5).toArray(),
        db.collection('invoices').find({ status: { $in: ['Unpaid', 'Partial'] } }).sort({ created_at: 1 }).limit(5).toArray()
      ]);

      const monthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const [mPOs, mProg] = await Promise.all([
          db.collection('production_pos').countDocuments({ created_at: { $gte: start, $lt: end } }),
          db.collection('production_progress').aggregate([{ $match: { progress_date: { $gte: start, $lt: end } } }, { $group: { _id: null, total: { $sum: '$completed_quantity' } } }]).toArray()
        ]);
        monthlyData.push({ month: start.toLocaleString('id-ID', { month: 'short', year: '2-digit' }), pos: mPOs, production: mProg[0]?.total || 0 });
      }
      const [woStatus, topGarments] = await Promise.all([
        db.collection('work_orders').aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).toArray(),
        db.collection('work_orders').aggregate([{ $group: { _id: '$garment_name', total_qty: { $sum: '$quantity' } } }, { $sort: { total_qty: -1 } }, { $limit: 5 }]).toArray()
      ]);

      return NextResponse.json({
        totalPOs, activePOs, garments, products,
        totalInvoiced, totalPaid, outstanding, totalVendorCost, totalRevenue, grossMargin: totalRevenue - totalVendorCost,
        unpaidInvoices, partialInvoices, delayedPOs,
        // NEW production stats
        activeJobs, pendingShipments, pendingAdditionalRequests, pendingReplacementRequests,
        pendingReturns, totalBuyerShipments, totalVendorShipments,
        totalProducedGlobal, totalAvailableGlobal, globalProgressPct,
        monthlyData, woStatus, topGarments,
        alerts: { overduePos: overduePosList, nearDeadlinePos: nearDeadlinePosList, unpaidInvoices: unpaidInvoicesList }
      });
    }

    // VENDOR PORTAL DASHBOARD
    if (path[0] === 'vendor' && path[1] === 'dashboard') {
      if (user.role !== 'vendor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const vendorId = user.vendor_id;
      const now = new Date();
      const [jobs, incomingShipments, recentProgress] = await Promise.all([
        db.collection('production_jobs').find({ vendor_id: vendorId }).sort({ created_at: -1 }).toArray(),
        db.collection('vendor_shipments').countDocuments({ vendor_id: vendorId, status: 'Sent' }),
        db.collection('production_progress').find({ job_id: { $exists: true }, recorded_by: user.name }).sort({ progress_date: -1 }).limit(5).toArray()
      ]);

      const activeJobs = jobs.filter(j => j.status === 'In Progress' && !j.parent_job_id).length;
      const completedJobs = jobs.filter(j => j.status === 'Completed').length;
      const overdueJobs = jobs.filter(j => j.status === 'In Progress' && j.deadline && new Date(j.deadline) < now).length;

      // Total produced across all job items (parent + child)
      const allJobIds = jobs.map(j => j.id);
      const allJobItems = allJobIds.length > 0
        ? await db.collection('production_job_items').find({ job_id: { $in: allJobIds } }).toArray()
        : [];
      const totalProduced = allJobItems.reduce((s, i) => s + (i.produced_qty || 0), 0);
      const totalAvailable = allJobItems.reduce((s, i) => s + (i.available_qty ?? i.shipment_qty ?? 0), 0);

      // Material stats
      const allShipmentIds = (await db.collection('vendor_shipments').find({ vendor_id: vendorId }).project({ id: 1, total_received: 1, total_missing: 1, inspection_status: 1 }).toArray());
      const totalReceived = allShipmentIds.reduce((s, ship) => s + (ship.total_received || 0), 0);
      const totalMissing = allShipmentIds.reduce((s, ship) => s + (ship.total_missing || 0), 0);
      const pendingInspections = allShipmentIds.filter(s => s.inspection_status !== 'Inspected' && s.inspection_status !== undefined).length;

      // Defect reports
      const defectReports = allJobIds.length > 0
        ? await db.collection('material_defect_reports').find({ job_id: { $in: allJobIds } }).toArray()
        : [];
      const totalDefect = defectReports.reduce((s, d) => s + (d.defect_qty || 0), 0);

      // Pending material requests
      const [pendingAdditional, pendingReplacement] = await Promise.all([
        db.collection('material_requests').countDocuments({ vendor_id: vendorId, request_type: 'ADDITIONAL', status: 'Pending' }),
        db.collection('material_requests').countDocuments({ vendor_id: vendorId, request_type: 'REPLACEMENT', status: 'Pending' }),
      ]);

      // Buyer shipments
      const pendingBuyerShipments = await db.collection('buyer_shipments').countDocuments({ vendor_id: vendorId });
      const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const nearDeadlineJobs = jobs.filter(j => j.status === 'In Progress' && j.deadline && new Date(j.deadline) >= now && new Date(j.deadline) < threeDays);
      const overdueJobsList = jobs.filter(j => j.status === 'In Progress' && j.deadline && new Date(j.deadline) < now);

      return NextResponse.json({
        activeJobs, completedJobs, overdueJobs, incomingShipments, pendingBuyerShipments,
        totalProduced, totalAvailable,
        progressPct: totalAvailable > 0 ? Math.round((totalProduced / totalAvailable) * 100) : 0,
        totalReceived, totalMissing, totalDefect, pendingInspections,
        pendingAdditional, pendingReplacement,
        recentProgress,
        alerts: { overdueJobs: overdueJobsList, nearDeadlineJobs }
      });
    }

    // FINANCIAL RECAP
    if (path[0] === 'financial-recap') {
      const dateFrom = sp.get('date_from'), dateTo = sp.get('date_to');
      const invQuery = {};
      const pmtQuery = {};
      if (dateFrom || dateTo) {
        const dRange = {};
        if (dateFrom) dRange.$gte = new Date(dateFrom);
        if (dateTo) { const d = new Date(dateTo); d.setHours(23,59,59,999); dRange.$lte = d; }
        invQuery.created_at = dRange;
        pmtQuery.payment_date = dRange;
      }
      const [invoices, payments, allAdjustments] = await Promise.all([
        db.collection('invoices').find(invQuery).toArray(),
        db.collection('payments').find(pmtQuery).toArray(),
        db.collection('invoice_adjustments').find({}).toArray()
      ]);

      // Build adjustment map per invoice
      const adjMap = {};
      for (const adj of allAdjustments) {
        if (!adjMap[adj.invoice_id]) adjMap[adj.invoice_id] = { add: 0, deduct: 0 };
        if (adj.adjustment_type === 'ADD') adjMap[adj.invoice_id].add += adj.amount || 0;
        else adjMap[adj.invoice_id].deduct += adj.amount || 0;
      }

      // Calculate adjusted totals for each invoice
      const invoicesWithAdj = invoices.map(inv => {
        const adj = adjMap[inv.id] || { add: 0, deduct: 0 };
        const baseAmount = inv.base_amount || inv.total_amount || 0;
        const adjustedTotal = baseAmount + adj.add - adj.deduct;
        return { ...inv, base_amount: baseAmount, adjusted_total: adjustedTotal, adj_add: adj.add, adj_deduct: adj.deduct };
      });

      // Separate by category (new fields) with backward compat
      const vendorInvoices = invoicesWithAdj.filter(i => i.invoice_category === 'VENDOR' || i.invoice_type === 'vendor' || (!i.invoice_category && !i.invoice_type));
      const buyerInvoices = invoicesWithAdj.filter(i => i.invoice_category === 'BUYER' || i.invoice_type === 'customer');
      const vendorPayments = payments.filter(p => p.payment_type === 'VENDOR_PAYMENT' || (!p.payment_type && vendorInvoices.some(inv => inv.id === p.invoice_id)));
      const customerPayments = payments.filter(p => p.payment_type === 'CUSTOMER_PAYMENT' || (!p.payment_type && buyerInvoices.some(inv => inv.id === p.invoice_id)));

      // Use adjusted_total instead of total_amount for financial calculations
      const totalSalesValue = buyerInvoices.reduce((s, i) => s + (i.adjusted_total || 0), 0);
      const totalVendorCost = vendorInvoices.reduce((s, i) => s + (i.adjusted_total || 0), 0);
      const totalCashIn = customerPayments.reduce((s, p) => s + (p.amount || 0), 0);
      const totalCashOut = vendorPayments.reduce((s, p) => s + (p.amount || 0), 0);
      const totalAROutstanding = buyerInvoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + (i.adjusted_total || 0) - (i.total_paid || 0), 0);
      const totalAPOutstanding = vendorInvoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + (i.adjusted_total || 0) - (i.total_paid || 0), 0);
      const grossMargin = totalSalesValue - totalVendorCost;
      const grossMarginPct = totalSalesValue > 0 ? Math.round((grossMargin / totalSalesValue) * 100) : 0;
      const totalAdjustments = allAdjustments.reduce((s, a) => s + (a.adjustment_type === 'ADD' ? (a.amount || 0) : -(a.amount || 0)), 0);

      // Vendor summary
      const garmentSummary = {};
      for (const inv of vendorInvoices) {
        const key = inv.garment_id || inv.vendor_id || 'unknown';
        if (!garmentSummary[key]) garmentSummary[key] = { garment_name: inv.garment_name || inv.vendor_name || 'Unknown', total_invoiced: 0, total_paid: 0 };
        garmentSummary[key].total_invoiced += inv.adjusted_total || 0;
        garmentSummary[key].total_paid += inv.total_paid || 0;
      }
      const summary = Object.values(garmentSummary).map(g => ({ ...g, outstanding: g.total_invoiced - g.total_paid }));

      // Monthly trend for last 6 months
      const now = new Date();
      const monthlyTrend = [];
      for (let i = 5; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const mSales = buyerInvoices.filter(inv => inv.created_at >= start && inv.created_at < end).reduce((s, i) => s + (i.adjusted_total || 0), 0);
        const mCost = vendorInvoices.filter(inv => inv.created_at >= start && inv.created_at < end).reduce((s, i) => s + (i.adjusted_total || 0), 0);
        const mCashIn = customerPayments.filter(p => p.payment_date >= start && p.payment_date < end).reduce((s, p) => s + (p.amount || 0), 0);
        const mCashOut = vendorPayments.filter(p => p.payment_date >= start && p.payment_date < end).reduce((s, p) => s + (p.amount || 0), 0);
        monthlyTrend.push({
          month: start.toLocaleString('id-ID', { month: 'short', year: '2-digit' }),
          sales: mSales, cost: mCost, cash_in: mCashIn, cash_out: mCashOut,
          margin: mSales - mCost
        });
      }

      return NextResponse.json({
        total_sales_value: totalSalesValue,
        total_vendor_cost: totalVendorCost,
        total_cash_in: totalCashIn,
        total_cash_out: totalCashOut,
        accounts_receivable_outstanding: totalAROutstanding,
        accounts_payable_outstanding: totalAPOutstanding,
        gross_margin: grossMargin,
        gross_margin_pct: grossMarginPct,
        total_adjustments: totalAdjustments,
        // Backward compat
        total_invoiced: totalSalesValue + totalVendorCost,
        total_paid: totalCashIn + totalCashOut,
        total_outstanding: totalAROutstanding + totalAPOutstanding,
        total_vendor_invoices: vendorInvoices.length,
        total_buyer_invoices: buyerInvoices.length,
        // Details
        garment_summary: summary,
        monthly_trend: monthlyTrend,
        invoices: invoicesWithAdj, payments
      });
    }

    // GLOBAL SEARCH
    if (path[0] === 'global-search') {
      const q = sp.get('q') || '';
      if (!q.trim()) return NextResponse.json({ results: [] });
      const regex = { $regex: q, $options: 'i' };
      const [pos, vendors, products, variants] = await Promise.all([
        db.collection('production_pos').find({ $or: [{ po_number: regex }, { customer_name: regex }] }).limit(5).toArray(),
        db.collection('garments').find({ $or: [{ garment_name: regex }, { garment_code: regex }] }).limit(5).toArray(),
        db.collection('products').find({ $or: [{ product_name: regex }, { product_code: regex }] }).limit(5).toArray(),
        db.collection('product_variants').find({ sku: regex }).limit(5).toArray(),
      ]);
      const results = [
        ...pos.map(p => ({ type: 'PO', id: p.id, label: p.po_number, sub: p.customer_name, module: 'production-po' })),
        ...vendors.map(v => ({ type: 'Vendor', id: v.id, label: v.garment_name, sub: v.garment_code, module: 'garments' })),
        ...products.map(p => ({ type: 'Produk', id: p.id, label: p.product_name, sub: p.product_code, module: 'products' })),
        ...variants.map(v => ({ type: 'SKU', id: v.id, label: v.sku, sub: `${v.size}/${v.color}`, module: 'products' })),
      ];
      return NextResponse.json({ results });
    }

    // ATTACHMENTS
    if (path[0] === 'attachments') {
      const entityType = sp.get('entity_type');
      const entityId = sp.get('entity_id');
      if (!entityType || !entityId) return NextResponse.json({ error: 'entity_type and entity_id required' }, { status: 400 });
      const attachments = await db.collection('attachments').find({ entity_type: entityType, entity_id: entityId }).sort({ uploaded_at: -1 }).toArray();
      return NextResponse.json(attachments);
    }

    // DISTRIBUSI KERJA V2 — hierarchical: vendor → PO → serial → SKU (auto-populated)
    if (path[0] === 'distribusi-kerja') {
      const vendorId = sp.get('vendor_id');
      const poId = sp.get('po_id');
      const filter = {};
      if (vendorId) filter.vendor_id = vendorId;
      const shipments = await db.collection('vendor_shipments').find(filter).sort({ created_at: -1 }).toArray();

      // Build flat rows — only valid PO-mapped items
      const flatRows = [];
      const invalidRows = []; // Rows that cannot be mapped to a valid PO
      
      for (const ship of shipments) {
        const items = await db.collection('vendor_shipment_items').find({ shipment_id: ship.id }).toArray();
        for (const si of items) {
          if (poId && si.po_id !== poId) continue;
          
          // Resolve PO and PO item — for ADDITIONAL/REPLACEMENT shipments, try to find via parent
          let po = si.po_id ? await db.collection('production_pos').findOne({ id: si.po_id }) : null;
          let poItem = si.po_item_id ? await db.collection('po_items').findOne({ id: si.po_item_id }) : null;
          
          // If this is a child shipment (ADDITIONAL/REPLACEMENT) and has no PO mapping,
          // try to inherit from parent shipment
          if (!po && ship.parent_shipment_id) {
            const parentShip = await db.collection('vendor_shipments').findOne({ id: ship.parent_shipment_id });
            if (parentShip) {
              // Find matching item in parent shipment — prefer po_item_id match, then fall back to sku+size+color
              const parentItems = await db.collection('vendor_shipment_items').find({ shipment_id: parentShip.id }).toArray();
              let matchingParent = null;
              // First try: match by po_item_id (internal UUID)
              if (si.po_item_id) {
                matchingParent = parentItems.find(pi => pi.po_item_id === si.po_item_id);
              }
              // Fallback: match by sku+size+color combo (more specific than sku alone)
              if (!matchingParent) {
                matchingParent = parentItems.find(pi => 
                  pi.sku === si.sku && pi.size === si.size && pi.color === si.color && pi.serial_number === si.serial_number
                );
              }
              // Last resort: match by sku only
              if (!matchingParent) {
                matchingParent = parentItems.find(pi => pi.sku === si.sku || pi.product_name === si.product_name);
              }
              if (matchingParent) {
                po = matchingParent.po_id ? await db.collection('production_pos').findOne({ id: matchingParent.po_id }) : null;
                poItem = matchingParent.po_item_id ? await db.collection('po_items').findOne({ id: matchingParent.po_item_id }) : null;
              }
            }
          }
          
          // If STILL no valid PO mapping, mark as invalid and skip
          if (!po || !po.po_number) {
            // Only for ADDITIONAL/REPLACEMENT — normal shipments with no PO are also invalid
            if (ship.shipment_type === 'ADDITIONAL' || ship.shipment_type === 'REPLACEMENT' || !si.po_id) {
              invalidRows.push({
                id: si.id, shipment_id: ship.id, shipment_number: ship.shipment_number,
                shipment_type: ship.shipment_type || 'NORMAL',
                vendor_name: ship.vendor_name, sku: si.sku || '', product_name: si.product_name || '',
                error: 'Tidak dapat di-mapping ke PO yang valid'
              });
              continue;
            }
          }

          const jobItem = await db.collection('production_job_items').findOne({ vendor_shipment_item_id: si.id });
          const buyerItems = si.po_item_id ? await db.collection('buyer_shipment_items').find({ po_item_id: si.po_item_id || poItem?.id }).toArray() : [];
          const shipped_to_buyer = buyerItems.reduce((s, b) => s + (b.qty_shipped || 0), 0);

          // AGGREGATE produced_qty: parent job + ALL child jobs
          let produced_qty = jobItem?.produced_qty || 0;
          if (jobItem) {
            const parentJob = await db.collection('production_jobs').findOne({ id: jobItem.job_id });
            if (parentJob) {
              const childJobs = await db.collection('production_jobs').find({ parent_job_id: parentJob.id }).toArray();
              for (const childJob of childJobs) {
                // Match child job items by po_item_id (internal UUID) to avoid merging records with same visible fields
                let childJobItem = null;
                const targetPoItemId = si.po_item_id || poItem?.id;
                if (targetPoItemId) {
                  childJobItem = await db.collection('production_job_items').findOne({
                    job_id: childJob.id, po_item_id: targetPoItemId
                  });
                }
                if (!childJobItem && !targetPoItemId && si.id) {
                  childJobItem = await db.collection('production_job_items').findOne({
                    job_id: childJob.id, vendor_shipment_item_id: si.id
                  });
                }
                if (childJobItem) produced_qty += (childJobItem.produced_qty || 0);
              }
            }
          }

          // Material tracking from inspection
          const inspection = ship.inspection_status === 'Inspected'
            ? await db.collection('vendor_material_inspections').findOne({ shipment_id: ship.id })
            : null;
          let received_qty = 0, missing_qty = 0;
          if (inspection) {
            // Match by shipment_item_id FIRST (internal UUID - guaranteed unique)
            let inspItem = await db.collection('vendor_material_inspection_items').findOne({
              inspection_id: inspection.id,
              shipment_item_id: si.id
            });
            // Only fall back to sku+size+color if no shipment_item_id match
            if (!inspItem) {
              inspItem = await db.collection('vendor_material_inspection_items').findOne({
                inspection_id: inspection.id,
                sku: si.sku, size: si.size || '', color: si.color || ''
              });
            }
            received_qty = inspItem?.received_qty ?? si.qty_sent;
            missing_qty = inspItem?.missing_qty ?? 0;
          } else {
            received_qty = ship.status === 'Received' ? si.qty_sent : 0;
          }

          // Defect qty — match by po_item_id if available, then fall back to sku+po_id
          const defectMatch = (si.po_item_id || poItem?.id)
            ? { po_item_id: si.po_item_id || poItem?.id }
            : { sku: si.sku || '', po_id: si.po_id || po?.id || '' };
          const defectAgg = await db.collection('material_defect_reports').aggregate([
            { $match: defectMatch },
            { $group: { _id: null, total: { $sum: '$defect_qty' } } }
          ]).toArray();
          const defect_qty = defectAgg[0]?.total || 0;
          const available_qty = Math.max(0, received_qty - defect_qty);

          // Additional/replacement requested qty — match by shipment_item_id if available
          const reqMatch = { original_shipment_id: ship.id };
          if (si.id) reqMatch.shipment_item_id = si.id;
          else reqMatch.sku = si.sku || '';
          const addlReqs = await db.collection('material_requests').find({ ...reqMatch, request_type: 'ADDITIONAL' }).toArray();
          const replReqs = await db.collection('material_requests').find({ ...reqMatch, request_type: 'REPLACEMENT' }).toArray();
          const additional_requested = addlReqs.reduce((s, r) => s + (r.requested_qty || 0), 0);
          const replacement_requested = replReqs.reduce((s, r) => s + (r.requested_qty || 0), 0);

          // Use PO item ordered_qty as the FIXED denominator, never the shipment qty
          const ordered_qty = poItem?.qty || si.ordered_qty || si.qty_sent;
          const progress_pct = ordered_qty > 0 ? Math.round((produced_qty / ordered_qty) * 100) : 0;

          flatRows.push({
            id: si.id,
            shipment_id: ship.id, shipment_number: ship.shipment_number,
            shipment_type: ship.shipment_type || 'NORMAL',
            parent_shipment_id: ship.parent_shipment_id || null,
            shipment_status: ship.status, inspection_status: ship.inspection_status || 'Pending',
            vendor_id: ship.vendor_id, vendor_name: ship.vendor_name,
            po_id: po?.id || si.po_id || '', po_number: po?.po_number || si.po_number || '',
            po_date: po?.created_at || null,
            customer_name: po?.customer_name || '', po_status: po?.status || '',
            deadline: po?.deadline || null, delivery_deadline: po?.delivery_deadline || null,
            serial_number: poItem?.serial_number || si.serial_number || si.source_serial_number || '',
            product_name: si.product_name, sku: si.sku || '', size: si.size || '', color: si.color || '',
            ordered_qty, shipment_qty: si.qty_sent, produced_qty, shipped_to_buyer,
            received_qty, missing_qty, defect_qty, available_qty,
            additional_requested, replacement_requested,
            remaining_production: Math.max(0, ordered_qty - produced_qty),
            remaining_shipment: Math.max(0, produced_qty - shipped_to_buyer),
            progress_pct,
            job_id: jobItem?.job_id || null, job_item_id: jobItem?.id || null,
          });
        }
      }

      // For ADDITIONAL/REPLACEMENT rows that have the same po_item_id as a NORMAL row,
      // merge the shipment_qty into the parent row (don't show separate rows)
      const mergedRows = [];
      const normalRowsByPoItem = {};
      
      // First pass: identify normal rows — keyed by internal po_item_id (UUID), NOT by visible fields
      for (const row of flatRows) {
        if (row.shipment_type === 'NORMAL') {
          // Use po_item_id as unique key to avoid merging records with same visible fields
          const key = row.po_item_id || row.id;
          if (!normalRowsByPoItem[key]) normalRowsByPoItem[key] = row;
          mergedRows.push(row);
        }
      }
      
      // Second pass: merge additional/replacement into parent or add as separate
      for (const row of flatRows) {
        if (row.shipment_type !== 'NORMAL') {
          // Match by po_item_id to find the correct parent row
          const key = row.po_item_id || row.id;
          const parentRow = normalRowsByPoItem[key];
          if (parentRow) {
            // Merge: add the additional shipment qty to received
            parentRow.received_qty += row.received_qty;
            parentRow.additional_requested += row.shipment_qty;
            // Don't add a separate row — the additional shipment extends the original
          } else {
            // No matching parent, add as separate row but with valid data
            mergedRows.push(row);
          }
        }
      }

      // Now build hierarchical structure: vendor → po → serial → sku
      const vendorMap = {};
      for (const row of mergedRows) {
        if (!vendorMap[row.vendor_id]) {
          vendorMap[row.vendor_id] = {
            vendor_id: row.vendor_id, vendor_name: row.vendor_name,
            total_ordered: 0, total_received: 0, total_produced: 0, total_shipped: 0,
            total_missing: 0, total_defect: 0, pos: {}
          };
        }
        const vm = vendorMap[row.vendor_id];
        vm.total_ordered += row.ordered_qty;
        vm.total_received += row.received_qty;
        vm.total_produced += row.produced_qty;
        vm.total_shipped += row.shipped_to_buyer;
        vm.total_missing += row.missing_qty;
        vm.total_defect += row.defect_qty;

        const poKey = row.po_id || 'unknown';
        if (!vm.pos[poKey]) {
          vm.pos[poKey] = {
            po_id: row.po_id, po_number: row.po_number, po_date: row.po_date,
            customer_name: row.customer_name,
            po_status: row.po_status, deadline: row.deadline,
            total_ordered: 0, total_received: 0, total_produced: 0, total_shipped: 0,
            serials: {}
          };
        }
        const pm = vm.pos[poKey];
        pm.total_ordered += row.ordered_qty;
        pm.total_received += row.received_qty;
        pm.total_produced += row.produced_qty;
        pm.total_shipped += row.shipped_to_buyer;

        const snKey = row.serial_number || '__no_serial__';
        if (!pm.serials[snKey]) {
          pm.serials[snKey] = {
            serial_number: row.serial_number || '',
            total_ordered: 0, total_received: 0, total_produced: 0, total_shipped: 0,
            skus: []
          };
        }
        const sm = pm.serials[snKey];
        sm.total_ordered += row.ordered_qty;
        sm.total_received += row.received_qty;
        sm.total_produced += row.produced_qty;
        sm.total_shipped += row.shipped_to_buyer;
        sm.skus.push(row);
      }

      // Convert to arrays and compute percentages
      const hierarchy = Object.values(vendorMap).map(vm => ({
        ...vm,
        progress_pct: vm.total_ordered > 0 ? Math.round((vm.total_produced / vm.total_ordered) * 100) : 0,
        pos: Object.values(vm.pos).map(pm => ({
          ...pm,
          progress_pct: pm.total_ordered > 0 ? Math.round((pm.total_produced / pm.total_ordered) * 100) : 0,
          serials: Object.values(pm.serials).map(sm => ({
            ...sm,
            progress_pct: sm.total_ordered > 0 ? Math.round((sm.total_produced / sm.total_ordered) * 100) : 0,
          }))
        }))
      }));

      // Return hierarchy + flat + invalid records
      return NextResponse.json({ hierarchy, flat: mergedRows, invalid_records: invalidRows });
    }

    // PRODUCTION JOBS (GET)
    if (path[0] === 'production-jobs') {
      if (path[1]) {
        const job = await db.collection('production_jobs').findOne({ id: path[1] });
        if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const items = await db.collection('production_job_items').find({ job_id: path[1] }).toArray();
        // Enrich items with defect quantities and available_qty
        const enrichedItems = await Promise.all(items.map(async item => {
          const defects = await db.collection('material_defect_reports').find({ job_item_id: item.id }).toArray();
          const totalDefect = defects.reduce((s, d) => s + (d.defect_qty || 0), 0);
          const effectiveAvailable = Math.max(0, (item.available_qty ?? item.shipment_qty ?? 0) - totalDefect);
          return { ...item, total_defect_qty: totalDefect, effective_available_qty: effectiveAvailable };
        }));
        const childJobs = await db.collection('production_jobs').find({ parent_job_id: path[1] }).toArray();
        return NextResponse.json({ ...job, items: enrichedItems, child_jobs: childJobs });
      }
      const filter = {};
      if (user.role === 'vendor') filter.vendor_id = user.vendor_id;
      const vendorF = sp.get('vendor_id');
      if (vendorF) filter.vendor_id = vendorF;
      // By default only return parent jobs (parent_job_id null/absent) unless include_children param
      const includeChildren = sp.get('include_children') === 'true';
      if (!includeChildren) filter.parent_job_id = { $in: [null, undefined, ''] };
      const jobs = await db.collection('production_jobs').find(filter).sort({ created_at: -1 }).toArray();
      const enriched = await Promise.all(jobs.map(async j => {
        const items = await db.collection('production_job_items').find({ job_id: j.id }).toArray();
        // Get child jobs
        const childJobs = await db.collection('production_jobs').find({ parent_job_id: j.id }).toArray();
        // Aggregate quantities including child jobs
        let totalOrdered = items.reduce((s, i) => s + (i.ordered_qty || 0), 0);
        let totalAvailable = items.reduce((s, i) => s + (i.available_qty ?? i.shipment_qty ?? 0), 0);
        let totalProduced = items.reduce((s, i) => s + (i.produced_qty || 0), 0);
        for (const child of childJobs) {
          const childItems = await db.collection('production_job_items').find({ job_id: child.id }).toArray();
          totalAvailable += childItems.reduce((s, i) => s + (i.available_qty ?? i.shipment_qty ?? 0), 0);
          totalProduced += childItems.reduce((s, i) => s + (i.produced_qty || 0), 0);
        }
        const serialNumbers = [...new Set(items.map(i => i.serial_number).filter(Boolean))];
        return {
          ...j,
          item_count: items.length,
          total_ordered: totalOrdered, total_available: totalAvailable, total_produced: totalProduced,
          progress_pct: totalAvailable > 0 ? Math.round((totalProduced / totalAvailable) * 100) : 0,
          serial_numbers: serialNumbers,
          child_job_count: childJobs.length,
          child_jobs: childJobs.map(c => ({ id: c.id, job_number: c.job_number, status: c.status, shipment_type: c.shipment_type }))
        };
      }));
      return NextResponse.json(enriched);
    }

    // PRODUCTION JOB ITEMS (GET) — includes shipped_to_buyer for continuation logic
    if (path[0] === 'production-job-items') {
      const jobId = sp.get('job_id');
      if (!jobId) return NextResponse.json({ error: 'job_id required' }, { status: 400 });
      const items = await db.collection('production_job_items').find({ job_id: jobId }).toArray();

      // Find all child jobs for this parent job
      const childJobs = await db.collection('production_jobs').find({ parent_job_id: jobId }).toArray();
      const childJobIds = childJobs.map(c => c.id);

      // Load child job items grouped by po_item_id for merging (using internal UUID)
      const childItemsByPoItem = {};
      for (const cjId of childJobIds) {
        const cjItems = await db.collection('production_job_items').find({ job_id: cjId }).toArray();
        for (const ci of cjItems) {
          // Use po_item_id as unique key; fall back to own id to avoid merging different records
          const key = ci.po_item_id || ci.id;
          if (!childItemsByPoItem[key]) childItemsByPoItem[key] = [];
          childItemsByPoItem[key].push(ci);
        }
      }

      const enriched = await Promise.all(items.map(async item => {
        const progressHistory = await db.collection('production_progress')
          .find({ job_item_id: item.id }).sort({ progress_date: -1 }).toArray();

        // Child job produced_qty for same po_item (matched by internal UUID)
        const key = item.po_item_id || item.id;
        const childItems = childItemsByPoItem[key] || [];
        const child_produced_qty = childItems.reduce((s, ci) => s + (ci.produced_qty || 0), 0);
        const total_produced_qty = (item.produced_qty || 0) + child_produced_qty;

        // Cumulative shipped to buyer (for this job_item or po_item, including child job items)
        const allJobItemIds = [item.id, ...childItems.map(ci => ci.id)];
        const buyerFilter = item.po_item_id
          ? { po_item_id: item.po_item_id }
          : { job_item_id: { $in: allJobItemIds } };
        const buyerItems = await db.collection('buyer_shipment_items').find(buyerFilter).toArray();
        const shipped_to_buyer = buyerItems.reduce((s, b) => s + (b.qty_shipped || 0), 0);
        const remaining_to_ship = Math.max(0, total_produced_qty - shipped_to_buyer);

        return {
          ...item,
          progress_history: progressHistory,
          shipped_to_buyer,
          remaining_to_ship,
          child_produced_qty,
          total_produced_qty
        };
      }));
      return NextResponse.json(enriched);
    }

    // PRODUCTION MONITORING V2 (vendor-grouped, uses production_jobs + job_items)
    if (path[0] === 'production-monitoring-v2') {
      const vendorId = sp.get('vendor_id');
      const gQuery = { status: 'active' };
      if (vendorId) gQuery.id = vendorId;
      const garments = await db.collection('garments').find(gQuery).toArray();
      const now = new Date();
      const threeDaysOut = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      const result = await Promise.all(garments.map(async (g) => {
        // Get parent jobs only (no parent_job_id)
        const parentJobs = await db.collection('production_jobs').find({ 
          vendor_id: g.id,
          $or: [{ parent_job_id: null }, { parent_job_id: '' }, { parent_job_id: { $exists: false } }]
        }).sort({ created_at: -1 }).toArray();
        if (parentJobs.length === 0) return null;

        // For each parent job, also get child jobs
        const allJobItems = [];
        const allJobs = [...parentJobs];
        for (const job of parentJobs) {
          const childJobs = await db.collection('production_jobs').find({ parent_job_id: job.id }).toArray();
          allJobs.push(...childJobs);
          
          const items = await db.collection('production_job_items').find({ job_id: job.id }).toArray();
          const po = job.po_id ? await db.collection('production_pos').findOne({ id: job.po_id }) : null;
          
          for (const item of items) {
            // Get child job production for this same po_item — match by internal UUID only
            let childProduced = 0;
            for (const cj of childJobs) {
              let cji = null;
              if (item.po_item_id) {
                // Primary: match by po_item_id (internal UUID - guaranteed unique)
                cji = await db.collection('production_job_items').findOne({ 
                  job_id: cj.id, po_item_id: item.po_item_id
                });
              }
              // Only fall back to id-based match if no po_item_id at all
              if (!cji && !item.po_item_id && item.vendor_shipment_item_id) {
                cji = await db.collection('production_job_items').findOne({ 
                  job_id: cj.id, vendor_shipment_item_id: item.vendor_shipment_item_id
                });
              }
              if (cji) childProduced += cji.produced_qty || 0;
            }
            
            // Buyer shipped qty
            const buyerFilter = item.po_item_id ? { po_item_id: item.po_item_id } : { job_item_id: item.id };
            const buyerItems = await db.collection('buyer_shipment_items').find(buyerFilter).toArray();
            const shipped_qty = buyerItems.reduce((s, b) => s + (b.qty_shipped || 0), 0);
            
            const totalProducedForItem = (item.produced_qty || 0) + childProduced;
            
            allJobItems.push({ 
              ...item, job, po, shipped_qty,
              child_produced_qty: childProduced,
              total_produced_qty: totalProducedForItem,
              remaining_qty: Math.max(0, (item.ordered_qty || 0) - totalProducedForItem),
              remaining_to_ship: Math.max(0, totalProducedForItem - shipped_qty),
              serial_number: item.serial_number || '',
            });
          }
        }

        const totalQty = allJobItems.reduce((s, i) => s + (i.ordered_qty || 0), 0);
        const totalProduced = allJobItems.reduce((s, i) => s + (i.total_produced_qty || 0), 0);
        const totalShipped = allJobItems.reduce((s, i) => s + (i.shipped_qty || 0), 0);
        const progressPct = totalQty > 0 ? Math.round((totalProduced / totalQty) * 100) : 0;

        // Group job_items by PO for structured display
        const poMap = {};
        for (const item of allJobItems) {
          const poId = item.po?.id || 'unknown';
          if (!poMap[poId]) {
            poMap[poId] = { po: item.po, job: item.job, items: [] };
          }
          poMap[poId].items.push(item);
        }

        const uniquePos = Object.values(poMap).filter(p => p.po);
        const activeJobs = parentJobs.filter(j => j.status === 'In Progress');
        const hasOverdue = activeJobs.some(j => j.deadline && new Date(j.deadline) < now);
        const hasAtRisk = !hasOverdue && activeJobs.some(j => j.deadline && new Date(j.deadline) < threeDaysOut);
        const performance = hasOverdue ? 'Overdue' : hasAtRisk ? 'At Risk' : 'On Track';

        // Build per-job summary with parent+child totals
        const jobsWithTotals = parentJobs.map(job => {
          const itemsForJob = allJobItems.filter(i => i.job?.id === job.id);
          const jobOrdered = itemsForJob.reduce((s, i) => s + (i.ordered_qty || 0), 0);
          const jobProduced = itemsForJob.reduce((s, i) => s + (i.total_produced_qty || 0), 0);
          const jobShipped = itemsForJob.reduce((s, i) => s + (i.shipped_qty || 0), 0);
          const serialNumbers = [...new Set(itemsForJob.map(i => i.serial_number).filter(Boolean))];
          const childJobs = allJobs.filter(j => j.parent_job_id === job.id);
          return { 
            ...job, ordered_qty: jobOrdered, produced_qty: jobProduced, shipped_qty: jobShipped, 
            serial_numbers: serialNumbers, child_job_count: childJobs.length,
            child_jobs: childJobs.map(cj => ({ id: cj.id, job_number: cj.job_number, status: cj.status })),
          };
        });

        return {
          vendor_id: g.id, vendor_name: g.garment_name, vendor_code: g.garment_code,
          location: g.location || '', monthly_capacity: g.monthly_capacity || 0,
          total_jobs: parentJobs.length,
          jobs_by_status: {
            in_progress: parentJobs.filter(j => j.status === 'In Progress').length,
            completed: parentJobs.filter(j => j.status === 'Completed').length,
          },
          total_qty: totalQty, total_produced: totalProduced, total_shipped: totalShipped,
          progress_pct: progressPct, performance,
          po_groups: uniquePos,
          jobs: jobsWithTotals
        };
      }));
      return NextResponse.json(result.filter(Boolean));
    }

    // MATERIAL REQUESTS (GET) — vendor additional/replacement requests
    if (path[0] === 'material-requests') {
      if (path[1]) {
        const req = await db.collection('material_requests').findOne({ id: path[1] });
        if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(req);
      }
      const query = {};
      if (user.role === 'vendor') query.vendor_id = user.vendor_id;
      const reqType = sp.get('request_type');
      const reqStatus = sp.get('status');
      if (reqType) query.request_type = reqType;
      if (reqStatus) query.status = reqStatus;
      const reqs = await db.collection('material_requests').find(query).sort({ created_at: -1 }).toArray();
      return NextResponse.json(reqs);
    }

    // VENDOR MATERIAL INSPECTIONS (GET)
    if (path[0] === 'vendor-material-inspections') {
      const query = {};
      if (user.role === 'vendor') query.vendor_id = user.vendor_id;
      const vendorFilter = sp.get('vendor_id');
      if (vendorFilter) query.vendor_id = vendorFilter;
      const shipmentId = sp.get('shipment_id');
      if (shipmentId) query.shipment_id = shipmentId;
      const inspections = await db.collection('vendor_material_inspections').find(query).sort({ created_at: -1 }).toArray();
      const enriched = await Promise.all(inspections.map(async insp => {
        const shipment = insp.shipment_id ? await db.collection('vendor_shipments').findOne({ id: insp.shipment_id }) : null;
        const items = await db.collection('vendor_material_inspection_items').find({ inspection_id: insp.id }).toArray();
        return { ...insp, shipment_number: shipment?.shipment_number || '', items };
      }));
      return NextResponse.json(enriched);
    }

    // MATERIAL DEFECT REPORTS (GET)
    if (path[0] === 'material-defect-reports') {
      const query = {};
      if (user.role === 'vendor') query.vendor_id = user.vendor_id;
      const vendorFilter = sp.get('vendor_id');
      if (vendorFilter) query.vendor_id = vendorFilter;
      return NextResponse.json(await db.collection('material_defect_reports').find(query).sort({ created_at: -1 }).toArray());
    }

    // PRODUCTION RETURNS (GET)
    if (path[0] === 'production-returns') {
      if (path[1]) {
        const ret = await db.collection('production_returns').findOne({ id: path[1] });
        if (!ret) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const items = await db.collection('production_return_items').find({ return_id: path[1] }).toArray();
        return NextResponse.json({ ...ret, items });
      }
      const query = {};
      const status = sp.get('status');
      if (status) query.status = status;
      const returns = await db.collection('production_returns').find(query).sort({ created_at: -1 }).toArray();
      // Include items for expandable rows
      const returnsWithItems = await Promise.all(returns.map(async r => {
        const items = await db.collection('production_return_items').find({ return_id: r.id }).toArray();
        return { ...r, items };
      }));
      return NextResponse.json(returnsWithItems);
    }

    // ─── INVOICE ADJUSTMENTS (GET) ────────────────────────────────────────────
    if (path[0] === 'invoice-adjustments') {
      const invoiceId = sp.get('invoice_id');
      if (!invoiceId) return NextResponse.json({ error: 'invoice_id required' }, { status: 400 });
      const adjustments = await db.collection('invoice_adjustments').find({ invoice_id: invoiceId }).sort({ created_at: -1 }).toArray();
      return NextResponse.json(adjustments);
    }

    // ─── COMPANY SETTINGS (GET) ─────────────────────────────────────────────
    if (path[0] === 'company-settings') {
      let settings = await db.collection('company_settings').findOne({ type: 'general' });
      if (!settings) {
        settings = {
          id: uuidv4(), type: 'general',
          company_name: 'PT Garment ERP System',
          company_address: '',
          company_phone: '',
          company_email: '',
          company_website: '',
          company_logo_url: '',
          pdf_header_line1: '',
          pdf_header_line2: '',
          pdf_footer_text: '',
          created_at: new Date(), updated_at: new Date()
        };
        await db.collection('company_settings').insertOne(settings);
      }
      return NextResponse.json(settings);
    }

    // ─── REPORTS (GET) ──────────────────────────────────────────────────────
    if (path[0] === 'reports') {
      const reportType = path[1];
      const dateFrom = sp.get('date_from');
      const dateTo = sp.get('date_to');
      const vendorId = sp.get('vendor_id');
      const poId = sp.get('po_id');
      const serialNumber = sp.get('serial_number');
      const status = sp.get('status');

      // Helper to build date range filter
      const buildDateRange = (field) => {
        if (!dateFrom && !dateTo) return {};
        const range = {};
        if (dateFrom) range.$gte = new Date(dateFrom);
        if (dateTo) { const d = new Date(dateTo); d.setHours(23,59,59,999); range.$lte = d; }
        return { [field]: range };
      };

      if (reportType === 'production') {
        // Full production report with exact column spec
        const poQuery = {};
        if (poId) poQuery.id = poId;
        if (status) poQuery.status = status;
        if (dateFrom || dateTo) Object.assign(poQuery, buildDateRange('created_at'));
        
        const pos = await db.collection('production_pos').find(poQuery).sort({ created_at: -1 }).toArray();
        const rows = [];
        
        for (const po of pos) {
          if (vendorId && po.vendor_id !== vendorId) continue;
          const items = await db.collection('po_items').find({ po_id: po.id }).toArray();
          
          for (const item of items) {
            if (serialNumber && item.serial_number !== serialNumber) continue;
            
            // Get production job items for this po_item
            const jobItems = await db.collection('production_job_items').find({ po_item_id: item.id }).toArray();
            let totalProduced = 0;
            let totalShipped = 0;
            
            for (const ji of jobItems) {
              totalProduced += ji.produced_qty || 0;
              // Check child jobs
              const parentJob = await db.collection('production_jobs').findOne({ id: ji.job_id });
              if (parentJob) {
                const childJobs = await db.collection('production_jobs').find({ parent_job_id: parentJob.id }).toArray();
                for (const cj of childJobs) {
                  const cji = await db.collection('production_job_items').findOne({ job_id: cj.id, po_item_id: item.id });
                  if (cji) totalProduced += cji.produced_qty || 0;
                }
              }
            }
            
            // Shipped to buyer
            const buyerItems = await db.collection('buyer_shipment_items').find({ po_item_id: item.id }).toArray();
            totalShipped = buyerItems.reduce((s, b) => s + (b.qty_shipped || 0), 0);
            
            const garment = po.vendor_id ? await db.collection('garments').findOne({ id: po.vendor_id }) : null;
            
            rows.push({
              tanggal: po.po_date || po.created_at,
              no_po: po.po_number,
              no_seri: item.serial_number || '',
              kode_produk: item.sku || '',
              nama_produk: item.product_name || '',
              kategori: item.category || '',
              size: item.size || '',
              sku: item.sku || '',
              warna: item.color || '',
              output_qty: item.qty || 0,
              harga: item.selling_price_snapshot || 0,
              hpp: item.cmt_price_snapshot || 0,
              hasil_po: (item.qty || 0) * (item.selling_price_snapshot || 0),
              total_hpp: (item.qty || 0) * (item.cmt_price_snapshot || 0),
              garment: garment?.garment_name || po.vendor_name || '',
              note: po.notes || '',
              qty_sudah_diproduksi: totalProduced,
              qty_belum_diproduksi: Math.max(0, (item.qty || 0) - totalProduced),
              qty_sudah_dikirim: totalShipped,
              po_id: po.id,
              po_item_id: item.id,
              po_status: po.status,
              deadline: po.deadline,
            });
          }
        }
        return NextResponse.json(rows);
      }

      if (reportType === 'progress') {
        // Progress report with full history
        const progressQuery = {};
        if (dateFrom || dateTo) Object.assign(progressQuery, buildDateRange('progress_date'));
        
        const progresses = await db.collection('production_progress').find(progressQuery).sort({ progress_date: -1 }).toArray();
        const rows = [];
        
        for (const p of progresses) {
          // Get job item details
          const jobItem = p.job_item_id ? await db.collection('production_job_items').findOne({ id: p.job_item_id }) : null;
          const job = p.job_id ? await db.collection('production_jobs').findOne({ id: p.job_id }) : null;
          const wo = p.work_order_id ? await db.collection('work_orders').findOne({ id: p.work_order_id }) : null;
          
          // Filter by vendor
          if (vendorId && job?.vendor_id !== vendorId && wo?.garment_id !== vendorId) continue;
          
          // Get PO info
          const po = job?.po_id ? await db.collection('production_pos').findOne({ id: job.po_id }) : 
                     wo?.po_id ? await db.collection('production_pos').findOne({ id: wo.po_id }) : null;
          if (poId && po?.id !== poId) continue;
          if (serialNumber && jobItem?.serial_number !== serialNumber) continue;
          
          // Calculate cumulative
          const allProgressForItem = p.job_item_id 
            ? await db.collection('production_progress').find({ job_item_id: p.job_item_id }).toArray()
            : [];
          const cumulativeProduced = allProgressForItem.reduce((s, pp) => s + (pp.completed_quantity || pp.qty_produced || 0), 0);
          
          // Get shipped qty
          const buyerItems = jobItem?.po_item_id 
            ? await db.collection('buyer_shipment_items').find({ po_item_id: jobItem.po_item_id }).toArray()
            : [];
          const cumulativeShipped = buyerItems.reduce((s, b) => s + (b.qty_shipped || 0), 0);
          
          const garment = job?.vendor_id ? await db.collection('garments').findOne({ id: job.vendor_id }) :
                          wo?.garment_id ? await db.collection('garments').findOne({ id: wo.garment_id }) : null;
          
          rows.push({
            date: p.progress_date || p.created_at,
            po_number: po?.po_number || p.po_number || '',
            serial_number: jobItem?.serial_number || p.serial_number || '',
            vendor: garment?.garment_name || job?.vendor_name || wo?.garment_name || '',
            sku: jobItem?.sku || p.sku || '',
            product_name: jobItem?.product_name || p.product_name || '',
            qty_progress: p.completed_quantity || p.qty_produced || 0,
            cumulative_produced: cumulativeProduced,
            cumulative_shipped: cumulativeShipped,
            status: job?.status || wo?.status || '',
            notes: p.notes || '',
            operator: p.recorded_by || p.created_by || '',
            job_number: job?.job_number || wo?.distribution_code || '',
            is_child_job: !!job?.parent_job_id,
          });
        }
        return NextResponse.json(rows);
      }

      if (reportType === 'financial') {
        const invQuery = {};
        if (dateFrom || dateTo) Object.assign(invQuery, buildDateRange('created_at'));
        if (vendorId) invQuery.$or = [{ garment_id: vendorId }, { vendor_id: vendorId }];
        if (status) invQuery.status = status;
        
        const invoices = await db.collection('invoices').find(invQuery).sort({ created_at: -1 }).toArray();
        const rows = [];
        
        for (const inv of invoices) {
          // Get adjustments
          const adjustments = await db.collection('invoice_adjustments').find({ invoice_id: inv.id }).toArray();
          const totalAdjAdd = adjustments.filter(a => a.adjustment_type === 'ADD').reduce((s, a) => s + (a.amount || 0), 0);
          const totalAdjDeduct = adjustments.filter(a => a.adjustment_type === 'DEDUCT').reduce((s, a) => s + (a.amount || 0), 0);
          const adjustedTotal = (inv.total_amount || 0) + totalAdjAdd - totalAdjDeduct;
          
          rows.push({
            invoice_number: inv.invoice_number,
            invoice_category: inv.invoice_category || '',
            invoice_type: inv.invoice_type || '',
            po_number: inv.po_number || '',
            vendor_or_customer: inv.vendor_or_customer_name || inv.vendor_name || inv.customer_name || '',
            base_amount: inv.total_amount || 0,
            adjustment_add: totalAdjAdd,
            adjustment_deduct: totalAdjDeduct,
            adjusted_total: adjustedTotal,
            total_paid: inv.total_paid || 0,
            remaining: adjustedTotal - (inv.total_paid || 0),
            status: inv.status,
            created_at: inv.created_at,
            adjustment_count: adjustments.length,
          });
        }
        return NextResponse.json(rows);
      }

      if (reportType === 'shipment') {
        // Combined vendor + buyer shipment report
        const vsQuery = {};
        const bsQuery = {};
        if (dateFrom || dateTo) {
          Object.assign(vsQuery, buildDateRange('shipment_date'));
          Object.assign(bsQuery, buildDateRange('shipment_date'));
        }
        if (vendorId) { vsQuery.vendor_id = vendorId; bsQuery.vendor_id = vendorId; }
        if (status) { vsQuery.status = status; bsQuery.status = status; }
        
        const vendorShipments = await db.collection('vendor_shipments').find(vsQuery).sort({ created_at: -1 }).toArray();
        const buyerShipments = await db.collection('buyer_shipments').find(bsQuery).sort({ created_at: -1 }).toArray();
        
        const rows = [];
        for (const vs of vendorShipments) {
          const items = await db.collection('vendor_shipment_items').find({ shipment_id: vs.id }).toArray();
          const totalQty = items.reduce((s, i) => s + (i.qty_sent || 0), 0);
          rows.push({
            direction: 'VENDOR → PRODUKSI',
            shipment_number: vs.shipment_number,
            shipment_type: vs.shipment_type || 'NORMAL',
            vendor_name: vs.vendor_name || '',
            date: vs.shipment_date || vs.created_at,
            total_qty: totalQty,
            item_count: items.length,
            status: vs.status,
            inspection_status: vs.inspection_status || 'Pending',
            parent_shipment_id: vs.parent_shipment_id || '',
            notes: vs.notes || '',
          });
        }
        for (const bs of buyerShipments) {
          const items = await db.collection('buyer_shipment_items').find({ shipment_id: bs.id }).toArray();
          const totalQty = items.reduce((s, i) => s + (i.qty_shipped || 0), 0);
          rows.push({
            direction: 'PRODUKSI → BUYER',
            shipment_number: bs.shipment_number,
            shipment_type: 'NORMAL',
            vendor_name: bs.vendor_name || '',
            date: bs.shipment_date || bs.created_at,
            total_qty: totalQty,
            item_count: items.length,
            status: bs.status,
            inspection_status: '',
            parent_shipment_id: '',
            notes: bs.notes || '',
          });
        }
        return NextResponse.json(rows);
      }

      if (reportType === 'return') {
        const retQuery = {};
        if (dateFrom || dateTo) Object.assign(retQuery, buildDateRange('return_date'));
        if (status) retQuery.status = status;
        
        const returns = await db.collection('production_returns').find(retQuery).sort({ created_at: -1 }).toArray();
        const rows = [];
        for (const ret of returns) {
          const items = await db.collection('production_return_items').find({ return_id: ret.id }).toArray();
          if (vendorId && ret.vendor_id !== vendorId) continue;
          rows.push({
            return_number: ret.return_number || '',
            vendor_name: ret.vendor_name || '',
            po_number: ret.po_number || '',
            return_date: ret.return_date || ret.created_at,
            total_qty: items.reduce((s, i) => s + (i.qty || 0), 0),
            item_count: items.length,
            reason: ret.reason || '',
            status: ret.status || '',
            notes: ret.notes || '',
            items: items.map(i => ({
              sku: i.sku || '', product_name: i.product_name || '',
              serial_number: i.serial_number || '', qty: i.qty || 0,
              size: i.size || '', color: i.color || '',
            })),
          });
        }
        return NextResponse.json(rows);
      }

      if (reportType === 'missing-material') {
        const mrQuery = { request_type: 'ADDITIONAL' };
        if (dateFrom || dateTo) Object.assign(mrQuery, buildDateRange('created_at'));
        if (vendorId) mrQuery.vendor_id = vendorId;
        if (status) mrQuery.status = status;
        
        const requests = await db.collection('material_requests').find(mrQuery).sort({ created_at: -1 }).toArray();
        const rows = requests.map(r => ({
          request_number: r.request_number || '',
          request_type: r.request_type,
          vendor_name: r.vendor_name || '',
          po_number: r.po_number || '',
          serial_number: r.serial_number || '',
          sku: r.sku || '',
          requested_qty: r.requested_qty || 0,
          reason: r.reason || '',
          status: r.status || 'Pending',
          child_shipment_number: r.child_shipment_number || '',
          created_at: r.created_at,
          approved_by: r.approved_by || '',
          notes: r.notes || '',
        }));
        return NextResponse.json(rows);
      }

      if (reportType === 'replacement') {
        const mrQuery = { request_type: 'REPLACEMENT' };
        if (dateFrom || dateTo) Object.assign(mrQuery, buildDateRange('created_at'));
        if (vendorId) mrQuery.vendor_id = vendorId;
        if (status) mrQuery.status = status;
        
        const requests = await db.collection('material_requests').find(mrQuery).sort({ created_at: -1 }).toArray();
        const rows = requests.map(r => ({
          request_number: r.request_number || '',
          request_type: r.request_type,
          vendor_name: r.vendor_name || '',
          po_number: r.po_number || '',
          serial_number: r.serial_number || '',
          sku: r.sku || '',
          requested_qty: r.requested_qty || 0,
          reason: r.reason || '',
          status: r.status || 'Pending',
          child_shipment_number: r.child_shipment_number || '',
          created_at: r.created_at,
          approved_by: r.approved_by || '',
          notes: r.notes || '',
        }));
        return NextResponse.json(rows);
      }

      return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────────
export async function POST(request, { params }) {
  const path = params?.path || [];
  const db = await getDb();

  try {
    // AUTH LOGIN
    if (path[0] === 'auth' && path[1] === 'login') {
      const { email, password } = await request.json();
      const u = await db.collection('users').findOne({ email });
      if (!u || !(await bcrypt.compare(password, u.password))) return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
      if (u.status !== 'active') return NextResponse.json({ error: 'Akun tidak aktif' }, { status: 403 });
      const token = jwt.sign({ id: u.id, email: u.email, role: u.role, name: u.name, vendor_id: u.vendor_id || null }, JWT_SECRET, { expiresIn: '24h' });
      await logActivity(db, u.id, u.name, 'Login', 'Auth', `User ${u.email} logged in`);
      return NextResponse.json({ token, user: { id: u.id, name: u.name, email: u.email, role: u.role, vendor_id: u.vendor_id || null } });
    }

    const user = verifyToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();

    // GARMENTS - auto-create vendor account
    if (path[0] === 'garments') {
      if (!checkRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const garmentId = uuidv4();
      const codeSlug = (body.garment_code || garmentId).toLowerCase().replace(/[^a-z0-9]/g, '');
      const vendorEmail = `vendor.${codeSlug}@garment.com`;
      const rawPassword = generatePassword(10);
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      await db.collection('users').insertOne({
        id: uuidv4(), name: body.garment_name, email: vendorEmail,
        password: hashedPassword, role: 'vendor', vendor_id: garmentId,
        status: 'active', created_at: new Date(), updated_at: new Date()
      });
      const garment = {
        id: garmentId, ...body, status: body.status || 'active',
        login_email: vendorEmail, vendor_password_plain: rawPassword,
        created_at: new Date(), updated_at: new Date()
      };
      await db.collection('garments').insertOne(garment);
      await logActivity(db, user.id, user.name, 'Create', 'Garments', `Created garment: ${garment.garment_name}, vendor account: ${vendorEmail}`);
      return NextResponse.json({ ...garment, vendor_account: { email: vendorEmail, password: rawPassword } }, { status: 201 });
    }

    // PRODUCTS
    if (path[0] === 'products') {
      if (!checkRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const product = { id: uuidv4(), ...body, status: body.status || 'active', created_at: new Date(), updated_at: new Date() };
      await db.collection('products').insertOne(product);
      await logActivity(db, user.id, user.name, 'Create', 'Products', `Created product: ${product.product_name}`);
      return NextResponse.json(product, { status: 201 });
    }

    // PRODUCT VARIANTS
    if (path[0] === 'product-variants') {
      if (!checkRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const product = await db.collection('products').findOne({ id: body.product_id });
      if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      // NOTE: SKU CAN be duplicate across different products. No uniqueness check on SKU alone.
      // Previously: const dupSku = await db.collection('product_variants').findOne({ sku: body.sku });
      //             if (dupSku) return error "SKU already used";
      const variant = {
        id: uuidv4(), product_id: body.product_id,
        product_code: product.product_code, product_name: product.product_name,
        size: body.size || '', color: body.color || '', sku: body.sku || '',
        status: 'active', created_at: new Date()
      };
      await db.collection('product_variants').insertOne(variant);
      await logActivity(db, user.id, user.name, 'Create', 'Product Variants', `Added variant SKU: ${body.sku} for ${product.product_name}`);
      return NextResponse.json(variant, { status: 201 });
    }

    // PO MANUAL CLOSE - Check this BEFORE general production-pos endpoint
    if (path[0] === 'production-pos' && path[1] && path[2] === 'close') {
      if (!checkRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const po = await db.collection('production_pos').findOne({ id: path[1] });
      if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 });
      await db.collection('production_pos').updateOne({ id: path[1] }, {
        $set: {
          status: 'Closed', close_reason: body.close_reason, close_notes: body.close_notes || '',
          closed_by: user.name, closed_at: new Date(), updated_at: new Date()
        }
      });
      await logActivity(db, user.id, user.name, 'Close PO', 'Production PO', `Closed PO: ${po.po_number} - Alasan: ${body.close_reason}`);
      return NextResponse.json({ success: true });
    }

    // PRODUCTION POs (multi-item, manual PO number)
    if (path[0] === 'production-pos') {
      if (!checkRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (!body.po_number) return NextResponse.json({ error: 'Nomor PO wajib diisi' }, { status: 400 });
      // NOTE: PO number CAN be duplicate. Unique identifier = PO Number + Vendor Name + PO Created Date
      // No uniqueness check on po_number alone.
      // Resolve vendor name if vendor_id provided
      let vendorName = '';
      if (body.vendor_id) {
        const vendorDoc = await db.collection('garments').findOne({ id: body.vendor_id });
        vendorName = vendorDoc?.garment_name || '';
      }
      const poId = uuidv4();
      const initialStatus = body.status === 'Confirmed' ? 'Confirmed' : 'Draft';
      const po = {
        id: poId, po_number: body.po_number, customer_name: body.customer_name || '',
        vendor_id: body.vendor_id || null, vendor_name: vendorName,
        po_date: body.po_date ? new Date(body.po_date) : new Date(),
        deadline: body.deadline ? new Date(body.deadline) : null,
        delivery_deadline: body.delivery_deadline ? new Date(body.delivery_deadline) : null,
        status: initialStatus, notes: body.notes || '',
        created_by: user.name, created_at: new Date(), updated_at: new Date()
      };
      await db.collection('production_pos').insertOne(po);
      const items = body.items || [];
      const insertedItems = [];
      for (const item of items) {
        const variant = item.variant_id ? await db.collection('product_variants').findOne({ id: item.variant_id }) : null;
        const product = await db.collection('products').findOne({ id: item.product_id });
        const poItem = {
          id: uuidv4(), po_id: poId, po_number: body.po_number,
          product_id: item.product_id, product_name: product?.product_name || '',
          variant_id: item.variant_id || null, size: variant?.size || item.size || '',
          color: variant?.color || item.color || '', sku: variant?.sku || item.sku || '',
          qty: Number(item.qty) || 0,
          serial_number: item.serial_number || '',
          selling_price_snapshot: Number(item.selling_price_snapshot) || product?.selling_price || 0,
          cmt_price_snapshot: Number(item.cmt_price_snapshot) || product?.cmt_price || 0,
          created_at: new Date()
        };
        await db.collection('po_items').insertOne(poItem);
        insertedItems.push(poItem);
      }

      // REMOVED: Auto-generate invoices — invoices must be created manually only
      // if (initialStatus === 'Confirmed') { await autoGenerateInvoices(...) }

      await logActivity(db, user.id, user.name, 'Create', 'Production PO', `Created PO: ${po.po_number} with ${items.length} items`);
      return NextResponse.json({ ...po, items: insertedItems }, { status: 201 });
    }

    // WORK ORDERS
    if (path[0] === 'work-orders') {
      if (!checkRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const po = await db.collection('production_pos').findOne({ id: body.po_id });
      if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 });
      const garment = await db.collection('garments').findOne({ id: body.garment_id });
      if (!garment) return NextResponse.json({ error: 'Garment not found' }, { status: 404 });
      const wo = {
        id: uuidv4(), distribution_code: `WO-${po.po_number}-${garment.garment_code}`,
        po_id: body.po_id, po_number: po.po_number, customer_name: po.customer_name,
        garment_id: body.garment_id, garment_name: garment.garment_name, garment_code: garment.garment_code,
        quantity: Number(body.quantity), completed_quantity: 0,
        material_send_date: body.material_send_date ? new Date(body.material_send_date) : null,
        estimated_finish_date: body.estimated_finish_date ? new Date(body.estimated_finish_date) : null,
        status: 'Waiting', notes: body.notes || '',
        created_by: user.name, created_at: new Date(), updated_at: new Date()
      };
      await db.collection('work_orders').insertOne(wo);
      await db.collection('production_pos').updateOne({ id: body.po_id }, { $set: { status: 'Distributed', updated_at: new Date() } });
      await logActivity(db, user.id, user.name, 'Create', 'Work Order', `Distributed PO ${po.po_number} to ${garment.garment_name}`);
      return NextResponse.json(wo, { status: 201 });
    }

    // PRODUCTION JOBS (VENDOR creates from received shipment)
    if (path[0] === 'production-jobs') {
      const vendorId = user.role === 'vendor' ? user.vendor_id : body.vendor_id;
      if (!vendorId) return NextResponse.json({ error: 'vendor_id diperlukan' }, { status: 400 });

      // Validate shipment exists and was received
      const shipment = await db.collection('vendor_shipments').findOne({ id: body.vendor_shipment_id });
      if (!shipment) return NextResponse.json({ error: 'Shipment tidak ditemukan' }, { status: 404 });
      if (shipment.status !== 'Received') return NextResponse.json({ error: 'Shipment belum dikonfirmasi diterima. Konfirmasi dulu di menu Penerimaan Material.' }, { status: 400 });
      if (shipment.vendor_id !== vendorId) return NextResponse.json({ error: 'Shipment ini bukan milik vendor Anda' }, { status: 403 });

      // RULE: Block production start if material inspection not complete
      if (shipment.inspection_status !== 'Inspected') {
        return NextResponse.json({
          error: `Inspeksi material untuk shipment ${shipment.shipment_number} belum selesai. Selesaikan inspeksi material terlebih dahulu sebelum memulai produksi.`,
          requires_inspection: true
        }, { status: 400 });
      }

      // One job per shipment
      const existingJob = await db.collection('production_jobs').findOne({ vendor_shipment_id: body.vendor_shipment_id });
      if (existingJob) return NextResponse.json({ error: `Production Job untuk shipment ${shipment.shipment_number} sudah ada (${existingJob.job_number})` }, { status: 400 });

      // Determine parent job (for child shipments)
      let parentJobId = null, parentJobNumber = null;
      if (shipment.parent_shipment_id) {
        const parentJob = await db.collection('production_jobs').findOne({ vendor_shipment_id: shipment.parent_shipment_id });
        if (parentJob) { parentJobId = parentJob.id; parentJobNumber = parentJob.job_number; }
      }

      // Get PO from shipment items
      const shipItems = await db.collection('vendor_shipment_items').find({ shipment_id: body.vendor_shipment_id }).toArray();
      const poId = body.po_id || shipItems[0]?.po_id;
      const po = poId ? await db.collection('production_pos').findOne({ id: poId }) : null;

      // Validate PO belongs to this vendor (if set)
      if (po && po.vendor_id && po.vendor_id !== vendorId && user.role === 'vendor') {
        return NextResponse.json({ error: 'PO ini tidak ditujukan untuk vendor Anda' }, { status: 403 });
      }

      const jobId = uuidv4();
      const jobSeq = (await db.collection('production_jobs').countDocuments()) + 1;
      let jobNumber;
      if (parentJobNumber) {
        // Child job: JOB-0001-A1 or JOB-0001-R1
        const suffix = shipment.shipment_type === 'ADDITIONAL' ? 'A' : 'R';
        const childCount = await db.collection('production_jobs').countDocuments({ parent_job_id: parentJobId });
        jobNumber = `${parentJobNumber}-${suffix}${childCount + 1}`;
      } else {
        jobNumber = `JOB-${String(jobSeq).padStart(4, '0')}`;
      }

      const job = {
        id: jobId, job_number: jobNumber,
        parent_job_id: parentJobId, parent_job_number: parentJobNumber,
        vendor_id: vendorId, vendor_name: shipment.vendor_name,
        po_id: poId || null, po_number: po?.po_number || '',
        customer_name: po?.customer_name || '',
        vendor_shipment_id: body.vendor_shipment_id,
        shipment_number: shipment.shipment_number,
        shipment_type: shipment.shipment_type || 'NORMAL',
        deadline: po?.deadline || null,
        delivery_deadline: po?.delivery_deadline || null,
        status: 'In Progress', notes: body.notes || '',
        created_by: user.name, created_at: new Date(), updated_at: new Date()
      };
      await db.collection('production_jobs').insertOne(job);

      // Get inspection for this shipment to determine available_qty
      const inspection = await db.collection('vendor_material_inspections').findOne({ shipment_id: body.vendor_shipment_id });

      // Create job items (locked — from shipment items + PO items, qty = available received)
      const insertedItems = [];
      for (const si of shipItems) {
        const poItem = si.po_item_id ? await db.collection('po_items').findOne({ id: si.po_item_id }) : null;
        // Use inspection received_qty as available_qty (not PO qty or sent qty)
        let availableQty = si.qty_sent;
        if (inspection) {
          // Match by shipment_item_id FIRST (internal UUID - guaranteed unique)
          let inspItem = await db.collection('vendor_material_inspection_items').findOne({
            inspection_id: inspection.id,
            shipment_item_id: si.id
          });
          // Only fall back to sku+size+color if no shipment_item_id match
          if (!inspItem) {
            inspItem = await db.collection('vendor_material_inspection_items').findOne({
              inspection_id: inspection.id,
              sku: si.sku, size: si.size || '', color: si.color || ''
            });
          }
          if (inspItem) availableQty = inspItem.received_qty ?? si.qty_sent;
        }
        const ji = {
          id: uuidv4(), job_id: jobId, job_number: jobNumber,
          po_item_id: si.po_item_id || null,
          vendor_shipment_item_id: si.id,
          product_name: si.product_name, sku: si.sku || '', size: si.size || '', color: si.color || '',
          serial_number: poItem?.serial_number || si.serial_number || '',
          ordered_qty: poItem?.qty || si.qty_sent, // Original PO qty for reference
          shipment_qty: si.qty_sent,
          available_qty: availableQty, // Actual received qty = max production qty
          produced_qty: 0,
          created_at: new Date()
        };
        await db.collection('production_job_items').insertOne(ji);
        insertedItems.push(ji);
      }

      // Auto-update PO status to In Production
      if (poId) {
        const currentPO = await db.collection('production_pos').findOne({ id: poId });
        if (currentPO && !['Completed', 'Closed'].includes(currentPO.status)) {
          await db.collection('production_pos').updateOne({ id: poId }, { $set: { status: 'In Production', updated_at: new Date() } });
        }
      }

      await logActivity(db, user.id, user.name, 'Create', 'Production Job', `Created job ${jobNumber} from shipment ${shipment.shipment_number}${parentJobNumber ? ` (child of ${parentJobNumber})` : ''}`);
      return NextResponse.json({ ...job, items: insertedItems }, { status: 201 });
    }

    // PRODUCTION PROGRESS (supports both job_item_id and work_order_id)
    if (path[0] === 'production-progress') {
      // NEW FLOW: per job_item_id
      if (body.job_item_id) {
        const jobItem = await db.collection('production_job_items').findOne({ id: body.job_item_id });
        if (!jobItem) return NextResponse.json({ error: 'Job item tidak ditemukan' }, { status: 404 });

        const qtyToday = Number(body.completed_quantity) || 0;
        if (qtyToday <= 0) return NextResponse.json({ error: 'Jumlah produksi harus lebih dari 0' }, { status: 400 });

        // Validate: total produced cannot exceed available_qty (received - defect)
        const maxQty = jobItem.available_qty ?? jobItem.shipment_qty ?? 0;
        const newTotal = (jobItem.produced_qty || 0) + qtyToday;
        if (newTotal > maxQty) {
          return NextResponse.json({ error: `Total produksi (${newTotal}) melebihi material tersedia (${maxQty} pcs). Material tersedia = Diterima - Cacat.` }, { status: 400 });
        }

        const progress = {
          id: uuidv4(),
          job_id: jobItem.job_id, job_item_id: body.job_item_id,
          sku: jobItem.sku, product_name: jobItem.product_name, size: jobItem.size, color: jobItem.color,
          progress_date: body.progress_date ? new Date(body.progress_date) : new Date(),
          completed_quantity: qtyToday,
          notes: body.notes || '',
          recorded_by: user.name, created_at: new Date()
        };
        await db.collection('production_progress').insertOne(progress);

        // Update job_item produced_qty
        await db.collection('production_job_items').updateOne(
          { id: body.job_item_id },
          { $set: { produced_qty: newTotal, updated_at: new Date() } }
        );

        // Check if all items completed → update job status
        const allItems = await db.collection('production_job_items').find({ job_id: jobItem.job_id }).toArray();
        const allDone = allItems.every(i => (i.id === body.job_item_id ? newTotal : i.produced_qty) >= i.shipment_qty);
        if (allDone) {
          await db.collection('production_jobs').updateOne({ id: jobItem.job_id }, { $set: { status: 'Completed', updated_at: new Date() } });
        }

        await logActivity(db, user.id, user.name, 'Create', 'Production Progress', `Progress ${jobItem.sku}: +${qtyToday} pcs (total: ${newTotal})`);
        return NextResponse.json({ ...progress, new_total: newTotal }, { status: 201 });
      }

      // LEGACY FLOW: work_order_id
      const wo = await db.collection('work_orders').findOne({ id: body.work_order_id });
      if (!wo) return NextResponse.json({ error: 'Work order tidak ditemukan' }, { status: 404 });
      const progress = {
        id: uuidv4(), work_order_id: body.work_order_id, distribution_code: wo.distribution_code,
        garment_id: wo.garment_id, garment_name: wo.garment_name, po_id: wo.po_id, po_number: wo.po_number,
        progress_date: body.progress_date ? new Date(body.progress_date) : new Date(),
        completed_quantity: Number(body.completed_quantity), notes: body.notes || '',
        recorded_by: user.name, created_at: new Date()
      };
      await db.collection('production_progress').insertOne(progress);
      const allProgress = await db.collection('production_progress').find({ work_order_id: body.work_order_id }).toArray();
      const totalCompleted = allProgress.reduce((s, p) => s + p.completed_quantity, 0);
      const newStatus = totalCompleted >= wo.quantity ? 'Completed' : 'In Progress';
      await db.collection('work_orders').updateOne({ id: body.work_order_id }, { $set: { completed_quantity: totalCompleted, status: newStatus, updated_at: new Date() } });
      await db.collection('production_pos').updateOne({ id: wo.po_id }, { $set: { status: 'In Production', updated_at: new Date() } });
      await logActivity(db, user.id, user.name, 'Create', 'Production Progress', `Progress: ${wo.distribution_code} - ${body.completed_quantity} pcs`);
      return NextResponse.json(progress, { status: 201 });
    }

    // VENDOR SHIPMENTS (ERP to vendor)
    if (path[0] === 'vendor-shipments') {
      if (!checkRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const vendor = await db.collection('garments').findOne({ id: body.vendor_id });
      if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
      const dupShip = await db.collection('vendor_shipments').findOne({ shipment_number: body.shipment_number });
      if (dupShip) return NextResponse.json({ error: `Nomor shipment "${body.shipment_number}" sudah digunakan` }, { status: 400 });
      // Validate: PO vendor must match shipment vendor
      const items = body.items || [];
      for (const item of items) {
        if (item.po_id) {
          const po = await db.collection('production_pos').findOne({ id: item.po_id });
          if (po && po.vendor_id && po.vendor_id !== body.vendor_id) {
            return NextResponse.json({ error: `PO ${po.po_number} ditujukan untuk vendor lain, bukan ${vendor.garment_name}. Pastikan vendor shipment sesuai dengan PO.` }, { status: 400 });
          }
        }
      }
      const shipmentId = uuidv4();
      const shipment = {
        id: shipmentId, shipment_number: body.shipment_number,
        delivery_note_number: body.delivery_note_number || '',
        vendor_id: body.vendor_id, vendor_name: vendor.garment_name,
        shipment_date: body.shipment_date ? new Date(body.shipment_date) : new Date(),
        shipment_type: body.shipment_type || 'NORMAL', // NORMAL | ADDITIONAL | REPLACEMENT
        parent_shipment_id: body.parent_shipment_id || null,
        status: 'Sent', notes: body.notes || '',
        created_by: user.name, created_at: new Date(), updated_at: new Date()
      };
      await db.collection('vendor_shipments').insertOne(shipment);
      const insertedItems = [];
      const affectedPOs = new Set();
      for (const item of items) {
        const poItem = item.po_item_id ? await db.collection('po_items').findOne({ id: item.po_item_id }) : null;
        const si = {
          id: uuidv4(), shipment_id: shipmentId, shipment_number: body.shipment_number,
          po_id: item.po_id, po_number: item.po_number,
          po_item_id: item.po_item_id || null,
          source_po_item_id: item.po_item_id || null,
          source_po_number: item.po_number || '',
          source_serial_number: poItem?.serial_number || item.serial_number || '',
          product_id: poItem?.product_id || item.product_id || '',
          product_name: poItem?.product_name || item.product_name || '',
          category: poItem?.category || item.category || '',
          serial_number: poItem?.serial_number || item.serial_number || '',
          size: poItem?.size || item.size || '', color: poItem?.color || item.color || '',
          sku: poItem?.sku || item.sku || '', qty_sent: Number(item.qty_sent) || 0,
          ordered_qty: poItem?.qty || Number(item.ordered_qty) || 0,
          shipment_type: body.shipment_type || 'NORMAL',
          parent_shipment_id: body.parent_shipment_id || null,
          created_at: new Date()
        };
        await db.collection('vendor_shipment_items').insertOne(si);
        insertedItems.push(si);
        if (item.po_id) affectedPOs.add(item.po_id);
      }
      for (const poId of affectedPOs) {
        const po = await db.collection('production_pos').findOne({ id: poId });
        if (po && po.status === 'Draft') await db.collection('production_pos').updateOne({ id: poId }, { $set: { status: 'Distributed', updated_at: new Date() } });
      }
      // Auto-create draft Vendor Invoice (AP) based on CMT prices
      // NOTE: Invoice auto-generation now happens when PO is CONFIRMED, not here.
      // The old vendor-shipment-based invoice creation has been replaced by PO-confirmation trigger.

      await logActivity(db, user.id, user.name, 'Create', 'Vendor Shipment', `Created shipment ${body.shipment_number} to ${vendor.garment_name}`);
      return NextResponse.json({ ...shipment, items: insertedItems }, { status: 201 });
    }

    // BUYER SHIPMENTS (vendor to buyer) — cumulative per job, multiple dispatches
    if (path[0] === 'buyer-shipments') {
      const vendorId = user.role === 'vendor' ? user.vendor_id : body.vendor_id;
      const vendorDoc = await db.collection('garments').findOne({ id: vendorId });
      const po = body.po_id ? await db.collection('production_pos').findOne({ id: body.po_id }) : null;
      const jobId = body.job_id || null;

      // Find or create master buyer_shipment record per job
      let masterShipment = null;
      if (jobId) {
        masterShipment = await db.collection('buyer_shipments').findOne({ job_id: jobId, vendor_id: vendorId });
      }

      const isNew = !masterShipment;
      let shipmentId;

      if (isNew) {
        // Create master shipment record
        shipmentId = uuidv4();
        masterShipment = {
          id: shipmentId,
          shipment_number: body.shipment_number || `BS-${Date.now()}`,
          vendor_id: vendorId, vendor_name: vendorDoc?.garment_name || user.name,
          po_id: body.po_id || null, po_number: po?.po_number || body.po_number || '',
          customer_name: po?.customer_name || body.customer_name || '',
          job_id: jobId,
          ship_status: 'Pending',
          notes: body.notes || '',
          created_by: user.name, created_at: new Date(), updated_at: new Date()
        };
        await db.collection('buyer_shipments').insertOne(masterShipment);
      } else {
        shipmentId = masterShipment.id;
      }

      // Get current dispatch sequence
      const existingItems = await db.collection('buyer_shipment_items').find({ shipment_id: shipmentId }).toArray();
      const maxDispatch = existingItems.length > 0 ? Math.max(...existingItems.map(i => i.dispatch_seq || 1)) : 0;
      const dispatchSeq = maxDispatch + 1;
      const dispatchDate = body.shipment_date ? new Date(body.shipment_date) : new Date();

      const items = body.items || [];
      const insertedItems = [];
      let dispatchRevenue = 0;

      for (const item of items) {
        const poItem = item.po_item_id ? await db.collection('po_items').findOne({ id: item.po_item_id }) : null;
        if (item.job_item_id) {
          const jobItem = await db.collection('production_job_items').findOne({ id: item.job_item_id });
          if (jobItem) {
            // Total produced = parent + child jobs (same sku)
            let totalProducedForItem = jobItem.produced_qty || 0;
            const parentJob = await db.collection('production_jobs').findOne({ id: jobItem.job_id });
            if (parentJob) {
              const childJobs = await db.collection('production_jobs').find({ parent_job_id: parentJob.id }).toArray();
              for (const cj of childJobs) {
                // Match child job items by po_item_id (internal UUID) — avoid sku-based matching
                let cji = null;
                if (jobItem.po_item_id) {
                  cji = await db.collection('production_job_items').findOne({
                    job_id: cj.id, po_item_id: jobItem.po_item_id
                  });
                }
                if (!cji && !jobItem.po_item_id) {
                  cji = await db.collection('production_job_items').findOne({
                    job_id: cj.id, vendor_shipment_item_id: jobItem.vendor_shipment_item_id
                  });
                }
                if (cji) totalProducedForItem += (cji.produced_qty || 0);
              }
            }
            const prevShipped = await db.collection('buyer_shipment_items').find({ job_item_id: item.job_item_id }).toArray();
            const alreadyShipped = prevShipped.reduce((s, b) => s + (b.qty_shipped || 0), 0);
            const newTotal = alreadyShipped + Number(item.qty_shipped);
            if (newTotal > totalProducedForItem) {
              return NextResponse.json({
                error: `Qty kirim ${item.sku || item.product_name} (${newTotal}) melebihi qty yang sudah diproduksi (${totalProducedForItem} pcs termasuk child jobs)`
              }, { status: 400 });
            }
          }
        }
        const si = {
          id: uuidv4(), shipment_id: shipmentId,
          dispatch_seq: dispatchSeq, dispatch_date: dispatchDate,
          po_item_id: item.po_item_id || null,
          job_item_id: item.job_item_id || null,
          product_name: poItem?.product_name || item.product_name || '',
          serial_number: poItem?.serial_number || item.serial_number || '',
          category: poItem?.category || item.category || '',
          size: poItem?.size || item.size || '', color: poItem?.color || item.color || '',
          sku: poItem?.sku || item.sku || '',
          ordered_qty: Number(item.ordered_qty) || 0,
          qty_shipped: Number(item.qty_shipped) || 0, created_at: new Date()
        };
        await db.collection('buyer_shipment_items').insertOne(si);
        insertedItems.push(si);
        dispatchRevenue += si.qty_shipped * (poItem?.selling_price_snapshot || 0);
      }

      // Recalculate cumulative status from ALL items across all dispatches
      const allItems = await db.collection('buyer_shipment_items').find({ shipment_id: shipmentId }).toArray();
      // For status: compare cumulative shipped per job_item vs produced_qty
      let allFullyShipped = true;
      let anyShipped = false;
      for (const item of allItems) {
        if ((item.qty_shipped || 0) > 0) anyShipped = true;
        if (item.job_item_id) {
          const jobItem = await db.collection('production_job_items').findOne({ id: item.job_item_id });
          if (jobItem) {
            const totalShippedForItem = allItems.filter(i => i.job_item_id === item.job_item_id).reduce((s, b) => s + (b.qty_shipped || 0), 0);
            if (totalShippedForItem < jobItem.produced_qty) allFullyShipped = false;
          }
        }
      }
      let shipStatus = 'Pending';
      if (anyShipped && allFullyShipped) shipStatus = 'Fully Shipped';
      else if (anyShipped) shipStatus = 'Partially Shipped';

      await db.collection('buyer_shipments').updateOne({ id: shipmentId }, {
        $set: { ship_status: shipStatus, last_dispatch: dispatchDate, last_dispatch_seq: dispatchSeq, updated_at: new Date() }
      });

      // Check if PO is fully completed
      if (po && shipStatus === 'Fully Shipped') {
        await db.collection('production_pos').updateOne(
          { id: po.id, status: { $nin: ['Completed', 'Closed'] } },
          { $set: { status: 'Completed', updated_at: new Date() } }
        );
      }

      // Auto-generate invoice DISABLED — invoices must be created manually via ManualInvoiceModule
      // if (dispatchRevenue > 0) { ... }

      const action = isNew ? 'Create' : 'Add Dispatch';
      await logActivity(db, user.id, user.name, action, 'Buyer Shipment', `${isNew ? 'Created' : 'Added dispatch #' + dispatchSeq + ' to'} buyer shipment - ${shipStatus}`);
      return NextResponse.json({ ...masterShipment, ship_status: shipStatus, dispatch_seq: dispatchSeq, is_new: isNew, items: insertedItems }, { status: isNew ? 201 : 200 });
    }

    // INVOICES (Manual Create)
    // ─── INVOICE ADJUSTMENTS (POST) ──────────────────────────────────────────
    if (path[0] === 'invoice-adjustments') {
      if (!checkRole(user, ['admin', 'finance', 'superadmin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (!body.invoice_id) return NextResponse.json({ error: 'invoice_id wajib diisi' }, { status: 400 });
      if (!['ADD', 'DEDUCT'].includes(body.adjustment_type)) return NextResponse.json({ error: 'adjustment_type harus ADD atau DEDUCT' }, { status: 400 });
      if (!body.amount || Number(body.amount) <= 0) return NextResponse.json({ error: 'amount harus lebih dari 0' }, { status: 400 });
      if (!body.reason) return NextResponse.json({ error: 'reason wajib diisi' }, { status: 400 });
      
      const invoice = await db.collection('invoices').findOne({ id: body.invoice_id });
      if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      
      const adjustment = {
        id: uuidv4(),
        invoice_id: body.invoice_id,
        invoice_number: invoice.invoice_number,
        adjustment_type: body.adjustment_type,
        amount: Number(body.amount),
        reason: body.reason || '',
        notes: body.notes || '',
        reference_event: body.reference_event || '',
        created_by: user.name,
        created_at: new Date(),
      };
      await db.collection('invoice_adjustments').insertOne(adjustment);
      
      // Recalculate invoice total
      const allAdj = await db.collection('invoice_adjustments').find({ invoice_id: body.invoice_id }).toArray();
      const totalAdd = allAdj.filter(a => a.adjustment_type === 'ADD').reduce((s, a) => s + (a.amount || 0), 0);
      const totalDeduct = allAdj.filter(a => a.adjustment_type === 'DEDUCT').reduce((s, a) => s + (a.amount || 0), 0);
      const baseAmount = invoice.base_amount || invoice.total_amount || 0;
      const newTotal = baseAmount + totalAdd - totalDeduct;
      
      // Update invoice
      await db.collection('invoices').updateOne({ id: body.invoice_id }, {
        $set: {
          base_amount: baseAmount,
          total_amount: newTotal,
          remaining_balance: newTotal - (invoice.total_paid || 0),
          status: (invoice.total_paid || 0) >= newTotal ? 'Paid' : (invoice.total_paid || 0) > 0 ? 'Partial' : 'Unpaid',
          updated_at: new Date()
        }
      });
      
      await logActivity(db, user.id, user.name, 'Invoice Adjustment', 'Invoice',
        `${body.adjustment_type} Rp ${Number(body.amount).toLocaleString('id-ID')} pada ${invoice.invoice_number}: ${body.reason || '-'}`);
      
      return NextResponse.json(adjustment, { status: 201 });
    }

    // ─── COMPANY SETTINGS (POST/UPDATE) ──────────────────────────────────────
    if (path[0] === 'company-settings') {
      if (!checkRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      
      const existing = await db.collection('company_settings').findOne({ type: 'general' });
      const settingsData = {
        company_name: body.company_name || '',
        company_address: body.company_address || '',
        company_phone: body.company_phone || '',
        company_email: body.company_email || '',
        company_website: body.company_website || '',
        company_logo_url: body.company_logo_url || '',
        pdf_header_line1: body.pdf_header_line1 || '',
        pdf_header_line2: body.pdf_header_line2 || '',
        pdf_footer_text: body.pdf_footer_text || '',
        updated_by: user.name,
        updated_at: new Date(),
      };
      
      if (existing) {
        await db.collection('company_settings').updateOne({ type: 'general' }, { $set: settingsData });
      } else {
        await db.collection('company_settings').insertOne({
          id: uuidv4(), type: 'general', ...settingsData, created_at: new Date()
        });
      }
      
      await logActivity(db, user.id, user.name, 'Update', 'Company Settings', 'Updated company settings for PDF header');
      const updated = await db.collection('company_settings').findOne({ type: 'general' });
      return NextResponse.json(updated);
    }

    if (path[0] === 'invoices') {
      if (!checkRole(user, ['admin', 'finance'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      // Invoice revision
      if (path[1] && path[2] === 'revise') {
        const originalInv = await db.collection('invoices').findOne({ id: path[1] });
        if (!originalInv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        const revSeq = (originalInv.revision_number || 0) + 1;
        const revInvNum = `${originalInv.invoice_number}-R${revSeq}`;
        const items = body.invoice_items || originalInv.invoice_items || [];
        const category = originalInv.invoice_category;
        const recalcItems = items.map(it => {
          const price = category === 'VENDOR' ? (it.cmt_price || 0) : (it.selling_price || 0);
          const qty = it.invoice_qty || it.qty || 0;
          return { ...it, invoice_qty: qty, subtotal: qty * price };
        });
        const totalAmount = Number(body.total_amount) || recalcItems.reduce((s, i) => s + (i.subtotal || 0), 0) || originalInv.total_amount;
        const revInv = {
          id: uuidv4(), invoice_number: revInvNum,
          invoice_type: 'MANUAL', invoice_category: category,
          source_po_id: originalInv.source_po_id, po_number: originalInv.po_number,
          parent_invoice_id: originalInv.id, parent_invoice_number: originalInv.invoice_number,
          revision_number: revSeq,
          vendor_or_customer_id: originalInv.vendor_or_customer_id,
          vendor_or_customer_name: originalInv.vendor_or_customer_name,
          garment_id: originalInv.garment_id, garment_name: originalInv.garment_name,
          vendor_id: originalInv.vendor_id, vendor_name: originalInv.vendor_name,
          customer_name: originalInv.customer_name,
          invoice_items: recalcItems, total_amount: totalAmount,
          paid_amount: 0, total_paid: 0, remaining_balance: totalAmount,
          status: 'Unpaid', change_reason: body.change_reason || '',
          notes: body.notes || `Revisi dari ${originalInv.invoice_number}`,
          updated_by: user.name, updated_date: new Date(),
          created_by: user.name, created_at: new Date(), updated_at: new Date()
        };
        await db.collection('invoices').insertOne(revInv);
        await db.collection('invoices').updateOne({ id: path[1] }, { $set: { superseded_by: revInv.id, status: 'Superseded', updated_at: new Date() } });
        await logActivity(db, user.id, user.name, 'Revise Invoice', 'Invoice', `Revisi ${originalInv.invoice_number} → ${revInvNum}: ${body.change_reason || ''}`);
        return NextResponse.json(revInv, { status: 201 });
      }

      // Manual invoice creation
      const poId = body.source_po_id;
      if (!poId) return NextResponse.json({ error: 'source_po_id wajib diisi' }, { status: 400 });
      const po = await db.collection('production_pos').findOne({ id: poId });
      if (!po) return NextResponse.json({ error: 'PO tidak ditemukan' }, { status: 404 });
      const category = body.invoice_category;
      if (!['VENDOR', 'BUYER'].includes(category)) return NextResponse.json({ error: 'invoice_category harus VENDOR atau BUYER' }, { status: 400 });

      const invSeq = (await db.collection('invoices').countDocuments()) + 1;
      const prefix = category === 'VENDOR' ? 'MVINV' : 'MBINV';
      const invNumber = `${prefix}${String(invSeq).padStart(5, '0')}`;

      const items = body.invoice_items || [];
      const recalcItems = items.map(it => {
        const price = category === 'VENDOR' ? (it.cmt_price || 0) : (it.selling_price || 0);
        const qty = it.invoice_qty || it.qty || 0;
        return { ...it, invoice_qty: qty, subtotal: qty * price };
      });
      const totalAmount = recalcItems.reduce((s, i) => s + i.subtotal, 0) - (Number(body.discount) || 0);

      const invoice = {
        id: uuidv4(), invoice_number: invNumber,
        invoice_type: 'MANUAL', invoice_category: category,
        source_po_id: poId, po_number: po.po_number,
        vendor_or_customer_id: category === 'VENDOR' ? po.vendor_id : null,
        vendor_or_customer_name: category === 'VENDOR' ? (po.vendor_name || '') : (po.customer_name || ''),
        garment_id: po.vendor_id, garment_name: po.vendor_name || '',
        vendor_id: po.vendor_id, vendor_name: po.vendor_name || '',
        customer_name: po.customer_name || '',
        invoice_items: recalcItems, total_amount: totalAmount,
        paid_amount: 0, total_paid: 0, remaining_balance: totalAmount,
        status: 'Unpaid', revision_number: 0,
        discount: Number(body.discount) || 0,
        notes: body.notes || '',
        created_by: user.name, created_at: new Date(), updated_at: new Date()
      };
      await db.collection('invoices').insertOne(invoice);
      await logActivity(db, user.id, user.name, 'Create Manual Invoice', 'Invoice', `Manual ${category} invoice ${invNumber} untuk PO ${po.po_number} (Rp ${totalAmount.toLocaleString('id-ID')})`);
      return NextResponse.json(invoice, { status: 201 });
    }

    // PAYMENTS
    if (path[0] === 'payments') {
      if (!checkRole(user, ['admin', 'finance'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const invoice = await db.collection('invoices').findOne({ id: body.invoice_id });
      if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      const outstanding = (invoice.total_amount || 0) - (invoice.total_paid || 0);
      const paymentAmount = Number(body.amount) || 0;
      if (paymentAmount <= 0) return NextResponse.json({ error: 'Jumlah pembayaran harus lebih dari 0' }, { status: 400 });
      if (paymentAmount > outstanding) return NextResponse.json({ error: `Jumlah melebihi sisa tagihan! Maksimal: Rp ${outstanding.toLocaleString('id-ID')}` }, { status: 400 });
      // Determine payment_type from invoice category
      const paymentType = body.payment_type ||
        (invoice.invoice_category === 'VENDOR' ? 'VENDOR_PAYMENT' :
         invoice.invoice_category === 'BUYER' ? 'CUSTOMER_PAYMENT' :
         invoice.invoice_type === 'vendor' ? 'VENDOR_PAYMENT' : 'CUSTOMER_PAYMENT');
      const payment = {
        id: uuidv4(), invoice_id: body.invoice_id, invoice_number: invoice.invoice_number,
        payment_type: paymentType,
        garment_id: invoice.garment_id, garment_name: invoice.garment_name,
        vendor_or_customer_name: invoice.vendor_or_customer_name || invoice.vendor_name || invoice.customer_name || '',
        payment_date: body.payment_date ? new Date(body.payment_date) : new Date(),
        amount: paymentAmount, payment_method: body.payment_method || 'Transfer Bank',
        reference_number: body.reference_number || body.reference || '',
        notes: body.notes || '',
        recorded_by: user.name, created_at: new Date()
      };
      await db.collection('payments').insertOne(payment);
      const allPmts = await db.collection('payments').find({ invoice_id: body.invoice_id }).toArray();
      const totalPaid = allPmts.reduce((s, p) => s + p.amount, 0);
      await db.collection('invoices').updateOne({ id: body.invoice_id }, {
        $set: { status: totalPaid >= invoice.total_amount ? 'Paid' : 'Partial', total_paid: totalPaid, paid_amount: totalPaid, remaining_balance: invoice.total_amount - totalPaid, updated_at: new Date() }
      });
      await logActivity(db, user.id, user.name, 'Create Payment', 'Payment', `${paymentType === 'VENDOR_PAYMENT' ? 'Bayar Vendor' : 'Terima dari Customer'} Rp${paymentAmount.toLocaleString('id-ID')} for ${invoice.invoice_number}`);
      return NextResponse.json(payment, { status: 201 });
    }

    // USERS
    if (path[0] === 'users') {
      if (user.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const hashedPassword = await bcrypt.hash(body.password || 'User@123', 10);
      const newUser = { id: uuidv4(), ...body, password: hashedPassword, status: 'active', created_at: new Date(), updated_at: new Date() };
      await db.collection('users').insertOne(newUser);
      await logActivity(db, user.id, user.name, 'Create', 'User Management', `Created user: ${newUser.email}`);
      const { password: _, ...userWithoutPassword } = newUser;
      return NextResponse.json(userWithoutPassword, { status: 201 });
    }

    // MATERIAL REQUESTS (POST) — vendor submits additional/replacement request
    if (path[0] === 'material-requests') {
      const vendorId = user.role === 'vendor' ? user.vendor_id : body.vendor_id;
      if (!vendorId) return NextResponse.json({ error: 'vendor_id diperlukan' }, { status: 400 });
      if (!body.request_type || !['ADDITIONAL', 'REPLACEMENT'].includes(body.request_type)) {
        return NextResponse.json({ error: 'request_type harus ADDITIONAL atau REPLACEMENT' }, { status: 400 });
      }
      const origShipment = body.original_shipment_id
        ? await db.collection('vendor_shipments').findOne({ id: body.original_shipment_id })
        : null;
      if (!origShipment) return NextResponse.json({ error: 'Shipment asal tidak ditemukan' }, { status: 404 });

      const seq = (await db.collection('material_requests').countDocuments()) + 1;
      const prefix = body.request_type === 'ADDITIONAL' ? 'REQ-ADD' : 'REQ-RPL';
      const reqNumber = `${prefix}-${String(seq).padStart(4, '0')}`;
      const reqId = uuidv4();
      const reqDoc = {
        id: reqId, request_number: reqNumber,
        request_type: body.request_type,
        vendor_id: vendorId, vendor_name: origShipment.vendor_name,
        original_shipment_id: body.original_shipment_id,
        original_shipment_number: origShipment.shipment_number,
        inspection_id: body.inspection_id || null,
        defect_report_id: body.defect_report_id || null,
        po_id: body.po_id || null, po_number: body.po_number || '',
        items: body.items || [],
        total_requested_qty: (body.items || []).reduce((s, i) => s + (Number(i.requested_qty) || 0), 0),
        reason: body.reason || '',
        status: 'Pending',
        admin_notes: '',
        approved_by: null, approved_at: null,
        child_shipment_id: null, child_shipment_number: null,
        created_by: user.name, created_at: new Date(), updated_at: new Date()
      };
      await db.collection('material_requests').insertOne(reqDoc);
      await logActivity(db, user.id, user.name, 'Create', 'Material Request',
        `${body.request_type} request ${reqNumber} dari ${origShipment.vendor_name} untuk shipment ${origShipment.shipment_number}`);
      return NextResponse.json(reqDoc, { status: 201 });
    }

    // VENDOR MATERIAL INSPECTION (POST)
    if (path[0] === 'vendor-material-inspections') {
      const vendorId = user.role === 'vendor' ? user.vendor_id : body.vendor_id;
      if (!vendorId) return NextResponse.json({ error: 'vendor_id diperlukan' }, { status: 400 });
      const shipment = body.shipment_id ? await db.collection('vendor_shipments').findOne({ id: body.shipment_id }) : null;
      if (!shipment) return NextResponse.json({ error: 'Shipment tidak ditemukan' }, { status: 404 });
      // Check if already inspected
      const existingInspection = await db.collection('vendor_material_inspections').findOne({ shipment_id: body.shipment_id });
      if (existingInspection) return NextResponse.json({ error: 'Inspeksi untuk shipment ini sudah dilakukan' }, { status: 400 });

      const inspectionId = uuidv4();
      const items = body.items || [];
      let totalReceived = 0, totalMissing = 0;
      for (const item of items) {
        totalReceived += Number(item.received_qty) || 0;
        totalMissing += Number(item.missing_qty) || 0;
      }

      const inspection = {
        id: inspectionId,
        shipment_id: body.shipment_id, shipment_number: shipment.shipment_number,
        vendor_id: vendorId, vendor_name: shipment.vendor_name,
        inspection_date: body.inspection_date ? new Date(body.inspection_date) : new Date(),
        total_received: totalReceived, total_missing: totalMissing,
        overall_notes: body.overall_notes || '',
        status: 'Submitted',
        submitted_by: user.name, created_at: new Date(), updated_at: new Date()
      };
      await db.collection('vendor_material_inspections').insertOne(inspection);

      for (const item of items) {
        const insItem = {
          id: uuidv4(), inspection_id: inspectionId,
          shipment_item_id: item.shipment_item_id || null,
          sku: item.sku || '', product_name: item.product_name || '',
          size: item.size || '', color: item.color || '',
          ordered_qty: Number(item.ordered_qty) || 0,
          received_qty: Number(item.received_qty) || 0,
          missing_qty: Number(item.missing_qty) || 0,
          condition_notes: item.condition_notes || '',
          created_at: new Date()
        };
        await db.collection('vendor_material_inspection_items').insertOne(insItem);
      }

      // Update shipment with inspection data
      await db.collection('vendor_shipments').updateOne({ id: body.shipment_id }, {
        $set: { inspection_status: 'Inspected', total_received: totalReceived, total_missing: totalMissing, inspected_at: new Date(), updated_at: new Date() }
      });

      // AUTO-CREATE CHILD PRODUCTION JOB if this is a child shipment (ADDITIONAL/REPLACEMENT)
      // Triggered automatically: "when additional shipment has been received and inspected"
      if (shipment.parent_shipment_id && shipment.status === 'Received') {
        const parentJob = await db.collection('production_jobs').findOne({ vendor_shipment_id: shipment.parent_shipment_id });
        const alreadyExists = await db.collection('production_jobs').findOne({ vendor_shipment_id: body.shipment_id });
        if (parentJob && !alreadyExists && totalReceived > 0) {
          const childJobId = uuidv4();
          const suffix = shipment.shipment_type === 'ADDITIONAL' ? 'A' : 'R';
          const childCount = await db.collection('production_jobs').countDocuments({ parent_job_id: parentJob.id });
          const childJobNumber = `${parentJob.job_number}-${suffix}${childCount + 1}`;
          const childJob = {
            id: childJobId, job_number: childJobNumber,
            parent_job_id: parentJob.id, parent_job_number: parentJob.job_number,
            vendor_id: parentJob.vendor_id, vendor_name: parentJob.vendor_name,
            po_id: parentJob.po_id, po_number: parentJob.po_number,
            customer_name: parentJob.customer_name,
            vendor_shipment_id: body.shipment_id,
            shipment_number: shipment.shipment_number,
            shipment_type: shipment.shipment_type || 'ADDITIONAL',
            deadline: parentJob.deadline, delivery_deadline: parentJob.delivery_deadline,
            status: 'In Progress', notes: `Auto-created from ${shipment.shipment_type} shipment ${shipment.shipment_number}`,
            created_by: 'system', created_at: new Date(), updated_at: new Date()
          };
          await db.collection('production_jobs').insertOne(childJob);
          // Create child job items from inspection received quantities
          const shipItemsForChild = await db.collection('vendor_shipment_items').find({ shipment_id: body.shipment_id }).toArray();
          for (const si of shipItemsForChild) {
            const poItem = si.po_item_id ? await db.collection('po_items').findOne({ id: si.po_item_id }) : null;
            const matchedInspItem = items.find(ii => ii.shipment_item_id === si.id) || 
              items.find(ii => ii.sku === si.sku && ii.size === (si.size || '') && ii.color === (si.color || ''));
            const availableQty = matchedInspItem ? (Number(matchedInspItem.received_qty) ?? 0) : si.qty_sent;
            await db.collection('production_job_items').insertOne({
              id: uuidv4(), job_id: childJobId, job_number: childJobNumber,
              po_item_id: si.po_item_id || null,
              vendor_shipment_item_id: si.id,
              product_name: si.product_name, sku: si.sku || '', size: si.size || '', color: si.color || '',
              serial_number: poItem?.serial_number || si.serial_number || '',
              ordered_qty: si.qty_sent, shipment_qty: si.qty_sent, available_qty: availableQty,
              produced_qty: 0, created_at: new Date()
            });
          }
          await logActivity(db, user.id, user.name, 'Auto-Create', 'Child Production Job', `Auto-created child job ${childJobNumber} from ${shipment.shipment_type} shipment inspection`);
        }
      }

      await logActivity(db, user.id, user.name, 'Create', 'Material Inspection', `Inspeksi shipment ${shipment.shipment_number}: diterima ${totalReceived}, missing ${totalMissing}`);
      const itemDocs = await db.collection('vendor_material_inspection_items').find({ inspection_id: inspectionId }).toArray();
      return NextResponse.json({ ...inspection, items: itemDocs }, { status: 201 });
    }

    // MATERIAL DEFECT REPORT (POST)
    if (path[0] === 'material-defect-reports') {
      const vendorId = user.role === 'vendor' ? user.vendor_id : body.vendor_id;
      if (!vendorId) return NextResponse.json({ error: 'vendor_id diperlukan' }, { status: 400 });
      const jobItem = body.job_item_id ? await db.collection('production_job_items').findOne({ id: body.job_item_id }) : null;

      const defectId = uuidv4();
      const defect = {
        id: defectId,
        vendor_id: vendorId,
        job_id: body.job_id || jobItem?.job_id || null,
        job_item_id: body.job_item_id || null,
        po_id: body.po_id || jobItem?.po_id || null,
        sku: body.sku || jobItem?.sku || '',
        product_name: body.product_name || jobItem?.product_name || '',
        size: body.size || jobItem?.size || '',
        color: body.color || jobItem?.color || '',
        defect_qty: Number(body.defect_qty) || 0,
        defect_type: body.defect_type || 'Material Cacat',
        description: body.description || '',
        shipment_id: body.shipment_id || null,
        report_date: body.report_date ? new Date(body.report_date) : new Date(),
        status: 'Reported',
        reported_by: user.name, created_at: new Date(), updated_at: new Date()
      };
      await db.collection('material_defect_reports').insertOne(defect);
      await logActivity(db, user.id, user.name, 'Create', 'Defect Report', `Laporan cacat: ${defect.sku} - ${defect.defect_qty} pcs - ${defect.defect_type}`);
      return NextResponse.json(defect, { status: 201 });
    }

    // PRODUCTION RETURNS (POST) — creates a new repair job, does NOT affect original PO
    if (path[0] === 'production-returns') {
      if (!checkRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const returnId = uuidv4();
      const returnSeq = (await db.collection('production_returns').countDocuments()) + 1;
      const returnNumber = `RTN-${String(returnSeq).padStart(4, '0')}`;

      // Optionally link to original PO for reference (read-only reference, does not change PO)
      const refPO = body.reference_po_id ? await db.collection('production_pos').findOne({ id: body.reference_po_id }) : null;

      const returnDoc = {
        id: returnId, return_number: returnNumber,
        reference_po_id: body.reference_po_id || null,
        reference_po_number: refPO?.po_number || body.reference_po_number || '',
        customer_name: body.customer_name || refPO?.customer_name || '',
        buyer_name: body.buyer_name || body.customer_name || '',
        return_date: body.return_date ? new Date(body.return_date) : new Date(),
        return_reason: body.return_reason || '',
        notes: body.notes || '',
        status: 'Repair Needed', // Repair Needed → In Repair → Completed → Shipped Back
        total_return_qty: 0,
        created_by: user.name, created_at: new Date(), updated_at: new Date()
      };

      const items = body.items || [];
      let totalQty = 0;
      for (const item of items) totalQty += Number(item.return_qty) || 0;
      returnDoc.total_return_qty = totalQty;

      await db.collection('production_returns').insertOne(returnDoc);

      const insertedItems = [];
      for (const item of items) {
        const ri = {
          id: uuidv4(), return_id: returnId,
          sku: item.sku || '', product_name: item.product_name || '',
          size: item.size || '', color: item.color || '',
          return_qty: Number(item.return_qty) || 0,
          defect_type: item.defect_type || '',
          repair_notes: item.repair_notes || '',
          repaired_qty: 0,
          created_at: new Date()
        };
        await db.collection('production_return_items').insertOne(ri);
        insertedItems.push(ri);
      }

      await logActivity(db, user.id, user.name, 'Create', 'Production Return', `Retur ${returnNumber} dari ${returnDoc.customer_name}: ${totalQty} pcs`);
      return NextResponse.json({ ...returnDoc, items: insertedItems }, { status: 201 });
    }

    // DATA MIGRATION: Recalculate existing production job items available_qty from inspection data
    if (path[0] === 'recalculate-jobs') {
      if (!checkRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      let fixed = 0;
      const allJobs = await db.collection('production_jobs').find({}).toArray();
      for (const job of allJobs) {
        const inspection = await db.collection('vendor_material_inspections').findOne({ shipment_id: job.vendor_shipment_id });
        const jobItems = await db.collection('production_job_items').find({ job_id: job.id }).toArray();
        for (const ji of jobItems) {
          // ALWAYS recalculate available_qty from inspection data
          let newAvailableQty = ji.shipment_qty; // default to shipment qty
          if (inspection) {
            // Match by shipment_item_id first (internal UUID), then sku+size+color
            let inspItem = await db.collection('vendor_material_inspection_items').findOne({
              inspection_id: inspection.id,
              shipment_item_id: ji.vendor_shipment_item_id
            });
            if (!inspItem && ji.sku) {
              inspItem = await db.collection('vendor_material_inspection_items').findOne({
                inspection_id: inspection.id,
                sku: ji.sku, size: ji.size || '', color: ji.color || ''
              });
            }
            if (inspItem) newAvailableQty = inspItem.received_qty ?? ji.shipment_qty;
          }
          // Ensure serial_number is set from po_item if missing
          let serialNumber = ji.serial_number;
          if (!serialNumber && ji.po_item_id) {
            const poItem = await db.collection('po_items').findOne({ id: ji.po_item_id });
            serialNumber = poItem?.serial_number || '';
          }
          await db.collection('production_job_items').updateOne({ id: ji.id }, {
            $set: { available_qty: newAvailableQty, serial_number: serialNumber, updated_at: new Date() }
          });
          fixed++;
        }
      }
      return NextResponse.json({ success: true, items_updated: fixed, jobs_processed: allJobs.length });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── PUT ────────────────────────────────────────────────────────────────────────
export async function PUT(request, { params }) {
  const path = params?.path || [];
  const db = await getDb();
  const user = verifyToken(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const id = path[1];
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    if (path[0] === 'garments') {
      if (!checkRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const { _id, id: _, vendor_account, ...updateData } = body;
      await db.collection('garments').updateOne({ id }, { $set: { ...updateData, updated_at: new Date() } });
      if (updateData.garment_name) await db.collection('users').updateOne({ vendor_id: id }, { $set: { name: updateData.garment_name, updated_at: new Date() } });
      await logActivity(db, user.id, user.name, 'Update', 'Garments', `Updated garment: ${id}`);
      return NextResponse.json(await db.collection('garments').findOne({ id }));
    }

    if (path[0] === 'products') {
      if (!checkRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const { _id, id: _, ...updateData } = body;
      await db.collection('products').updateOne({ id }, { $set: { ...updateData, updated_at: new Date() } });
      await logActivity(db, user.id, user.name, 'Update', 'Products', `Updated product: ${id}`);
      return NextResponse.json(await db.collection('products').findOne({ id }));
    }

    if (path[0] === 'product-variants') {
      if (!checkRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const { _id, id: _, ...updateData } = body;
      await db.collection('product_variants').updateOne({ id }, { $set: { ...updateData, updated_at: new Date() } });
      return NextResponse.json(await db.collection('product_variants').findOne({ id }));
    }

    if (path[0] === 'production-pos') {
      if (!checkRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const existingPO = await db.collection('production_pos').findOne({ id });
      if (!existingPO) return NextResponse.json({ error: 'PO not found' }, { status: 404 });
      // Lock Closed POs unless Superadmin
      if (existingPO.status === 'Closed' && user.role !== 'superadmin') {
        return NextResponse.json({ error: 'PO ini sudah Closed. Hanya Superadmin yang bisa mengeditnya.' }, { status: 403 });
      }
      if (existingPO.status === 'Closed' && user.role === 'superadmin') {
        await logActivity(db, user.id, user.name, 'Superadmin Override', 'Production PO', `Superadmin mengedit PO Closed: ${existingPO.po_number}`);
      }
      const { _id, id: _, items, ...updateData } = body;
      if (updateData.deadline) updateData.deadline = new Date(updateData.deadline);
      if (updateData.delivery_deadline) updateData.delivery_deadline = new Date(updateData.delivery_deadline);
      if (updateData.po_date) updateData.po_date = new Date(updateData.po_date);
      // Resolve vendor name if vendor_id changed
      if (updateData.vendor_id) {
        const vendorDoc = await db.collection('garments').findOne({ id: updateData.vendor_id });
        updateData.vendor_name = vendorDoc?.garment_name || '';
      }
      await db.collection('production_pos').updateOne({ id }, { $set: { ...updateData, updated_at: new Date() } });

      // REMOVED: Auto-generate invoices — invoices must be created MANUALLY only via ManualInvoiceModule.
      // if (updateData.status === 'Confirmed') { await autoGenerateInvoices(...) }

      await logActivity(db, user.id, user.name, 'Update', 'Production PO', `Updated PO: ${existingPO.po_number}`);
      return NextResponse.json(await db.collection('production_pos').findOne({ id }));
    }

    if (path[0] === 'po-items') {
      if (!checkRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const { _id, id: _, ...updateData } = body;
      await db.collection('po_items').updateOne({ id }, { $set: { ...updateData, updated_at: new Date() } });
      return NextResponse.json(await db.collection('po_items').findOne({ id }));
    }

    if (path[0] === 'work-orders') {
      if (!checkRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const { _id, id: _, ...updateData } = body;
      await db.collection('work_orders').updateOne({ id }, { $set: { ...updateData, updated_at: new Date() } });
      await logActivity(db, user.id, user.name, 'Update', 'Work Order', `Updated work order: ${id}`);
      return NextResponse.json(await db.collection('work_orders').findOne({ id }));
    }

    if (path[0] === 'vendor-shipments') {
      if (!checkRole(user, ['admin', 'vendor'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const { _id, id: _, items, ...updateData } = body;
      await db.collection('vendor_shipments').updateOne({ id }, { $set: { ...updateData, updated_at: new Date() } });
      await logActivity(db, user.id, user.name, 'Update', 'Vendor Shipment', `Updated shipment: ${id}`);
      return NextResponse.json(await db.collection('vendor_shipments').findOne({ id }));
    }

    // MATERIAL REQUESTS (PUT) — admin approve/reject
    if (path[0] === 'material-requests') {
      if (!checkRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const req = await db.collection('material_requests').findOne({ id });
      if (!req) return NextResponse.json({ error: 'Request tidak ditemukan' }, { status: 404 });
      const newStatus = body.status;

      if (newStatus === 'Approved' && req.status === 'Pending') {
        // Auto-create child shipment
        const origShipment = await db.collection('vendor_shipments').findOne({ id: req.original_shipment_id });
        if (!origShipment) return NextResponse.json({ error: 'Shipment asal tidak ditemukan' }, { status: 404 });

        // Generate child shipment number: SHP-001-A1 or SHP-001-R1
        const existingChildren = await db.collection('vendor_shipments').countDocuments({ parent_shipment_id: req.original_shipment_id, shipment_type: req.request_type });
        const childSuffix = req.request_type === 'ADDITIONAL' ? `A${existingChildren + 1}` : `R${existingChildren + 1}`;
        const childShipmentNumber = `${origShipment.shipment_number}-${childSuffix}`;

        const childId = uuidv4();
        const childShipment = {
          id: childId,
          shipment_number: childShipmentNumber,
          delivery_note_number: `DN-${childShipmentNumber}`,
          vendor_id: origShipment.vendor_id,
          vendor_name: origShipment.vendor_name,
          shipment_date: new Date(),
          shipment_type: req.request_type,
          parent_shipment_id: req.original_shipment_id,
          material_request_id: id,
          status: 'Sent',
          notes: `Child shipment dari ${origShipment.shipment_number} (${req.request_type}). Approved by ${user.name}.`,
          created_by: user.name, created_at: new Date(), updated_at: new Date()
        };
        await db.collection('vendor_shipments').insertOne(childShipment);

        // Create shipment items from request items (inherit parent data)
        for (const ri of req.items || []) {
          const si = {
            id: uuidv4(), shipment_id: childId, shipment_number: childShipmentNumber,
            po_id: req.po_id || null, po_number: req.po_number || '',
            po_item_id: ri.po_item_id || null,
            product_name: ri.product_name || '', sku: ri.sku || '',
            size: ri.size || '', color: ri.color || '',
            serial_number: ri.serial_number || '',
            qty_sent: Number(ri.requested_qty) || 0,
            created_at: new Date()
          };
          await db.collection('vendor_shipment_items').insertOne(si);
        }

        // Update material request with child shipment reference
        await db.collection('material_requests').updateOne({ id }, {
          $set: {
            status: 'Approved', admin_notes: body.admin_notes || '',
            approved_by: user.name, approved_at: new Date(),
            child_shipment_id: childId, child_shipment_number: childShipmentNumber,
            updated_at: new Date()
          }
        });
        await logActivity(db, user.id, user.name, 'Approve', 'Material Request',
          `${req.request_type} request ${req.request_number} disetujui — Child shipment ${childShipmentNumber} dibuat`);
        return NextResponse.json({
          ...(await db.collection('material_requests').findOne({ id })),
          child_shipment: childShipment
        });
      }

      if (newStatus === 'Rejected') {
        await db.collection('material_requests').updateOne({ id }, {
          $set: { status: 'Rejected', admin_notes: body.admin_notes || '', updated_at: new Date() }
        });
        await logActivity(db, user.id, user.name, 'Reject', 'Material Request', `Request ${req.request_number} ditolak: ${body.admin_notes || ''}`);
        return NextResponse.json(await db.collection('material_requests').findOne({ id }));
      }

      // General update
      const { _id, id: _, ...updateData } = body;
      await db.collection('material_requests').updateOne({ id }, { $set: { ...updateData, updated_at: new Date() } });
      return NextResponse.json(await db.collection('material_requests').findOne({ id }));
    }

    if (path[0] === 'buyer-shipments') {
      const { _id, id: _, items, ...updateData } = body;
      await db.collection('buyer_shipments').updateOne({ id }, { $set: { ...updateData, updated_at: new Date() } });
      await logActivity(db, user.id, user.name, 'Update', 'Buyer Shipment', `Updated buyer shipment: ${id}`);
      return NextResponse.json(await db.collection('buyer_shipments').findOne({ id }));
    }

    if (path[0] === 'production-returns') {
      if (!checkRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const { _id, id: _, items, ...updateData } = body;
      if (updateData.return_date) updateData.return_date = new Date(updateData.return_date);
      await db.collection('production_returns').updateOne({ id }, { $set: { ...updateData, updated_at: new Date() } });
      await logActivity(db, user.id, user.name, 'Update', 'Production Return', `Updated return: ${id}`);
      return NextResponse.json(await db.collection('production_returns').findOne({ id }));
    }

    if (path[0] === 'invoices') {
      if (!checkRole(user, ['admin', 'finance'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const { _id, id: _, ...updateData } = body;
      await db.collection('invoices').updateOne({ id }, { $set: { ...updateData, updated_at: new Date() } });
      await logActivity(db, user.id, user.name, 'Update', 'Invoice', `Updated invoice: ${id}`);
      return NextResponse.json(await db.collection('invoices').findOne({ id }));
    }

    if (path[0] === 'production-progress') {
      if (user.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const { _id, id: _, work_order_id, ...updateData } = body;
      if (updateData.progress_date) updateData.progress_date = new Date(updateData.progress_date);
      if (updateData.completed_quantity !== undefined) updateData.completed_quantity = Number(updateData.completed_quantity);
      await db.collection('production_progress').updateOne({ id }, { $set: { ...updateData, updated_at: new Date() } });
      const updatedProgress = await db.collection('production_progress').findOne({ id });
      const effectiveWOId = work_order_id || updatedProgress?.work_order_id;
      if (effectiveWOId) {
        const allProgress = await db.collection('production_progress').find({ work_order_id: effectiveWOId }).toArray();
        const totalCompleted = allProgress.reduce((s, p) => s + p.completed_quantity, 0);
        const wo = await db.collection('work_orders').findOne({ id: effectiveWOId });
        if (wo) {
          const newStatus = totalCompleted === 0 ? 'Waiting' : totalCompleted >= wo.quantity ? 'Completed' : 'In Progress';
          await db.collection('work_orders').updateOne({ id: effectiveWOId }, { $set: { completed_quantity: totalCompleted, status: newStatus, updated_at: new Date() } });
        }
      }
      await logActivity(db, user.id, user.name, 'Update', 'Production Progress', `Updated progress: ${id}`);
      return NextResponse.json(updatedProgress);
    }

    if (path[0] === 'users') {
      if (user.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const { _id, id: _, password, ...updateData } = body;
      if (password) updateData.password = await bcrypt.hash(password, 10);
      await db.collection('users').updateOne({ id }, { $set: { ...updateData, updated_at: new Date() } });
      await logActivity(db, user.id, user.name, 'Update', 'User Management', `Updated user: ${id}`);
      return NextResponse.json(await db.collection('users').findOne({ id }, { projection: { password: 0 } }));
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── DELETE ─────────────────────────────────────────────────────────────────────
export async function DELETE(request, { params }) {
  const path = params?.path || [];
  const db = await getDb();
  const user = verifyToken(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden: Only Superadmin can delete' }, { status: 403 });

  try {
    const id = path[1];
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    const resource = path[0];

    if (resource === 'garments') {
      const doc = await db.collection('garments').findOne({ id });
      if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await db.collection('garments').deleteOne({ id });
      await db.collection('users').deleteMany({ vendor_id: id });
      await logActivity(db, user.id, user.name, 'Delete', 'Garments', `Deleted garment: ${doc.garment_name}`);
      return NextResponse.json({ success: true });
    }

    if (resource === 'products') {
      const doc = await db.collection('products').findOne({ id });
      if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await db.collection('products').deleteOne({ id });
      await db.collection('product_variants').deleteMany({ product_id: id });
      await logActivity(db, user.id, user.name, 'Delete', 'Products', `Deleted product: ${doc.product_name}`);
      return NextResponse.json({ success: true });
    }

    if (resource === 'product-variants') {
      const varDoc = await db.collection('product_variants').findOne({ id });
      if (!varDoc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      // Check if SKU is used in transactions (non-superadmin blocked)
      if (user.role !== 'superadmin') {
        const usedInPO = await db.collection('po_items').findOne({ variant_id: id });
        if (usedInPO) return NextResponse.json({ error: `SKU "${varDoc.sku}" sudah digunakan di Production PO. Hanya Superadmin yang dapat menghapusnya.` }, { status: 400 });
      } else {
        const usedInPO = await db.collection('po_items').findOne({ variant_id: id });
        if (usedInPO) {
          await logActivity(db, user.id, user.name, 'Superadmin Override', 'Product Variants', `Superadmin menghapus SKU yang digunakan di transaksi: ${varDoc.sku}`);
        }
      }
      await db.collection('product_variants').deleteOne({ id });
      await logActivity(db, user.id, user.name, 'Delete', 'Product Variants', `Deleted variant SKU: ${varDoc.sku || id}`);
      return NextResponse.json({ success: true });
    }

    if (resource === 'production-pos') {
      const doc = await db.collection('production_pos').findOne({ id });
      if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const wos = await db.collection('work_orders').find({ po_id: id }).toArray();
      for (const wo of wos) await db.collection('production_progress').deleteMany({ work_order_id: wo.id });
      await db.collection('work_orders').deleteMany({ po_id: id });
      await db.collection('po_items').deleteMany({ po_id: id });
      await db.collection('production_pos').deleteOne({ id });
      await logActivity(db, user.id, user.name, 'Delete', 'Production PO', `Deleted PO: ${doc.po_number}`);
      return NextResponse.json({ success: true });
    }

    if (resource === 'po-items') {
      await db.collection('po_items').deleteOne({ id });
      return NextResponse.json({ success: true });
    }

    if (resource === 'production-jobs') {
      const doc = await db.collection('production_jobs').findOne({ id });
      if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await db.collection('production_job_items').deleteMany({ job_id: id });
      await db.collection('production_progress').deleteMany({ job_id: id });
      await db.collection('production_jobs').deleteOne({ id });
      await logActivity(db, user.id, user.name, 'Delete', 'Production Job', `Deleted job: ${doc.job_number}`);
      return NextResponse.json({ success: true });
    }

    if (resource === 'work-orders') {
      const doc = await db.collection('work_orders').findOne({ id });
      if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await db.collection('production_progress').deleteMany({ work_order_id: id });
      await db.collection('work_orders').deleteOne({ id });
      await logActivity(db, user.id, user.name, 'Delete', 'Work Order', `Deleted WO: ${doc.distribution_code}`);
      return NextResponse.json({ success: true });
    }

    if (resource === 'production-progress') {
      const doc = await db.collection('production_progress').findOne({ id });
      if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await db.collection('production_progress').deleteOne({ id });
      const allProgress = await db.collection('production_progress').find({ work_order_id: doc.work_order_id }).toArray();
      const totalCompleted = allProgress.reduce((s, p) => s + p.completed_quantity, 0);
      const wo = await db.collection('work_orders').findOne({ id: doc.work_order_id });
      if (wo) {
        const newStatus = totalCompleted === 0 ? 'Waiting' : totalCompleted >= wo.quantity ? 'Completed' : 'In Progress';
        await db.collection('work_orders').updateOne({ id: doc.work_order_id }, { $set: { completed_quantity: totalCompleted, status: newStatus, updated_at: new Date() } });
      }
      await logActivity(db, user.id, user.name, 'Delete', 'Production Progress', `Deleted progress entry`);
      return NextResponse.json({ success: true });
    }

    if (resource === 'vendor-shipments') {
      const doc = await db.collection('vendor_shipments').findOne({ id });
      if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await db.collection('vendor_shipment_items').deleteMany({ shipment_id: id });
      await db.collection('vendor_shipments').deleteOne({ id });
      await logActivity(db, user.id, user.name, 'Delete', 'Vendor Shipment', `Deleted shipment: ${doc.shipment_number}`);
      return NextResponse.json({ success: true });
    }

    if (resource === 'buyer-shipments') {
      const doc = await db.collection('buyer_shipments').findOne({ id });
      if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await db.collection('buyer_shipment_items').deleteMany({ shipment_id: id });
      await db.collection('buyer_shipments').deleteOne({ id });
      await logActivity(db, user.id, user.name, 'Delete', 'Buyer Shipment', `Deleted buyer shipment: ${doc.shipment_number}`);
      return NextResponse.json({ success: true });
    }

    if (resource === 'invoices') {
      const doc = await db.collection('invoices').findOne({ id });
      if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await db.collection('payments').deleteMany({ invoice_id: id });
      await db.collection('invoices').deleteOne({ id });
      await logActivity(db, user.id, user.name, 'Delete', 'Invoice', `Deleted invoice: ${doc.invoice_number}`);
      return NextResponse.json({ success: true });
    }

    if (resource === 'payments') {
      const doc = await db.collection('payments').findOne({ id });
      if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await db.collection('payments').deleteOne({ id });
      const allPmts = await db.collection('payments').find({ invoice_id: doc.invoice_id }).toArray();
      const totalPaid = allPmts.reduce((s, p) => s + p.amount, 0);
      const invoice = await db.collection('invoices').findOne({ id: doc.invoice_id });
      if (invoice) {
        const newStatus = totalPaid <= 0 ? 'Unpaid' : totalPaid >= invoice.total_amount ? 'Paid' : 'Partial';
        await db.collection('invoices').updateOne({ id: doc.invoice_id }, { $set: { status: newStatus, total_paid: totalPaid, updated_at: new Date() } });
      }
      await logActivity(db, user.id, user.name, 'Delete', 'Payment', `Deleted payment: ${doc.invoice_number}`);
      return NextResponse.json({ success: true });
    }

    if (resource === 'users') {
      const doc = await db.collection('users').findOne({ id });
      if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (doc.role === 'superadmin') return NextResponse.json({ error: 'Cannot delete superadmin' }, { status: 403 });
      if (doc.id === user.id) return NextResponse.json({ error: 'Cannot delete own account' }, { status: 403 });
      await db.collection('users').deleteOne({ id });
      await logActivity(db, user.id, user.name, 'Delete', 'User Management', `Deleted user: ${doc.email}`);
      return NextResponse.json({ success: true });
    }

    if (resource === 'buyer-shipments') {
      const bs = await db.collection('buyer_shipments').findOne({ id });
      if (!bs) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await db.collection('buyer_shipment_items').deleteMany({ shipment_id: id });
      await db.collection('buyer_shipments').deleteOne({ id });
      await logActivity(db, user.id, user.name, 'Delete', 'Buyer Shipment', `Deleted buyer shipment: ${bs.shipment_number}`);
      return NextResponse.json({ success: true });
    }

    if (resource === 'activity-logs') {
      if (id === 'all') { await db.collection('activity_logs').deleteMany({}); return NextResponse.json({ success: true }); }
      await db.collection('activity_logs').deleteOne({ id });
      return NextResponse.json({ success: true });
    }

    if (resource === 'production-returns') {
      const doc = await db.collection('production_returns').findOne({ id });
      if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await db.collection('production_return_items').deleteMany({ return_id: id });
      await db.collection('production_returns').deleteOne({ id });
      await logActivity(db, user.id, user.name, 'Delete', 'Production Return', `Deleted return: ${doc.return_number}`);
      return NextResponse.json({ success: true });
    }

    if (resource === 'invoice-adjustments') {
      const doc = await db.collection('invoice_adjustments').findOne({ id });
      if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await db.collection('invoice_adjustments').deleteOne({ id });
      // Recalculate invoice total
      const invoice = await db.collection('invoices').findOne({ id: doc.invoice_id });
      if (invoice) {
        const allAdj = await db.collection('invoice_adjustments').find({ invoice_id: doc.invoice_id }).toArray();
        const totalAdd = allAdj.filter(a => a.adjustment_type === 'ADD').reduce((s, a) => s + (a.amount || 0), 0);
        const totalDeduct = allAdj.filter(a => a.adjustment_type === 'DEDUCT').reduce((s, a) => s + (a.amount || 0), 0);
        const baseAmount = invoice.base_amount || invoice.total_amount || 0;
        const newTotal = baseAmount + totalAdd - totalDeduct;
        await db.collection('invoices').updateOne({ id: doc.invoice_id }, {
          $set: { total_amount: newTotal, remaining_balance: newTotal - (invoice.total_paid || 0), updated_at: new Date() }
        });
      }
      await logActivity(db, user.id, user.name, 'Delete', 'Invoice Adjustment', `Deleted adjustment on ${doc.invoice_number}`);
      return NextResponse.json({ success: true });
    }

    if (resource === 'attachments') {
      const doc = await db.collection('attachments').findOne({ id });
      if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      try { await unlink(doc.filepath); } catch (e) { console.warn('File not on disk:', e.message); }
      await db.collection('attachments').deleteOne({ id });
      await logActivity(db, user.id, user.name, 'Delete', 'Attachment', `Deleted file: ${doc.original_name}`);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
