'use client';
import { useState, useEffect } from 'react';
import { Plus, Pencil, UserX, UserCheck, Trash2 } from 'lucide-react';
import DataTable from './DataTable';
import Modal from './Modal';
import StatusBadge from './StatusBadge';
import ConfirmDialog from './ConfirmDialog';

const ROLES = ['admin', 'production', 'finance', 'management'];

export default function UserManagementModule({ token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'production', status: 'active' });

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const res = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setUsers(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditData(null);
    setForm({ name: '', email: '', password: '', role: 'production', status: 'active' });
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditData(row);
    setForm({ name: row.name, email: row.email, password: '', role: row.role, status: row.status });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form };
    if (editData && !payload.password) delete payload.password;
    const url = editData ? `/api/users/${editData.id}` : '/api/users';
    const method = editData ? 'PUT' : 'POST';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    setShowModal(false);
    fetchUsers();
  };

  const toggleStatus = async (row) => {
    const newStatus = row.status === 'active' ? 'inactive' : 'active';
    await fetch(`/api/users/${row.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: newStatus })
    });
    fetchUsers();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await fetch(`/api/users/${confirmDelete.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    setConfirmDelete(null);
    fetchUsers();
  };

  const roleColors = {
    superadmin: 'bg-purple-100 text-purple-700',
    admin: 'bg-blue-100 text-blue-700',
    production: 'bg-emerald-100 text-emerald-700',
    finance: 'bg-amber-100 text-amber-700',
    management: 'bg-slate-100 text-slate-700'
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID') : '-';

  const columns = [
    {
      key: 'avatar', label: '',
      render: (_, row) => (
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
          {row.name?.[0]?.toUpperCase()}
        </div>
      )
    },
    { key: 'name', label: 'Nama' },
    { key: 'email', label: 'Email' },
    {
      key: 'role', label: 'Role',
      render: (v) => <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${roleColors[v] || 'bg-slate-100 text-slate-700'}`}>{v}</span>
    },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'created_at', label: 'Dibuat', render: (v) => formatDate(v) },
    {
      key: 'actions', label: 'Aksi',
      render: (_, row) => (
        row.role !== 'superadmin' ? (
          <div className="flex items-center gap-1">
            <button onClick={() => openEdit(row)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600 transition-colors" title="Edit">
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => toggleStatus(row)}
              className={`p-1.5 rounded transition-colors ${row.status === 'active' ? 'hover:bg-amber-50 text-amber-500' : 'hover:bg-emerald-50 text-emerald-600'}`}
              title={row.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
            >
              {row.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            </button>
            <button onClick={() => setConfirmDelete(row)} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors" title="Hapus User">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : <span className="text-xs text-slate-400 italic">Protected</span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen User</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola pengguna dan hak akses sistem</p>
        </div>
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
          Mode Superadmin
        </span>
      </div>

      {/* Role Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(roleColors).map(([role, color]) => (
          <span key={role} className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${color}`}>{role}</span>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={users}
        searchKeys={['name', 'email', 'role']}
        actions={
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Tambah User
          </button>
        }
      />

      {showModal && (
        <Modal title={editData ? 'Edit User' : 'Tambah User'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap *</label>
              <input required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
              <input required type="email" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password {editData && <span className="text-slate-400 text-xs">(kosongkan jika tidak diubah)</span>}
              </label>
              <input type="password" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                placeholder={editData ? '••••••••' : 'Minimal 6 karakter'} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-700">
              Password default untuk user baru: <strong>User@123</strong>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                {editData ? 'Simpan Perubahan' : 'Tambah User'}
              </button>
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-slate-200 py-2 rounded-lg text-sm hover:bg-slate-50">Batal</button>
            </div>
          </form>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Hapus User?"
          message={`User "${confirmDelete.name}" (${confirmDelete.email}) akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
