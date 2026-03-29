'use client';
import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import DataTable from './DataTable';
import Modal from './Modal';
import StatusBadge from './StatusBadge';
import ConfirmDialog from './ConfirmDialog';
import ImportExportPanel from './ImportExportPanel';

export default function ProductsModule({ token, userRole }) {
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmDeleteVariant, setConfirmDeleteVariant] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [variantForm, setVariantForm] = useState({ size: '', color: '', sku: '' });
  const [form, setForm] = useState({ product_code: '', product_name: '', category: '', cmt_price: '', selling_price: '', status: 'active' });

  const isSuperAdmin = userRole === 'superadmin';
  const canEdit = ['superadmin', 'admin'].includes(userRole);

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async (search = '') => {
    const url = search ? `/api/products?search=${search}` : '/api/products';
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setProducts(Array.isArray(data) ? data : []);
  };

  const fetchVariants = async (productId) => {
    const res = await fetch(`/api/product-variants?product_id=${productId}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setVariants(Array.isArray(data) ? data : []);
  };

  const toggleExpand = async (productId) => {
    if (expandedProduct === productId) { setExpandedProduct(null); return; }
    setExpandedProduct(productId);
    await fetchVariants(productId);
  };

  const openCreate = () => {
    setEditData(null);
    setForm({ product_code: '', product_name: '', category: '', cmt_price: '', selling_price: '', status: 'active' });
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditData(row);
    setForm({ product_code: row.product_code, product_name: row.product_name, category: row.category || '', cmt_price: row.cmt_price || '', selling_price: row.selling_price || '', status: row.status });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, cmt_price: Number(form.cmt_price) || 0, selling_price: Number(form.selling_price) || 0 };
    const url = editData ? `/api/products/${editData.id}` : '/api/products';
    const method = editData ? 'PUT' : 'POST';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    setShowModal(false);
    fetchProducts();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await fetch(`/api/products/${confirmDelete.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setConfirmDelete(null);
    fetchProducts();
  };

  const openAddVariant = (product) => {
    setSelectedProduct(product);
    setVariantForm({ size: '', color: '', sku: '' });
    setShowVariantModal(true);
  };

  const handleAddVariant = async (e) => {
    e.preventDefault();
    await fetch('/api/product-variants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...variantForm, product_id: selectedProduct.id })
    });
    setShowVariantModal(false);
    await fetchVariants(selectedProduct.id);
  };

  const handleDeleteVariant = async () => {
    if (!confirmDeleteVariant) return;
    await fetch(`/api/product-variants/${confirmDeleteVariant.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setConfirmDeleteVariant(null);
    if (expandedProduct) await fetchVariants(expandedProduct);
  };

  const fmt = (v) => v ? 'Rp ' + Number(v).toLocaleString('id-ID') : '-';

  const columns = [
    { key: 'expand', label: '', render: (_, row) => (
      <button onClick={() => toggleExpand(row.id)} className="p-1 text-slate-400 hover:text-blue-600">
        {expandedProduct === row.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
    )},
    { key: 'product_code', label: 'Kode', render: (v) => <span className="font-mono text-xs font-bold text-slate-700">{v}</span> },
    { key: 'product_name', label: 'Nama Produk' },
    { key: 'category', label: 'Kategori' },
    { key: 'cmt_price', label: 'CMT Price', render: (v) => <span className="font-medium text-amber-700">{fmt(v)}</span> },
    { key: 'selling_price', label: 'Selling Price', render: (v) => <span className="font-medium text-emerald-700">{fmt(v)}</span> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'actions', label: 'Aksi',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openAddVariant(row)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600 text-xs transition-colors" title="Tambah Varian">
            + Varian
          </button>
          {isSuperAdmin && (
            <>
              <button onClick={() => openEdit(row)} className="p-1.5 rounded hover:bg-amber-50 text-amber-600 transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => setConfirmDelete(row)} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors" title="Hapus"><Trash2 className="w-4 h-4" /></button>
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Data Produk</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola produk, harga CMT, harga jual, dan varian SKU</p>
        </div>
        {isSuperAdmin && <span className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>Mode Superadmin</span>}
      </div>

      <DataTable
        columns={columns}
        data={products}
        searchKeys={['product_code', 'product_name', 'category']}
        onSearch={fetchProducts}
        expandedRow={(row) => expandedProduct === row.id ? (
          <div className="bg-slate-50 border-t border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-700">Varian Produk — {row.product_name}</h4>
            </div>
            {variants.filter(v => v.product_id === row.id).length === 0 ? (
              <p className="text-sm text-slate-400 italic">Belum ada varian. Klik "+ Varian" untuk menambahkan.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {variants.filter(v => v.product_id === row.id).map(v => (
                  <div key={v.id} className="bg-white border border-slate-200 rounded-lg p-2.5 flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{v.sku}</p>
                      <p className="text-xs text-slate-500">{v.size} / {v.color}</p>
                    </div>
                    {isSuperAdmin && (
                      <button onClick={() => setConfirmDeleteVariant(v)} className="text-red-400 hover:text-red-600 ml-1"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
        actions={
          <div className="flex items-center gap-2">
            <ImportExportPanel token={token} importType="products" exportType={null} onImportSuccess={() => fetchProducts()} />
            {isSuperAdmin && (
              <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                <Plus className="w-4 h-4" /> Tambah Produk
              </button>
            )}
          </div>
        }
      />

      {/* Product Modal */}
      {showModal && (
        <Modal title={editData ? 'Edit Produk' : 'Tambah Produk'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kode Produk *</label>
                <input required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.product_code} onChange={e => setForm({...form, product_code: e.target.value})} placeholder="PRD-001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Produk *</label>
                <input required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.product_name} onChange={e => setForm({...form, product_name: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="Kemeja, Celana, Kaos..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">CMT Price (Rp) <span className="text-xs text-slate-400">biaya ke vendor</span></label>
                <input type="number" min="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.cmt_price} onChange={e => setForm({...form, cmt_price: e.target.value})} placeholder="35000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price (Rp) <span className="text-xs text-slate-400">harga jual ke customer</span></label>
                <input type="number" min="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.selling_price} onChange={e => setForm({...form, selling_price: e.target.value})} placeholder="85000" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">{editData ? 'Simpan Perubahan' : 'Tambah Produk'}</button>
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-slate-200 py-2 rounded-lg text-sm hover:bg-slate-50">Batal</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Variant Modal */}
      {showVariantModal && selectedProduct && (
        <Modal title={`Tambah Varian — ${selectedProduct.product_name}`} onClose={() => setShowVariantModal(false)}>
          <form onSubmit={handleAddVariant} className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
              <p>Kode Produk: <strong>{selectedProduct.product_code}</strong></p>
              <p className="text-xs mt-1 text-blue-600">Contoh SKU: {selectedProduct.product_code}-BLK-M, {selectedProduct.product_code}-WHT-L</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ukuran *</label>
                <input required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={variantForm.size} onChange={e => setVariantForm({...variantForm, size: e.target.value})} placeholder="S, M, L, XL, 30, 32..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Warna *</label>
                <input required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={variantForm.color} onChange={e => setVariantForm({...variantForm, color: e.target.value})} placeholder="Hitam, Putih, Biru..." />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">SKU *</label>
              <input required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" value={variantForm.sku} onChange={e => setVariantForm({...variantForm, sku: e.target.value})} placeholder={`${selectedProduct.product_code}-BLK-M`} />
              <p className="text-xs text-slate-400 mt-1">SKU harus unik di seluruh sistem</p>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Tambah Varian</button>
              <button type="button" onClick={() => setShowVariantModal(false)} className="flex-1 border border-slate-200 py-2 rounded-lg text-sm hover:bg-slate-50">Batal</button>
            </div>
          </form>
        </Modal>
      )}

      {confirmDelete && <ConfirmDialog title="Hapus Produk?" message={`Produk "${confirmDelete.product_name}" dan semua variannya akan dihapus permanen.`} onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />}
      {confirmDeleteVariant && <ConfirmDialog title="Hapus Varian?" message={`Varian SKU "${confirmDeleteVariant.sku}" (${confirmDeleteVariant.size}/${confirmDeleteVariant.color}) akan dihapus permanen.`} onConfirm={handleDeleteVariant} onCancel={() => setConfirmDeleteVariant(null)} />}
    </div>
  );
}
