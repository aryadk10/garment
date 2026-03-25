import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';

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
  try { return jwt.verify(authHeader.split(' ')[1], JWT_SECRET); }
  catch (e) { return null; }
}

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/zip', 'application/x-zip-compressed',
  'application/octet-stream'
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request) {
  const user = verifyToken(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const entityType = formData.get('entity_type');
    const entityId = formData.get('entity_id');

    if (!file || !entityType || !entityId) {
      return NextResponse.json({ error: 'file, entity_type, dan entity_id wajib diisi' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Ukuran file maksimal 10MB' }, { status: 400 });
    }

    const ext = file.name.split('.').pop().toLowerCase();
    const safeExt = ['pdf','jpg','jpeg','png','webp','gif','xlsx','xls','zip'].includes(ext) ? ext : 'bin';
    const uniqueFilename = `${uuidv4()}.${safeExt}`;

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', entityType, entityId);
    await mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filepath = path.join(uploadDir, uniqueFilename);
    await writeFile(filepath, buffer);

    const publicPath = `/uploads/${entityType}/${entityId}/${uniqueFilename}`;

    const db = await getDb();
    const attachment = {
      id: uuidv4(),
      entity_type: entityType,
      entity_id: entityId,
      filename: uniqueFilename,
      original_name: file.name,
      size: file.size,
      mime_type: file.type,
      file_ext: safeExt,
      public_path: publicPath,
      filepath: filepath,
      uploaded_by: user.name,
      uploaded_at: new Date()
    };
    await db.collection('attachments').insertOne(attachment);

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const user = verifyToken(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const db = await getDb();
    const doc = await db.collection('attachments').findOne({ id });
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Superadmin or uploader can delete
    if (user.role !== 'superadmin' && doc.uploaded_by !== user.name) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try { await unlink(doc.filepath); } catch (e) { console.warn('File not found on disk:', e.message); }
    await db.collection('attachments').deleteOne({ id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete attachment error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
