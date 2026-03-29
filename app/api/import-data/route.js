import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
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

function generatePassword(length = 10) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  let result = '';
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

export async function POST(request) {
  const user = verifyToken(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['superadmin', 'admin'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const formData = await request.formData();
    const type = formData.get('type');
    const file = formData.get('file');

    if (!type) return NextResponse.json({ error: 'Tipe import wajib diisi' }, { status: 400 });
    if (!file) return NextResponse.json({ error: 'File wajib diunggah' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return NextResponse.json({ error: 'File Excel kosong' }, { status: 400 });

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) return NextResponse.json({ error: 'Tidak ada data di file Excel' }, { status: 400 });

    const db = await getDb();
    let result;

    switch (type) {
      case 'products':
        result = await importProducts(db, rows, user);
        break;
      case 'garments':
        result = await importGarments(db, rows, user);
        break;
      case 'production-pos':
        result = await importProductionPOs(db, rows, user);
        break;
      default:
        return NextResponse.json({ error: `Tipe import tidak dikenal: ${type}` }, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: `Import gagal: ${error.message}` }, { status: 500 });
  }
}

// ─── IMPORT PRODUCTS WITH VARIANTS ────────────────────────────────────────────
async function importProducts(db, rows, user) {
  const results = { imported_products: 0, imported_variants: 0, errors: [], skipped: 0 };
  
  // Group rows by product_code to create parent-child relationships
  const productMap = {};
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const productCode = String(row.product_code || row.kode_produk || '').trim();
    const productName = String(row.product_name || row.nama_produk || '').trim();
    
    if (!productCode && !productName) {
      results.skipped++;
      continue;
    }
    
    if (!productCode) {
      results.errors.push(`Baris ${i + 2}: product_code / kode_produk kosong`);
      continue;
    }
    
    if (!productMap[productCode]) {
      productMap[productCode] = {
        product_code: productCode,
        product_name: productName,
        category: String(row.category || row.kategori || '').trim(),
        cmt_price: Number(row.cmt_price || row.harga_cmt || 0),
        selling_price: Number(row.selling_price || row.harga_jual || 0),
        variants: []
      };
    }
    
    // Add variant if sku is provided
    const sku = String(row.variant_sku || row.sku || '').trim();
    const size = String(row.variant_size || row.size || row.ukuran || '').trim();
    const color = String(row.variant_color || row.color || row.warna || '').trim();
    
    if (sku || size || color) {
      productMap[productCode].variants.push({ sku, size, color });
    }
  }
  
  // Insert products and their variants
  for (const [code, productData] of Object.entries(productMap)) {
    try {
      const productId = uuidv4();
      const product = {
        id: productId,
        product_code: productData.product_code,
        product_name: productData.product_name,
        category: productData.category,
        cmt_price: productData.cmt_price,
        selling_price: productData.selling_price,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };
      await db.collection('products').insertOne(product);
      results.imported_products++;
      
      // Insert variants
      for (const v of productData.variants) {
        const variant = {
          id: uuidv4(),
          product_id: productId,
          product_code: productData.product_code,
          product_name: productData.product_name,
          sku: v.sku,
          size: v.size,
          color: v.color,
          status: 'active',
          created_at: new Date()
        };
        await db.collection('product_variants').insertOne(variant);
        results.imported_variants++;
      }
    } catch (err) {
      results.errors.push(`Produk ${code}: ${err.message}`);
    }
  }
  
  // Log activity
  await db.collection('activity_logs').insertOne({
    id: uuidv4(), user_id: user.id, user_name: user.name,
    action: 'Import', module: 'Products',
    details: `Imported ${results.imported_products} products, ${results.imported_variants} variants`,
    timestamp: new Date()
  });
  
  return { type: 'products', ...results };
}

// ─── IMPORT GARMENTS (VENDORS) ────────────────────────────────────────────────
async function importGarments(db, rows, user) {
  const results = { imported_garments: 0, vendor_accounts: [], errors: [], skipped: 0 };
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const garmentCode = String(row.garment_code || row.kode_vendor || '').trim();
    const garmentName = String(row.garment_name || row.nama_vendor || '').trim();
    
    if (!garmentCode && !garmentName) {
      results.skipped++;
      continue;
    }
    
    if (!garmentCode) {
      results.errors.push(`Baris ${i + 2}: garment_code / kode_vendor kosong`);
      continue;
    }
    
    try {
      const garmentId = uuidv4();
      const codeSlug = garmentCode.toLowerCase().replace(/[^a-z0-9]/g, '');
      const vendorEmail = `vendor.${codeSlug}@garment.com`;
      
      // Check if email already exists
      const existingUser = await db.collection('users').findOne({ email: vendorEmail });
      if (existingUser) {
        results.errors.push(`Baris ${i + 2}: Email vendor ${vendorEmail} sudah ada (kode: ${garmentCode})`);
        continue;
      }
      
      const rawPassword = generatePassword(10);
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      
      // Create vendor user account
      await db.collection('users').insertOne({
        id: uuidv4(), name: garmentName, email: vendorEmail,
        password: hashedPassword, role: 'vendor', vendor_id: garmentId,
        status: 'active', created_at: new Date(), updated_at: new Date()
      });
      
      // Create garment record
      const garment = {
        id: garmentId,
        garment_code: garmentCode,
        garment_name: garmentName,
        location: String(row.location || row.lokasi || '').trim(),
        contact_person: String(row.contact_person || row.kontak || '').trim(),
        phone: String(row.phone || row.telepon || '').trim(),
        monthly_capacity: Number(row.monthly_capacity || row.kapasitas_bulanan || 0),
        login_email: vendorEmail,
        vendor_password_plain: rawPassword,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };
      await db.collection('garments').insertOne(garment);
      
      results.imported_garments++;
      results.vendor_accounts.push({
        garment_name: garmentName,
        email: vendorEmail,
        password: rawPassword
      });
    } catch (err) {
      results.errors.push(`Baris ${i + 2} (${garmentCode}): ${err.message}`);
    }
  }
  
  await db.collection('activity_logs').insertOne({
    id: uuidv4(), user_id: user.id, user_name: user.name,
    action: 'Import', module: 'Garments',
    details: `Imported ${results.imported_garments} vendors`,
    timestamp: new Date()
  });
  
  return { type: 'garments', ...results };
}

// ─── IMPORT PRODUCTION POs ───────────────────────────────────────────────────
async function importProductionPOs(db, rows, user) {
  const results = { imported_pos: 0, imported_items: 0, errors: [], skipped: 0 };
  
  // Group rows by PO number + vendor + date
  const poMap = {};
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const poNumber = String(row.po_number || row.no_po || '').trim();
    
    if (!poNumber) {
      results.skipped++;
      continue;
    }
    
    const vendorCode = String(row.vendor_code || row.kode_vendor || '').trim();
    const poDate = row.po_date || row.tanggal_po || '';
    
    // Create composite key for grouping: PO + Vendor + Date
    const groupKey = `${poNumber}|${vendorCode}|${poDate}`;
    
    if (!poMap[groupKey]) {
      poMap[groupKey] = {
        po_number: poNumber,
        customer_name: String(row.customer_name || row.nama_customer || '').trim(),
        vendor_code: vendorCode,
        po_date: poDate,
        deadline: row.deadline || '',
        delivery_deadline: row.delivery_deadline || row.deadline_pengiriman || '',
        notes: String(row.notes || row.catatan || '').trim(),
        items: []
      };
    }
    
    // Add item line
    const serialNumber = String(row.serial_number || row.no_seri || '').trim();
    if (!serialNumber) {
      results.errors.push(`Baris ${i + 2}: serial_number / no_seri wajib diisi`);
      continue;
    }
    
    poMap[groupKey].items.push({
      serial_number: serialNumber,
      product_code: String(row.product_code || row.kode_produk || '').trim(),
      variant_sku: String(row.variant_sku || row.sku || '').trim(),
      product_name: String(row.product_name || row.nama_produk || '').trim(),
      size: String(row.size || row.ukuran || '').trim(),
      color: String(row.color || row.warna || '').trim(),
      qty: Number(row.qty || row.jumlah || 0),
      selling_price: Number(row.selling_price || row.harga_jual || 0),
      cmt_price: Number(row.cmt_price || row.harga_cmt || 0),
    });
  }
  
  // Insert POs and their items
  for (const [key, poData] of Object.entries(poMap)) {
    try {
      // Resolve vendor
      let vendorId = null, vendorName = '';
      if (poData.vendor_code) {
        const vendor = await db.collection('garments').findOne({ garment_code: poData.vendor_code });
        if (vendor) {
          vendorId = vendor.id;
          vendorName = vendor.garment_name;
        } else {
          results.errors.push(`PO ${poData.po_number}: Vendor dengan kode "${poData.vendor_code}" tidak ditemukan`);
        }
      }
      
      const poId = uuidv4();
      const parsedDate = poData.po_date ? new Date(poData.po_date) : new Date();
      const po = {
        id: poId,
        po_number: poData.po_number,
        customer_name: poData.customer_name,
        vendor_id: vendorId,
        vendor_name: vendorName,
        po_date: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
        deadline: poData.deadline ? new Date(poData.deadline) : null,
        delivery_deadline: poData.delivery_deadline ? new Date(poData.delivery_deadline) : null,
        status: 'Draft',
        notes: poData.notes,
        created_by: user.name,
        created_at: new Date(),
        updated_at: new Date()
      };
      await db.collection('production_pos').insertOne(po);
      results.imported_pos++;
      
      // Insert items
      for (const item of poData.items) {
        // Try to find product and variant
        let productId = null, productName = item.product_name;
        let variantId = null, sku = item.variant_sku, size = item.size, color = item.color;
        let sellingPrice = item.selling_price, cmtPrice = item.cmt_price;
        
        if (item.product_code) {
          const product = await db.collection('products').findOne({ product_code: item.product_code });
          if (product) {
            productId = product.id;
            productName = productName || product.product_name;
            if (!sellingPrice) sellingPrice = product.selling_price || 0;
            if (!cmtPrice) cmtPrice = product.cmt_price || 0;
          }
        }
        
        if (item.variant_sku && productId) {
          const variant = await db.collection('product_variants').findOne({ 
            sku: item.variant_sku, product_id: productId 
          });
          if (variant) {
            variantId = variant.id;
            size = size || variant.size;
            color = color || variant.color;
            sku = variant.sku;
          }
        }
        
        const poItem = {
          id: uuidv4(),
          po_id: poId,
          po_number: poData.po_number,
          product_id: productId,
          product_name: productName,
          variant_id: variantId,
          serial_number: item.serial_number,
          sku: sku,
          size: size,
          color: color,
          qty: item.qty,
          selling_price_snapshot: sellingPrice,
          cmt_price_snapshot: cmtPrice,
          created_at: new Date()
        };
        await db.collection('po_items').insertOne(poItem);
        results.imported_items++;
      }
    } catch (err) {
      results.errors.push(`PO ${poData.po_number}: ${err.message}`);
    }
  }
  
  await db.collection('activity_logs').insertOne({
    id: uuidv4(), user_id: user.id, user_name: user.name,
    action: 'Import', module: 'Production PO',
    details: `Imported ${results.imported_pos} POs with ${results.imported_items} items`,
    timestamp: new Date()
  });
  
  return { type: 'production-pos', ...results };
}
