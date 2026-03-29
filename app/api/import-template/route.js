import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import * as XLSX from 'xlsx';

const JWT_SECRET = process.env.JWT_SECRET || 'garment_erp_jwt_secret_2025';

function verifyToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
  } catch (e) { return null; }
}

export async function GET(request) {
  const user = verifyToken(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const type = sp.get('type');

  if (!type) return NextResponse.json({ error: 'Tipe template wajib diisi' }, { status: 400 });

  let sheetData, fileName;

  switch (type) {
    case 'products':
      sheetData = [
        {
          product_code: 'PRD-001',
          product_name: 'Kaos Polos',
          category: 'Kaos',
          cmt_price: 15000,
          selling_price: 45000,
          variant_sku: 'KP-S-HTM',
          variant_size: 'S',
          variant_color: 'Hitam',
        },
        {
          product_code: 'PRD-001',
          product_name: 'Kaos Polos',
          category: 'Kaos',
          cmt_price: 15000,
          selling_price: 45000,
          variant_sku: 'KP-M-HTM',
          variant_size: 'M',
          variant_color: 'Hitam',
        },
        {
          product_code: 'PRD-001',
          product_name: 'Kaos Polos',
          category: 'Kaos',
          cmt_price: 15000,
          selling_price: 45000,
          variant_sku: 'KP-L-PTH',
          variant_size: 'L',
          variant_color: 'Putih',
        },
        {
          product_code: 'PRD-002',
          product_name: 'Celana Jeans',
          category: 'Celana',
          cmt_price: 25000,
          selling_price: 85000,
          variant_sku: 'CJ-30-BLU',
          variant_size: '30',
          variant_color: 'Blue',
        },
      ];
      fileName = 'template_import_produk.xlsx';
      break;

    case 'garments':
      sheetData = [
        {
          garment_code: 'GRM-001',
          garment_name: 'CV Maju Jaya',
          location: 'Bandung',
          contact_person: 'Budi Santoso',
          phone: '08123456789',
          monthly_capacity: 5000,
        },
        {
          garment_code: 'GRM-002',
          garment_name: 'PT Sinar Abadi',
          location: 'Surabaya',
          contact_person: 'Dewi Lestari',
          phone: '08198765432',
          monthly_capacity: 10000,
        },
      ];
      fileName = 'template_import_vendor.xlsx';
      break;

    case 'production-pos':
      sheetData = [
        {
          po_number: 'PO-2025-001',
          customer_name: 'PT Retail Indonesia',
          vendor_code: 'GRM-001',
          po_date: '2025-02-01',
          deadline: '2025-03-01',
          delivery_deadline: '2025-03-15',
          serial_number: 'SN-001',
          product_code: 'PRD-001',
          variant_sku: 'KP-S-HTM',
          product_name: 'Kaos Polos',
          size: 'S',
          color: 'Hitam',
          qty: 100,
          selling_price: 45000,
          cmt_price: 15000,
          notes: 'Order pertama',
        },
        {
          po_number: 'PO-2025-001',
          customer_name: 'PT Retail Indonesia',
          vendor_code: 'GRM-001',
          po_date: '2025-02-01',
          deadline: '2025-03-01',
          delivery_deadline: '2025-03-15',
          serial_number: 'SN-002',
          product_code: 'PRD-001',
          variant_sku: 'KP-M-HTM',
          product_name: 'Kaos Polos',
          size: 'M',
          color: 'Hitam',
          qty: 200,
          selling_price: 45000,
          cmt_price: 15000,
          notes: '',
        },
        {
          po_number: 'PO-2025-002',
          customer_name: 'CV Fashion Store',
          vendor_code: 'GRM-002',
          po_date: '2025-02-05',
          deadline: '2025-04-01',
          delivery_deadline: '2025-04-10',
          serial_number: 'SN-A01',
          product_code: 'PRD-002',
          variant_sku: 'CJ-30-BLU',
          product_name: 'Celana Jeans',
          size: '30',
          color: 'Blue',
          qty: 50,
          selling_price: 85000,
          cmt_price: 25000,
          notes: 'Urgent order',
        },
      ];
      fileName = 'template_import_production_po.xlsx';
      break;

    default:
      return NextResponse.json({ error: `Tipe template tidak dikenal: ${type}` }, { status: 400 });
  }

  // Generate Excel workbook
  const ws = XLSX.utils.json_to_sheet(sheetData);
  
  // Set column widths
  const colWidths = Object.keys(sheetData[0]).map(key => ({
    wch: Math.max(key.length + 2, ...sheetData.map(r => String(r[key] || '').length + 2))
  }));
  ws['!cols'] = colWidths;
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  
  // Add instruction sheet
  const instructions = [];
  if (type === 'products') {
    instructions.push(
      { Instruksi: 'PANDUAN IMPORT PRODUK' },
      { Instruksi: '1. Kolom product_code dan product_name WAJIB diisi' },
      { Instruksi: '2. Satu product_code bisa memiliki banyak varian (baris berbeda)' },
      { Instruksi: '3. Isi variant_sku, variant_size, variant_color untuk setiap varian' },
      { Instruksi: '4. Harga cmt_price dan selling_price dalam Rupiah (angka saja)' },
      { Instruksi: '5. Product dengan kode yang sama akan dikelompokkan sebagai 1 produk' },
    );
  } else if (type === 'garments') {
    instructions.push(
      { Instruksi: 'PANDUAN IMPORT VENDOR' },
      { Instruksi: '1. Kolom garment_code dan garment_name WAJIB diisi' },
      { Instruksi: '2. Sistem akan otomatis membuat akun login untuk setiap vendor' },
      { Instruksi: '3. Email login: vendor.[kode]@garment.com' },
      { Instruksi: '4. Password akan digenerate otomatis' },
      { Instruksi: '5. Pastikan kode vendor unik (tidak duplikat)' },
    );
  } else if (type === 'production-pos') {
    instructions.push(
      { Instruksi: 'PANDUAN IMPORT PRODUCTION PO' },
      { Instruksi: '1. Kolom po_number dan serial_number WAJIB diisi' },
      { Instruksi: '2. PO number BOLEH duplikat (identifier: PO + Vendor + Tanggal)' },
      { Instruksi: '3. Beberapa baris dengan po_number + vendor_code + po_date sama = 1 PO dengan banyak item' },
      { Instruksi: '4. vendor_code harus sesuai dengan kode vendor yang sudah ada di sistem' },
      { Instruksi: '5. Format tanggal: YYYY-MM-DD (contoh: 2025-02-01)' },
      { Instruksi: '6. product_code dan variant_sku opsional — jika diisi, sistem akan mencari produk yang sesuai' },
      { Instruksi: '7. Jika product_code tidak ditemukan, product_name dan harga dari Excel yang digunakan' },
    );
  }
  
  if (instructions.length > 0) {
    const wsInstructions = XLSX.utils.json_to_sheet(instructions);
    wsInstructions['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Panduan');
  }
  
  const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(excelBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}
