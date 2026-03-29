'use client';
import { useState, useEffect } from 'react';
import { Package, Truck, TrendingUp, Send, LogOut, CheckCircle, Clock, Plus, X, Download, Briefcase, AlertTriangle, BarChart2, ChevronDown, ChevronRight, ClipboardCheck, AlertOctagon } from 'lucide-react';
import Modal from './Modal';
import StatusBadge from './StatusBadge';

function StatCard({ title, value, icon: Icon, color, sub, alert }) {
  return (
    <div className={`bg-white rounded-xl border p-5 shadow-sm ${alert ? 'border-red-300 bg-red-50/40' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${alert ? 'text-red-700' : 'text-slate-800'}`}>{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

function MiniBar({ pct }) {
  const color = pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 30 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-700 w-9 text-right">{pct}%</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function VendorPortalApp({ user, token, onLogout }) {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const modules = [
    { id: 'dashboard',         label: 'Dashboard',              icon: BarChart2 },
    { id: 'receiving',         label: 'Penerimaan Material',    icon: Package },
    { id: 'inspeksi',          label: 'Inspeksi Material',      icon: ClipboardCheck },
    { id: 'production-jobs',   label: 'Pekerjaan Produksi',     icon: Briefcase },
    { id: 'progress',          label: 'Progress Produksi',      icon: TrendingUp },
    { id: 'defect-reports',    label: 'Laporan Cacat Material', icon: AlertOctagon },
    { id: 'buyer-shipments',   label: 'Pengiriman ke Buyer',    icon: Send },
  ];

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':       return <VendorDashboard token={token} user={user} onNavigate={setActiveModule} />;
      case 'receiving':       return <VendorReceiving token={token} user={user} />;
      case 'inspeksi':        return <VendorMaterialInspection token={token} user={user} />;
      case 'production-jobs': return <VendorProductionJobs token={token} user={user} />;
      case 'progress':        return <VendorProgress token={token} user={user} />;
      case 'defect-reports':  return <VendorDefectReports token={token} user={user} />;
      case 'buyer-shipments': return <VendorBuyerShipments token={token} user={user} />;
      default:                return <VendorDashboard token={token} user={user} onNavigate={setActiveModule} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full bg-emerald-900 text-white transition-all duration-300 z-40 flex flex-col ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="flex items-center justify-between p-4 border-b border-emerald-800">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center"><Truck className="w-5 h-5" /></div>
              <div><div className="font-bold text-sm">VENDOR PORTAL</div><div className="text-emerald-300 text-xs">Garment ERP</div></div>
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="text-emerald-300 hover:text-white ml-auto">
            {sidebarCollapsed ? <Package className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
        </div>
        {!sidebarCollapsed && (
          <div className="px-4 py-3 border-b border-emerald-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-sm font-bold">{user?.name?.[0]?.toUpperCase()}</div>
              <div><div className="text-sm font-medium truncate">{user?.name}</div><div className="text-xs text-emerald-300">Vendor Portal</div></div>
            </div>
          </div>
        )}
        <nav className="flex-1 py-2 overflow-y-auto">
          {modules.map(m => {
            const Icon = m.icon;
            return (
              <button key={m.id} onClick={() => setActiveModule(m.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${activeModule === m.id ? 'bg-emerald-600 text-white' : 'text-emerald-200 hover:bg-emerald-800'} ${sidebarCollapsed ? 'justify-center' : ''}`}
                title={sidebarCollapsed ? m.label : ''}>
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>{m.label}</span>}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-emerald-800 p-2">
          <button onClick={onLogout} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-300 hover:bg-emerald-800 hover:text-white rounded ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <LogOut className="w-5 h-5" />{!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </div>

      <div className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-800">{modules.find(m => m.id === activeModule)?.label}</h2>
            <p className="text-xs text-slate-400">{user?.name} — Vendor Portal</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-sm text-emerald-700 font-medium">Online</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{renderModule()}</main>
      </div>
    </div>
  );
}

// ─── VENDOR DASHBOARD ─────────────────────────────────────────────────────────
function VendorDashboard({ token, user, onNavigate }) {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    fetch('/api/vendor/dashboard', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setMetrics).catch(console.error);
  }, []);

  const fmtDate = d => d ? new Date(d).toLocaleDateString('id-ID') : '-';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard Vendor</h1>
        <p className="text-slate-500 text-sm mt-1">Ikhtisar produksi — {user?.name}</p>
      </div>

      {/* Row 1: Job & Progress */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Job Produksi Aktif" value={metrics?.activeJobs || 0} icon={Briefcase} color="bg-blue-500" sub="job parent berjalan" />
        <StatCard title="Job Selesai" value={metrics?.completedJobs || 0} icon={TrendingUp} color="bg-emerald-500" sub="selesai diproduksi" />
        <StatCard title="Total Diproduksi" value={`${(metrics?.totalProduced || 0).toLocaleString('id-ID')} pcs`} icon={TrendingUp} color="bg-teal-500" sub={`${metrics?.progressPct || 0}% dari material tersedia`} />
        <StatCard title="Job Overdue" value={metrics?.overdueJobs || 0} icon={AlertTriangle} color={metrics?.overdueJobs > 0 ? "bg-red-500" : "bg-slate-400"} sub="melewati deadline" alert={metrics?.overdueJobs > 0} />
      </div>

      {/* Row 2: Material Status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Material Diterima" value={`${(metrics?.totalReceived || 0).toLocaleString('id-ID')} pcs`} icon={Package} color="bg-emerald-500" sub="dari semua shipment" />
        <StatCard title="Material Kurang" value={`${(metrics?.totalMissing || 0).toLocaleString('id-ID')} pcs`} icon={AlertTriangle} color={metrics?.totalMissing > 0 ? "bg-amber-500" : "bg-slate-400"} sub="belum dikirim" alert={metrics?.totalMissing > 0} />
        <StatCard title="Material Cacat" value={`${(metrics?.totalDefect || 0).toLocaleString('id-ID')} pcs`} icon={AlertTriangle} color={metrics?.totalDefect > 0 ? "bg-red-400" : "bg-slate-400"} sub="dari laporan defect" alert={metrics?.totalDefect > 0} />
        <StatCard title="Shipment Masuk" value={metrics?.incomingShipments || 0} icon={Package} color="bg-amber-500" sub="menunggu konfirmasi" alert={metrics?.incomingShipments > 0} />
      </div>

      {/* Row 3: Requests & Shipments */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Permintaan Tambahan" value={metrics?.pendingAdditional || 0} icon={AlertTriangle} color={metrics?.pendingAdditional > 0 ? "bg-orange-500" : "bg-slate-400"} sub="pending persetujuan" alert={metrics?.pendingAdditional > 0} />
        <StatCard title="Permintaan Pengganti" value={metrics?.pendingReplacement || 0} icon={AlertTriangle} color={metrics?.pendingReplacement > 0 ? "bg-red-400" : "bg-slate-400"} sub="pending persetujuan" alert={metrics?.pendingReplacement > 0} />
        <StatCard title="Buyer Shipments" value={metrics?.pendingBuyerShipments || 0} icon={Send} color="bg-purple-500" sub="total pengiriman ke buyer" />
        <StatCard title="Inspeksi Pending" value={metrics?.pendingInspections || 0} icon={Package} color={metrics?.pendingInspections > 0 ? "bg-amber-600" : "bg-slate-400"} sub="shipment belum diinspeksi" alert={metrics?.pendingInspections > 0} />
      </div>

      {/* Overall progress */}
      {metrics && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-slate-700 text-sm">Progress Produksi Keseluruhan (Parent + Child Jobs)</span>
            <span className="text-sm font-bold text-blue-700">
              {(metrics.totalProduced || 0).toLocaleString('id-ID')} / {(metrics.totalAvailable || 0).toLocaleString('id-ID')} pcs ({metrics.progressPct || 0}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3">
            <div className="h-3 rounded-full transition-all bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${Math.min(100, metrics.progressPct || 0)}%` }} />
          </div>
          {(metrics.totalMissing > 0 || metrics.totalDefect > 0) && (
            <div className="flex gap-4 mt-3 text-xs">
              {metrics.totalMissing > 0 && (
                <span className="px-2 py-1 bg-amber-50 border border-amber-200 rounded text-amber-700">
                  ⚠️ {metrics.totalMissing.toLocaleString('id-ID')} pcs material kurang
                </span>
              )}
              {metrics.totalDefect > 0 && (
                <span className="px-2 py-1 bg-red-50 border border-red-200 rounded text-red-700">
                  🚫 {metrics.totalDefect.toLocaleString('id-ID')} pcs material cacat
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Alerts */}
      {metrics?.alerts?.overdueJobs?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="font-semibold text-red-700 flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4" /> Job Melewati Deadline ({metrics.alerts.overdueJobs.length})</h3>
          <div className="space-y-2">
            {metrics.alerts.overdueJobs.map(j => (
              <div key={j.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-red-100">
                <div>
                  <span className="font-bold text-red-800 text-sm">{j.job_number}</span>
                  <span className="text-xs text-slate-500 ml-2">PO: {j.po_number}</span>
                </div>
                <span className="text-xs text-red-600 font-medium">Deadline: {fmtDate(j.deadline)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {metrics?.alerts?.nearDeadlineJobs?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="font-semibold text-amber-700 flex items-center gap-2 mb-3"><Clock className="w-4 h-4" /> Mendekati Deadline ({metrics.alerts.nearDeadlineJobs.length})</h3>
          <div className="space-y-2">
            {metrics.alerts.nearDeadlineJobs.map(j => (
              <div key={j.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-100">
                <div>
                  <span className="font-bold text-amber-800 text-sm">{j.job_number}</span>
                  <span className="text-xs text-slate-500 ml-2">PO: {j.po_number}</span>
                </div>
                <span className="text-xs text-amber-600 font-medium">Deadline: {fmtDate(j.deadline)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onNavigate('receiving')} className="py-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-sm font-medium hover:bg-amber-100 transition-colors">
          📦 Penerimaan Material
        </button>
        <button onClick={() => onNavigate('production-jobs')} className="py-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-100 transition-colors">
          💼 Kelola Job Produksi
        </button>
        <button onClick={() => onNavigate('progress')} className="py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-medium hover:bg-emerald-100 transition-colors">
          📈 Input Progress Produksi
        </button>
        <button onClick={() => onNavigate('buyer-shipments')} className="py-3 bg-purple-50 border border-purple-200 text-purple-700 rounded-xl text-sm font-medium hover:bg-purple-100 transition-colors">
          🚚 Pengiriman ke Buyer
        </button>
      </div>
    </div>
  );
}

// ─── VENDOR RECEIVING ─────────────────────────────────────────────────────────
function VendorReceiving({ token, user }) {
  const [shipments, setShipments] = useState([]);

  useEffect(() => { fetchShipments(); }, []);

  const fetchShipments = async () => {
    const res = await fetch('/api/vendor-shipments', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setShipments(Array.isArray(data) ? data : []);
  };

  const confirmReceive = async (shipment) => {
    if (!confirm(`Konfirmasi penerimaan shipment ${shipment.shipment_number}?\nSetelah dikonfirmasi, selesaikan inspeksi material sebelum memulai produksi.`)) return;
    const res = await fetch(`/api/vendor-shipments/${shipment.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'Received', received_at: new Date() })
    });
    if (res.ok) fetchShipments();
    else { const d = await res.json(); alert(d.error || 'Gagal mengkonfirmasi'); }
  };

  const fmtDate = d => d ? new Date(d).toLocaleDateString('id-ID') : '-';

  // Build parent-child tree
  const parentShipments = shipments.filter(s => !s.parent_shipment_id);
  const childMap = {};
  shipments.filter(s => s.parent_shipment_id).forEach(s => {
    if (!childMap[s.parent_shipment_id]) childMap[s.parent_shipment_id] = [];
    childMap[s.parent_shipment_id].push(s);
  });

  const getTypeLabel = (type) => {
    if (type === 'ADDITIONAL') return { label: 'Pengiriman Tambahan', color: 'bg-amber-100 text-amber-700' };
    if (type === 'REPLACEMENT') return { label: 'Pengiriman Pengganti', color: 'bg-red-100 text-red-700' };
    return { label: 'Pengiriman Awal', color: 'bg-blue-100 text-blue-700' };
  };

  const getStatusConfig = (s) => {
    if (s.status === 'Sent') return { label: 'Belum Diterima', color: 'border-amber-200 bg-amber-50/30' };
    if (s.status === 'Received' && s.inspection_status !== 'Inspected') return { label: 'Diterima – Menunggu Inspeksi', color: 'border-blue-200 bg-blue-50/20' };
    if (s.status === 'Received' && s.inspection_status === 'Inspected') return { label: 'Diterima & Diinspeksi', color: 'border-emerald-200 bg-emerald-50/20' };
    return { label: s.status, color: 'border-slate-200' };
  };

  const renderShipment = (s, isChild = false) => {
    const typeConf = getTypeLabel(s.shipment_type);
    const statusConf = getStatusConfig(s);
    const children = childMap[s.id] || [];
    return (
      <div key={s.id} className={`rounded-xl border p-4 shadow-sm ${statusConf.color} ${isChild ? 'ml-6 border-dashed' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {isChild && <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
              <span className="font-bold text-slate-800 font-mono">{s.shipment_number}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeConf.color}`}>{typeConf.label}</span>
              <StatusBadge status={s.status} />
              {s.inspection_status === 'Inspected' && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">✓ Diinspeksi</span>}
            </div>
            {s.delivery_note_number && <p className="text-xs text-slate-500 font-mono mt-0.5">SJ: {s.delivery_note_number}</p>}
            <p className="text-sm text-slate-500 mt-1">{fmtDate(s.shipment_date)} • {s.vendor_name}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-500">
              <span>{(s.items || []).length} item</span>
              {s.total_received != null && <span>• Diterima: <strong className="text-emerald-700">{s.total_received} pcs</strong></span>}
              {(s.total_missing || 0) > 0 && <span>• Missing: <strong className="text-red-600">{s.total_missing} pcs</strong></span>}
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end flex-shrink-0">
            {s.status === 'Sent' && (
              <button onClick={() => confirmReceive(s)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                <CheckCircle className="w-4 h-4" /> Konfirmasi Terima
              </button>
            )}
            {s.status === 'Received' && s.inspection_status !== 'Inspected' && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-center">
                ⏰ Wajib inspeksi dalam 3 hari
              </div>
            )}
            {s.status === 'Received' && s.inspection_status === 'Inspected' && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm border border-emerald-200">
                <CheckCircle className="w-4 h-4" /> Selesai
              </span>
            )}
          </div>
        </div>

        {/* Items */}
        {(s.items || []).length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {s.items.map(item => (
                <div key={item.id} className="bg-white rounded-lg p-2.5 border border-slate-100">
                  <p className="text-sm font-medium">{item.product_name}</p>
                  <p className="text-xs text-slate-500 font-mono">{item.sku || '-'} • {item.size}/{item.color}</p>
                  {item.serial_number && <p className="text-xs text-amber-700 font-mono mt-0.5">SN: {item.serial_number}</p>}
                  <p className="text-sm font-bold text-blue-700 mt-1">{(item.qty_sent || 0).toLocaleString('id-ID')} pcs</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Child Shipments */}
        {children.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold text-slate-500">Child Shipments ({children.length})</p>
            {children.map(child => renderShipment(child, true))}
          </div>
        )}
      </div>
    );
  };

  const pendingCount = shipments.filter(s => s.status === 'Sent').length;
  const needsInspection = shipments.filter(s => s.status === 'Received' && s.inspection_status !== 'Inspected').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Penerimaan Material</h1>
        <p className="text-slate-500 text-sm mt-1">Konfirmasi penerimaan material dan lihat hierarki shipment (awal, tambahan, pengganti).</p>
      </div>

      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-sm font-semibold text-amber-700">⚠️ {pendingCount} Shipment Menunggu Konfirmasi</p>
          <p className="text-xs text-amber-600 mt-0.5">Konfirmasi penerimaan sebelum melakukan inspeksi material</p>
        </div>
      )}
      {needsInspection > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm font-semibold text-red-700">🔍 {needsInspection} Shipment Menunggu Inspeksi Material</p>
          <p className="text-xs text-red-600 mt-0.5">Inspeksi wajib diselesaikan dalam 3 hari. Produksi tidak dapat dimulai sebelum inspeksi selesai.</p>
        </div>
      )}

      <div className="space-y-4">
        {parentShipments.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-400">Tidak ada shipment masuk</p>
          </div>
        ) : parentShipments.map(s => renderShipment(s, false))}
      </div>
    </div>
  );
}

// ─── VENDOR PRODUCTION JOBS ───────────────────────────────────────────────────
function VendorProductionJobs({ token, user }) {
  const [jobs, setJobs] = useState([]);
  const [receivedShipments, setReceivedShipments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailJob, setDetailJob] = useState(null);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [form, setForm] = useState({ vendor_shipment_id: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [expandedJobs, setExpandedJobs] = useState({});
  const [searchShipment, setSearchShipment] = useState('');
  const [jobSearch, setJobSearch] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [jRes, sRes] = await Promise.all([
      fetch('/api/production-jobs', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/vendor-shipments', { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const [jData, sData] = await Promise.all([jRes.json(), sRes.json()]);
    setJobs(Array.isArray(jData) ? jData : []);
    const allShipments = Array.isArray(sData) ? sData : [];
    const existingJobShipmentIds = new Set((Array.isArray(jData) ? jData : []).map(j => j.vendor_shipment_id));
    setReceivedShipments(allShipments.filter(s => s.status === 'Received' && !existingJobShipmentIds.has(s.id) && s.inspection_status === 'Inspected' && !s.parent_shipment_id));
  };

  const loadShipmentPreview = async (shipmentId) => {
    const ship = receivedShipments.find(s => s.id === shipmentId);
    setSelectedShipment(ship || null);
    setForm(f => ({ ...f, vendor_shipment_id: shipmentId }));
    if (shipmentId && !ship?.items?.length) {
      const res = await fetch(`/api/vendor-shipment-items?shipment_id=${shipmentId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (Array.isArray(data)) setSelectedShipment(prev => prev ? { ...prev, items: data } : ship);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.vendor_shipment_id) { alert('Pilih shipment terlebih dahulu'); return; }
    setLoading(true);
    const res = await fetch('/api/production-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, vendor_id: user.vendor_id })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { alert(data.error || 'Gagal membuat Production Job'); return; }
    setShowModal(false);
    fetchAll();
  };

  const openDetail = async (job) => {
    const res = await fetch(`/api/production-jobs/${job.id}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setDetailJob(data);
    setShowDetail(true);
  };

  const toggleJob = (jobId) => setExpandedJobs(prev => ({ ...prev, [jobId]: !prev[jobId] }));

  const fmtDate = d => d ? new Date(d).toLocaleDateString('id-ID') : '-';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pekerjaan Produksi</h1>
          <p className="text-slate-500 text-sm mt-1">Buat Job Produksi dari bahan yang sudah diterima & diinspeksi. Qty otomatis = Material Diterima.</p>
        </div>
        <button
          onClick={() => { setForm({ vendor_shipment_id: '', notes: '' }); setSelectedShipment(null); setShowModal(true); }}
          disabled={receivedShipments.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> Buat Job Produksi
        </button>
      </div>

      {receivedShipments.length === 0 && jobs.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          <p className="font-semibold">Belum ada bahan yang bisa diproses</p>
          <p className="mt-1 text-amber-600">Pastikan ada Vendor Shipment yang sudah dikonfirmasi diterima <strong>dan</strong> diinspeksi di menu <strong>Penerimaan Material</strong>.</p>
        </div>
      )}

      {receivedShipments.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
          <p className="font-semibold">✅ {receivedShipments.length} Shipment siap dibuatkan Job Produksi</p>
          <p className="text-xs mt-0.5 text-blue-600">Qty production job = qty material yang diterima (bukan qty PO)</p>
        </div>
      )}

      <div className="space-y-3">
        {jobs.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Briefcase className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-400 font-medium">Belum ada Production Job</p>
            <p className="text-xs text-slate-400 mt-1">Konfirmasi penerimaan & inspeksi bahan, lalu buat Job Produksi</p>
          </div>
        ) : jobs.map(job => {
          const isExpanded = expandedJobs[job.id];
          const isOverdue = job.deadline && new Date(job.deadline) < new Date() && job.status !== 'Completed';
          const hasChildren = (job.child_jobs || []).length > 0;
          return (
            <div key={job.id} className={`bg-white rounded-xl border shadow-sm ${job.status === 'Completed' ? 'border-emerald-200' : 'border-slate-200'}`}>
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-slate-800 text-lg">{job.job_number}</span>
                      {hasChildren && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                          +{job.child_jobs.length} child job
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${job.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {job.status}
                      </span>
                      {isOverdue && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Overdue
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      PO: <strong>{job.po_number || '-'}</strong> • Shipment: {job.shipment_number} • Customer: {job.customer_name || '-'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Deadline: {fmtDate(job.deadline)} • {job.item_count || 0} SKU
                    </p>
                    {/* Serial Numbers */}
                    {(job.serial_numbers || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {job.serial_numbers.map(sn => (
                          <span key={sn} className="px-2 py-0.5 bg-amber-50 border border-amber-200 rounded text-xs font-mono text-amber-700 font-semibold">
                            Serial: {sn}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Progress Bar (parent + children combined) */}
                    {(job.total_available || 0) > 0 && (
                      <div className="mt-3 max-w-xs">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>Progress (incl. child jobs)</span>
                          <span>{(job.total_produced || 0).toLocaleString('id-ID')} / {(job.total_available || 0).toLocaleString('id-ID')} pcs</span>
                        </div>
                        <MiniBar pct={job.progress_pct || 0} />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button onClick={() => toggleJob(job.id)}
                      className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs hover:bg-slate-50">
                      {isExpanded ? '▲ Tutup' : '▼ Detail'}
                    </button>
                    <button onClick={() => openDetail(job)}
                      className="px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg text-xs hover:bg-blue-50">
                      Detail Lengkap
                    </button>
                  </div>
                </div>

                {/* Expandable Item Detail */}
                {isExpanded && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            {['Serial', 'SKU', 'Produk', 'Size', 'Warna', 'Qty PO', 'Diterima', 'Diproduksi', 'Sisa', 'Progress'].map(h => (
                              <th key={h} className={`text-left px-3 py-2 font-semibold ${h === 'Serial' ? 'text-amber-600' : 'text-slate-500'}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(job.child_jobs || []).length > 0 && (
                            <tr><td colSpan={10} className="px-3 py-1 bg-blue-50 text-xs text-blue-600 font-semibold">Job Utama</td></tr>
                          )}
                          {/* Note: parent job items shown in detail modal */}
                          <tr><td colSpan={10} className="px-3 py-2 text-center text-slate-400 text-xs">Klik "Detail Lengkap" untuk melihat semua item</td></tr>
                        </tbody>
                      </table>
                    </div>
                    {/* Child jobs */}
                    {(job.child_jobs || []).length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-semibold text-slate-500">Child Jobs (Auto-dibuat dari shipment tambahan):</p>
                        {job.child_jobs.map(child => (
                          <div key={child.id} className="ml-6 pl-4 border-l-2 border-purple-200 bg-purple-50/30 rounded-r-lg p-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-purple-700 text-sm">{child.job_number}</span>
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${child.shipment_type === 'ADDITIONAL' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                {child.shipment_type}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-xs ${child.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                {child.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      {showModal && (
        <Modal title="Buat Job Produksi" onClose={() => setShowModal(false)} size="lg">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              <p className="font-medium">Qty produksi = Material yang DITERIMA (bukan qty PO)</p>
              <p className="text-xs mt-1">Jika material kurang karena ada yang hilang/cacat, sistem akan membuat Child Job otomatis saat shipment tambahan diterima dan diinspeksi.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Shipment yang Diterima & Diinspeksi *</label>
              {/* Search Input */}
              <input
                type="text"
                placeholder="🔍 Cari nomor shipment, PO, atau tanggal..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-2"
                value={searchShipment}
                onChange={e => setSearchShipment(e.target.value)}
              />
              <select required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.vendor_shipment_id} onChange={e => loadShipmentPreview(e.target.value)}>
                <option value="">— Pilih Shipment ({receivedShipments.filter(s => {
                  const q = searchShipment.toLowerCase();
                  return !q || s.shipment_number?.toLowerCase().includes(q) || s.po_number?.toLowerCase().includes(q);
                }).length} tersedia) —</option>
                {/* Group: Shipment NORMAL */}
                {receivedShipments.filter(s => {
                  const q = searchShipment.toLowerCase();
                  return (!s.shipment_type || s.shipment_type === 'NORMAL') && (!q || s.shipment_number?.toLowerCase().includes(q) || s.po_number?.toLowerCase().includes(q) || fmtDate(s.shipment_date).includes(q));
                }).length > 0 && (
                  <optgroup label="── Shipment Normal ──">
                    {receivedShipments.filter(s => {
                      const q = searchShipment.toLowerCase();
                      return (!s.shipment_type || s.shipment_type === 'NORMAL') && (!q || s.shipment_number?.toLowerCase().includes(q) || s.po_number?.toLowerCase().includes(q) || fmtDate(s.shipment_date).includes(q));
                    }).map(s => (
                      <option key={s.id} value={s.id}>
                        {s.shipment_number} | PO: {s.po_number || '-'} | {fmtDate(s.shipment_date)} | {(s.items || []).length} item
                      </option>
                    ))}
                  </optgroup>
                )}
                {/* Group: Shipment ADDITIONAL */}
                {receivedShipments.filter(s => {
                  const q = searchShipment.toLowerCase();
                  return s.shipment_type === 'ADDITIONAL' && (!q || s.shipment_number?.toLowerCase().includes(q) || s.po_number?.toLowerCase().includes(q));
                }).length > 0 && (
                  <optgroup label="── Shipment Tambahan (Additional) ──">
                    {receivedShipments.filter(s => {
                      const q = searchShipment.toLowerCase();
                      return s.shipment_type === 'ADDITIONAL' && (!q || s.shipment_number?.toLowerCase().includes(q) || s.po_number?.toLowerCase().includes(q));
                    }).map(s => (
                      <option key={s.id} value={s.id}>
                        ➕ {s.shipment_number} | PO: {s.po_number || '-'} | {fmtDate(s.shipment_date)} | {(s.items || []).length} item
                      </option>
                    ))}
                  </optgroup>
                )}
                {/* Group: Shipment REPLACEMENT */}
                {receivedShipments.filter(s => {
                  const q = searchShipment.toLowerCase();
                  return s.shipment_type === 'REPLACEMENT' && (!q || s.shipment_number?.toLowerCase().includes(q) || s.po_number?.toLowerCase().includes(q));
                }).length > 0 && (
                  <optgroup label="── Shipment Pengganti (Replacement) ──">
                    {receivedShipments.filter(s => {
                      const q = searchShipment.toLowerCase();
                      return s.shipment_type === 'REPLACEMENT' && (!q || s.shipment_number?.toLowerCase().includes(q) || s.po_number?.toLowerCase().includes(q));
                    }).map(s => (
                      <option key={s.id} value={s.id}>
                        🔄 {s.shipment_number} | PO: {s.po_number || '-'} | {fmtDate(s.shipment_date)} | {(s.items || []).length} item
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {receivedShipments.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Tidak ada shipment yang siap. Konfirmasi penerimaan & inspeksi di menu Penerimaan Material.</p>
              )}
            </div>

            {selectedShipment && (
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-700">Preview: {selectedShipment.shipment_number}</p>
                <div className="space-y-2">
                  {(selectedShipment.items || []).map((item, idx) => (
                    <div key={item.id || idx} className="bg-white rounded-lg p-3 border border-slate-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{item.product_name}</p>
                          <p className="text-slate-500 font-mono text-xs mt-0.5">SKU: {item.sku || '-'} · {item.size || '-'}/{item.color || '-'}</p>
                          {item.serial_number && (
                            <p className="text-amber-700 font-mono text-xs mt-0.5 font-semibold">Serial: {item.serial_number}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-blue-700 font-bold text-sm">{(item.qty_sent || 0).toLocaleString('id-ID')} pcs</p>
                          <p className="text-slate-400 text-xs mt-0.5">🔒 Terkunci</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
                  ⚠️ Qty job = qty material diterima dari inspeksi. Vendor hanya bisa input progress.
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Catatan (opsional)</label>
              <textarea rows="2" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Catatan tambahan..." />
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={loading || !form.vendor_shipment_id}
                className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                {loading ? 'Membuat...' : 'Buat Job Produksi'}
              </button>
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-slate-200 py-2 rounded-lg text-sm hover:bg-slate-50">Batal</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Detail Modal */}
      {showDetail && detailJob && (
        <Modal title={`Detail Job: ${detailJob.job_number}`} onClose={() => setShowDetail(false)} size="xl">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { l: 'No. Job', v: <span className="font-bold text-blue-700">{detailJob.job_number}</span> },
                { l: 'Status', v: <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${detailJob.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{detailJob.status}</span> },
                { l: 'PO', v: detailJob.po_number || '-' },
                { l: 'Shipment', v: detailJob.shipment_number },
                { l: 'Customer', v: detailJob.customer_name || '-' },
                { l: 'Deadline', v: fmtDate(detailJob.deadline) },
              ].map(it => (
                <div key={it.l} className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">{it.l}</p>
                  <div className="font-medium text-sm mt-0.5">{it.v}</div>
                </div>
              ))}
            </div>
            {/* Child jobs info */}
            {(detailJob.child_jobs || []).length > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                <p className="text-sm font-semibold text-purple-700 mb-2">Child Jobs ({detailJob.child_jobs.length})</p>
                <div className="space-y-1">
                  {detailJob.child_jobs.map(c => (
                    <div key={c.id} className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-purple-600">{c.job_number}</span>
                      <span className={`px-1.5 py-0.5 rounded ${c.shipment_type === 'ADDITIONAL' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{c.shipment_type}</span>
                      <span className="text-slate-500">{c.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(detailJob.items || []).length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-700 mb-2">Item Produksi (Terkunci 🔒)</h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Serial 🏷️', 'Produk', 'SKU 🔒', 'Size 🔒', 'Warna 🔒', 'Qty PO 🔒', 'Tersedia 🔒', 'Diproduksi', 'Sisa', 'Progress'].map(h => (
                          <th key={h} className={`text-left px-3 py-2 text-xs font-semibold ${h === 'Serial 🏷️' ? 'text-amber-600' : 'text-slate-500'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detailJob.items.map(item => {
                        const avail = item.available_qty ?? item.shipment_qty ?? 0;
                        const pct = avail > 0 ? Math.round((item.produced_qty / avail) * 100) : 0;
                        return (
                          <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="px-3 py-2.5 font-mono text-xs text-amber-700 font-semibold bg-amber-50/30">{item.serial_number || <span className="text-slate-300">—</span>}</td>
                            <td className="px-3 py-2.5 font-medium">{item.product_name}</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-blue-700">{item.sku || '-'}</td>
                            <td className="px-3 py-2.5 text-xs text-center">{item.size || '-'}</td>
                            <td className="px-3 py-2.5 text-xs text-center">{item.color || '-'}</td>
                            <td className="px-3 py-2.5 text-right text-slate-500">{(item.ordered_qty || 0).toLocaleString('id-ID')}</td>
                            <td className="px-3 py-2.5 text-right font-medium text-blue-700">{avail.toLocaleString('id-ID')}</td>
                            <td className="px-3 py-2.5 text-right font-bold text-emerald-700">{(item.produced_qty || 0).toLocaleString('id-ID')}</td>
                            <td className="px-3 py-2.5 text-right text-orange-600">{Math.max(0, avail - item.produced_qty).toLocaleString('id-ID')}</td>
                            <td className="px-3 py-2.5 min-w-28"><MiniBar pct={pct} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── VENDOR PROGRESS (per SKU from Production Job) ───────────────────────────
function VendorProgress({ token, user }) {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobItems, setJobItems] = useState([]);
  const [childJobs, setChildJobs] = useState([]);
  const [selectedChildJobId, setSelectedChildJobId] = useState('');
  const [childJobItems, setChildJobItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [form, setForm] = useState({ progress_date: new Date().toISOString().split('T')[0], completed_quantity: '', notes: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = async () => {
    const res = await fetch('/api/production-jobs', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setJobs(Array.isArray(data) ? data.filter(j => j.status === 'In Progress') : []);
  };

  const loadJobItems = async (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    setSelectedJob(job || null);
    setSelectedChildJobId('');
    setChildJobItems([]);
    if (!jobId) { setJobItems([]); setChildJobs([]); return; }
    const res = await fetch(`/api/production-job-items?job_id=${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setJobItems(Array.isArray(data) ? data : []);
    setChildJobs(job?.child_jobs || []);
  };

  const loadChildJobItems = async (childJobId) => {
    setSelectedChildJobId(childJobId);
    if (!childJobId) { setChildJobItems([]); return; }
    const res = await fetch(`/api/production-job-items?job_id=${childJobId}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setChildJobItems(Array.isArray(data) ? data : []);
  };

  const openProgress = (item) => {
    setSelectedItem(item);
    setForm({ progress_date: new Date().toISOString().split('T')[0], completed_quantity: '', notes: '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    setLoading(true);
    const res = await fetch('/api/production-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        job_item_id: selectedItem.id,
        progress_date: form.progress_date,
        completed_quantity: Number(form.completed_quantity),
        notes: form.notes
      })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { alert(data.error || 'Gagal menyimpan progress'); return; }
    setShowModal(false);
    loadJobItems(selectedJob?.id);
    if (selectedChildJobId) loadChildJobItems(selectedChildJobId);
    fetchJobs();
  };

  const renderJobItemsTable = (items, isChild = false) => {
    if (!items.length) return <p className="text-sm text-slate-400 px-4 py-3">Tidak ada item</p>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-2.5 text-xs text-amber-600 font-semibold">Serial 🏷️</th>
              <th className="text-left px-4 py-2.5 text-xs text-slate-500">Produk</th>
              <th className="text-left px-4 py-2.5 text-xs text-slate-500">SKU 🔒</th>
              <th className="text-left px-4 py-2.5 text-xs text-slate-500">Size</th>
              <th className="text-left px-4 py-2.5 text-xs text-slate-500">Warna</th>
              <th className="text-right px-4 py-2.5 text-xs text-slate-500">Tersedia 🔒</th>
              <th className="text-right px-4 py-2.5 text-xs text-slate-500">Diproduksi</th>
              <th className="text-right px-4 py-2.5 text-xs text-slate-500">Sisa</th>
              <th className="px-4 py-2.5 text-xs text-slate-500">Progress</th>
              <th className="px-4 py-2.5 text-xs text-slate-500">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {items.map(item => {
              const avail = item.available_qty ?? item.shipment_qty ?? 0;
              const pct = avail > 0 ? Math.round((item.produced_qty / avail) * 100) : 0;
              const sisa = Math.max(0, avail - item.produced_qty);
              const isDone = item.produced_qty >= avail && avail > 0;
              return (
                <tr key={item.id} className={`hover:bg-slate-50 ${isDone ? 'bg-emerald-50/30' : ''} ${isChild ? 'bg-purple-50/20' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs text-amber-700 font-semibold">{item.serial_number || <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{item.product_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-700 bg-blue-50/20">{item.sku || '-'}</td>
                  <td className="px-4 py-3 text-xs text-center">{item.size || '-'}</td>
                  <td className="px-4 py-3 text-xs text-center">{item.color || '-'}</td>
                  <td className="px-4 py-3 text-right font-medium text-blue-700">{avail.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700">{(item.produced_qty || 0).toLocaleString('id-ID')}</td>
                  <td className={`px-4 py-3 text-right font-medium ${sisa === 0 ? 'text-emerald-600' : 'text-orange-600'}`}>{sisa.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 min-w-32"><MiniBar pct={pct} /></td>
                  <td className="px-4 py-3">
                    {isDone ? (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">✅ Selesai</span>
                    ) : (
                      <button onClick={() => openProgress(item)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700">
                        <Plus className="w-3 h-3" /> Input
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Progress Produksi</h1>
        <p className="text-slate-500 text-sm mt-1">Input progress harian per SKU. Pilih Job Produksi, lalu update qty per SKU.</p>
      </div>

      {/* Job selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <label className="block text-sm font-semibold text-slate-700 mb-2">Pilih Job Produksi (Parent)</label>
        {jobs.length === 0 ? (
          <p className="text-sm text-slate-400">Tidak ada Job Produksi yang aktif. Buat Job Produksi di menu Pekerjaan Produksi.</p>
        ) : (
          <select
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={selectedJob?.id || ''}
            onChange={e => loadJobItems(e.target.value)}
          >
            <option value="">— Pilih Job Produksi —</option>
            {jobs.map(j => (
              <option key={j.id} value={j.id}>
                {j.job_number} — PO: {j.po_number || '-'} ({j.progress_pct || 0}% selesai){j.child_job_count > 0 ? ` • +${j.child_job_count} child` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedJob && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-emerald-700">{selectedJob.job_number} — PO: {selectedJob.po_number || '-'}</span>
            <span className="text-xs text-emerald-600">Shipment: {selectedJob.shipment_number}</span>
          </div>
          {(selectedJob.serial_numbers || []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedJob.serial_numbers.map(sn => (
                <span key={sn} className="px-1.5 py-0.5 bg-amber-100 border border-amber-300 rounded text-xs font-mono text-amber-700">Serial: {sn}</span>
              ))}
            </div>
          )}
          <MiniBar pct={selectedJob.progress_pct || 0} />
          <p className="text-xs text-emerald-600 mt-1">
            Total tersedia: {(selectedJob.total_available || 0).toLocaleString('id-ID')} pcs • 
            Diproduksi: {(selectedJob.total_produced || 0).toLocaleString('id-ID')} pcs
          </p>
        </div>
      )}

      {/* PARENT JOB ITEMS */}
      {jobItems.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <h3 className="font-semibold text-slate-700 text-sm">Item Produksi — Job Utama ({selectedJob?.job_number})</h3>
          </div>
          {renderJobItemsTable(jobItems, false)}
        </div>
      )}

      {/* CHILD JOBS */}
      {childJobs.length > 0 && (
        <div className="space-y-3">
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-purple-700 mb-2">Child Jobs — Shipment Tambahan/Pengganti</p>
            <div className="flex gap-2 flex-wrap">
              {childJobs.map(child => (
                <button key={child.id}
                  onClick={() => loadChildJobItems(selectedChildJobId === child.id ? '' : child.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${selectedChildJobId === child.id ? 'bg-purple-600 text-white border-purple-600' : 'border-purple-300 text-purple-700 hover:bg-purple-100'}`}>
                  {child.job_number} ({child.shipment_type})
                </button>
              ))}
            </div>
          </div>
          {childJobItems.length > 0 && (
            <div className="bg-white rounded-xl border border-purple-200 shadow-sm overflow-hidden ml-6">
              <div className="px-4 py-3 border-b border-purple-100 bg-purple-50 flex items-center gap-2">
                <h3 className="font-semibold text-purple-700 text-sm">
                  Child Job: {childJobs.find(c => c.id === selectedChildJobId)?.job_number}
                </h3>
                <span className="px-2 py-0.5 bg-purple-100 text-purple-600 rounded text-xs">
                  {childJobs.find(c => c.id === selectedChildJobId)?.shipment_type}
                </span>
              </div>
              {renderJobItemsTable(childJobItems, true)}
            </div>
          )}
        </div>
      )}

      {/* Progress Input Modal */}
      {showModal && selectedItem && (
        <Modal title={`Input Progress: ${selectedItem.sku || selectedItem.product_name}`} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Locked info */}
            <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Info Item (Terkunci 🔒)</p>
              {[
                ['Serial / Batch', selectedItem.serial_number || '-'],
                ['Produk', selectedItem.product_name],
                ['SKU', selectedItem.sku || '-'],
                ['Size', selectedItem.size || '-'],
                ['Warna', selectedItem.color || '-'],
                ['Material Tersedia', `${selectedItem.available_qty ?? selectedItem.shipment_qty ?? 0} pcs`],
                ['Sudah Diproduksi', `${selectedItem.produced_qty} pcs`],
                ['Sisa (Maks Input)', `${Math.max(0, (selectedItem.available_qty ?? selectedItem.shipment_qty ?? 0) - selectedItem.produced_qty)} pcs`],
              ].map(([l, v]) => (
                <div key={l} className={`flex justify-between text-sm ${l === 'Serial / Batch' ? 'text-amber-700 font-medium' : ''}`}>
                  <span className="text-slate-500">{l}</span>
                  <span className={`font-semibold ${l === 'Sisa (Maks Input)' ? 'text-orange-600' : 'text-slate-800'}`}>{v}</span>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Progress *</label>
              <input required type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.progress_date} onChange={e => setForm(f => ({ ...f, progress_date: e.target.value }))} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Jumlah Selesai Hari Ini (pcs) * <span className="text-xs text-slate-400">maks: {Math.max(0, (selectedItem.available_qty ?? selectedItem.shipment_qty ?? 0) - selectedItem.produced_qty)} pcs</span>
              </label>
              <input required type="number" min="1" max={Math.max(0, (selectedItem.available_qty ?? selectedItem.shipment_qty ?? 0) - selectedItem.produced_qty)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-right"
                value={form.completed_quantity}
                onChange={e => setForm(f => ({ ...f, completed_quantity: e.target.value }))}
                placeholder={`0 – ${Math.max(0, (selectedItem.available_qty ?? selectedItem.shipment_qty ?? 0) - selectedItem.produced_qty)}`} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
              <textarea rows="2" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Catatan produksi..." />
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={loading}
                className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                {loading ? 'Menyimpan...' : 'Simpan Progress'}
              </button>
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-slate-200 py-2 rounded-lg text-sm hover:bg-slate-50">Batal</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── VENDOR BUYER SHIPMENTS (cumulative dispatches per job) ───────────────────
function VendorBuyerShipments({ token, user }) {
  const [shipments, setShipments] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [jobItems, setJobItems] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [expandedShipment, setExpandedShipment] = useState(null);
  const [dispatches, setDispatches] = useState({});
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ job_id: '', shipment_date: new Date().toISOString().split('T')[0], notes: '', items: [] });
  const [searchJob, setSearchJob] = useState('');
  const [showAllJobs, setShowAllJobs] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [sRes, jRes] = await Promise.all([
      fetch('/api/buyer-shipments', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/production-jobs', { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const [sData, jData] = await Promise.all([sRes.json(), jRes.json()]);
    setShipments(Array.isArray(sData) ? sData : []);
    setJobs(Array.isArray(jData) ? jData : []);
  };

  const loadJobItems = async (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    setSelectedJob(job || null);
    setForm(f => ({ ...f, job_id: jobId, items: [] }));
    if (!jobId) { setJobItems([]); return; }
    const res = await fetch(`/api/production-job-items?job_id=${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const items = Array.isArray(data) ? data : [];
    setJobItems(items);
    setForm(f => ({
      ...f,
      po_id: job?.po_id || '',
      items: items.map(i => ({
        job_item_id: i.id,
        po_item_id: i.po_item_id || null,
        product_name: i.product_name,
        sku: i.sku,
        size: i.size,
        color: i.color,
        serial_number: i.serial_number || '',
        ordered_qty: i.ordered_qty,
        produced_qty: i.total_produced_qty ?? i.produced_qty,  // parent + child
        shipped_to_buyer: i.shipped_to_buyer || 0,
        remaining_to_ship: i.remaining_to_ship || 0,  // total_produced - shipped (includes child)
        qty_shipped: 0,
      }))
    }));
  };

  const updateQty = (idx, val) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], qty_shipped: val };
    setForm(f => ({ ...f, items }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.job_id) { alert('Pilih Production Job terlebih dahulu'); return; }
    const validItems = form.items.filter(i => Number(i.qty_shipped) > 0);
    if (validItems.length === 0) { alert('Isi minimal 1 item dengan qty > 0'); return; }

    // Check: qty to ship now <= remaining_to_ship
    for (const item of validItems) {
      if (Number(item.qty_shipped) > Number(item.remaining_to_ship)) {
        alert(`Qty kirim ${item.sku} (${item.qty_shipped}) melebihi sisa yang bisa dikirim (${item.remaining_to_ship} pcs).`);
        return;
      }
    }

    // Check if master shipment already exists for this job
    const existingShipment = shipments.find(s => s.job_id === form.job_id);
    const shipmentNumber = existingShipment ? existingShipment.shipment_number : `SJ-${form.job_id.slice(-6).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    setLoading(true);
    const res = await fetch('/api/buyer-shipments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        shipment_number: shipmentNumber,
        job_id: form.job_id,
        po_id: form.po_id || selectedJob?.po_id,
        shipment_date: form.shipment_date,
        notes: form.notes,
        vendor_id: user.vendor_id,
        items: validItems.map(i => ({ ...i, qty_shipped: Number(i.qty_shipped) }))
      })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { alert(data.error || 'Gagal membuat pengiriman'); return; }
    setShowModal(false);
    fetchAll();
  };

  const loadDispatches = async (shipmentId) => {
    if (expandedShipment === shipmentId) { setExpandedShipment(null); return; }
    setExpandedShipment(shipmentId);
    if (!dispatches[shipmentId]) {
      const res = await fetch(`/api/buyer-shipment-dispatches?shipment_id=${shipmentId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setDispatches(prev => ({ ...prev, [shipmentId]: Array.isArray(data) ? data : [] }));
    }
  };

  const openDispatch = (shipment) => {
    // Open modal pre-selected with this job
    const job = jobs.find(j => j.id === shipment.job_id);
    setSelectedJob(job || null);
    setForm({ job_id: shipment.job_id || '', shipment_date: new Date().toISOString().split('T')[0], notes: '', items: [], po_id: shipment.po_id || '' });
    setJobItems([]);
    if (shipment.job_id) loadJobItems(shipment.job_id);
    setShowModal(true);
  };

  const downloadPDF = async (shipment, dispatchData) => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF();
      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text('SURAT JALAN / DELIVERY NOTE', 105, 20, { align: 'center' });
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(`No. SJ: ${shipment.shipment_number}`, 14, 36);
      doc.text(`Status: ${shipment.ship_status || 'Pending'}`, 14, 43);
      doc.text(`Vendor: ${shipment.vendor_name}`, 14, 50);
      doc.text(`PO: ${shipment.po_number || '-'} | Customer: ${shipment.customer_name || '-'}`, 14, 57);

      const allItems = (dispatches[shipment.id] || []).flatMap(d => d.items || []);
      autoTable(doc, {
        startY: 65,
        head: [['No', 'Produk', 'SKU', 'Size', 'Warna', 'Dispatch', 'Dikirim']],
        body: allItems.map((it, i) => [i + 1, it.product_name, it.sku || '-', it.size || '-', it.color || '-', `#${it.dispatch_seq || 1}`, it.qty_shipped]),
        foot: [['', '', '', '', '', 'Total', allItems.reduce((s, i) => s + (i.qty_shipped || 0), 0)]],
        styles: { fontSize: 9 }, headStyles: { fillColor: [16, 185, 129] }, footStyles: { fontStyle: 'bold' }
      });
      doc.save(`SJ-${shipment.shipment_number}.pdf`);
    } catch (err) { alert('Gagal generate PDF: ' + err.message); }
  };

  const fmtDate = d => d ? new Date(d).toLocaleDateString('id-ID') : '-';
  const getStatusColor = (s) => {
    if (s === 'Fully Shipped') return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    if (s === 'Partially Shipped') return 'bg-amber-100 text-amber-700 border border-amber-200';
    return 'bg-slate-100 text-slate-600';
  };

  // Compute remaining_to_ship for modal items
  const canAddDispatch = (job) => {
    if (!job) return false;
    return job.status === 'In Progress' || job.total_produced > 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pengiriman ke Buyer</h1>
          <p className="text-slate-500 text-sm mt-1">Kirim produk jadi ke buyer secara bertahap. Setiap dispatch ditambahkan ke record pengiriman yang sama.</p>
        </div>
        <button onClick={() => { setForm({ job_id: '', shipment_date: new Date().toISOString().split('T')[0], notes: '', items: [] }); setSelectedJob(null); setJobItems([]); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Buat Pengiriman
        </button>
      </div>

      <div className="space-y-4">
        {shipments.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Send className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-400">Belum ada data pengiriman</p>
          </div>
        ) : shipments.map(s => {
          // Use backend-calculated fixed totals
          const totalOrdered = s.total_ordered || 0;
          const totalShipped = s.total_shipped || 0;
          const remaining = s.remaining || Math.max(0, totalOrdered - totalShipped);
          const progressPct = s.progress_pct || (totalOrdered > 0 ? Math.round((totalShipped / totalOrdered) * 100) : 0);
          const isExpanded = expandedShipment === s.id;
          const jobForShipment = jobs.find(j => j.id === s.job_id);
          const dispatchCount = s.dispatch_count || s.last_dispatch_seq || 0;

          return (
            <div key={s.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-slate-800">{s.shipment_number}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(progressPct >= 100 ? 'Fully Shipped' : progressPct > 0 ? 'Partially Shipped' : 'Pending')}`}>
                        {progressPct >= 100 ? 'Fully Shipped' : progressPct > 0 ? 'Partially Shipped' : 'Pending'}
                      </span>
                      {dispatchCount > 0 && <span className="text-xs text-slate-400">{dispatchCount} dispatch</span>}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">PO: {s.po_number || '-'} • {s.customer_name || '-'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Job: {jobForShipment?.job_number || s.job_id || '-'}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    {/* Add dispatch button — only if not fully shipped */}
                    {progressPct < 100 && (
                      <button onClick={() => openDispatch(s)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm hover:bg-emerald-100 border border-emerald-200">
                        <Plus className="w-3.5 h-3.5" /> Dispatch
                      </button>
                    )}
                    <button onClick={() => { loadDispatches(s.id); downloadPDF(s, dispatches[s.id]); }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 text-slate-700 rounded-lg text-sm hover:bg-slate-100">
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                    <button onClick={() => loadDispatches(s.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />} Riwayat
                    </button>
                  </div>
                </div>

                {/* Progress bar with FIXED ordered qty */}
                <div className="mt-3 bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-bold text-slate-700">{totalShipped.toLocaleString('id-ID')} / {totalOrdered.toLocaleString('id-ID')} pcs</span>
                    <span className={`font-bold ${progressPct >= 100 ? 'text-emerald-700' : 'text-blue-700'}`}>{progressPct}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${progressPct >= 100 ? 'bg-emerald-500' : progressPct > 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                      style={{ width: `${Math.min(progressPct, 100)}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                    <span>Sisa: {remaining.toLocaleString('id-ID')} pcs</span>
                    <span>Ordered (PO): {totalOrdered.toLocaleString('id-ID')} pcs</span>
                  </div>
                </div>
              </div>

              {/* Dispatch history */}
              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50">
                  <p className="px-5 pt-3 text-xs font-semibold text-slate-500 uppercase">Riwayat Dispatch</p>
                  {(dispatches[s.id] || []).length === 0 ? (
                    <p className="px-5 py-3 text-sm text-slate-400">Memuat riwayat...</p>
                  ) : (() => {
                    let cumulative = 0;
                    return (dispatches[s.id] || []).map(d => {
                      cumulative += d.total_qty || 0;
                      const dispatchRemaining = Math.max(0, totalOrdered - cumulative);
                      return (
                        <div key={d.dispatch_seq} className="px-5 py-3 border-b border-slate-100 last:border-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">{d.dispatch_seq}</span>
                              <span className="text-xs font-bold text-slate-700">Dispatch #{d.dispatch_seq}</span>
                              <span className="text-xs text-slate-400">{fmtDate(d.dispatch_date)}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-emerald-700 font-bold">+{(d.total_qty || 0).toLocaleString('id-ID')} pcs</span>
                              <span className="text-blue-700">Kumulatif: {cumulative.toLocaleString('id-ID')}/{totalOrdered.toLocaleString('id-ID')}</span>
                              <span className="text-slate-400">Sisa: {dispatchRemaining.toLocaleString('id-ID')}</span>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-4 gap-1.5">
                            {(d.items || []).map(it => (
                              <div key={it.id} className="bg-white rounded px-2 py-1.5 text-xs border border-slate-100">
                                <p className="font-mono text-amber-700 font-semibold">{it.serial_number || '—'}</p>
                                <p className="font-mono text-blue-600">{it.sku || '-'}</p>
                                <p className="font-bold">{(it.qty_shipped || 0).toLocaleString('id-ID')} pcs</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create/Add Dispatch Modal */}
      {showModal && (
        <Modal title={form.job_id && shipments.find(s => s.job_id === form.job_id) ? "Tambah Dispatch Pengiriman" : "Buat Pengiriman ke Buyer"} onClose={() => setShowModal(false)} size="xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Show info if this is a continuation */}
            {form.job_id && shipments.find(s => s.job_id === form.job_id) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                📦 <strong>Pengiriman Lanjutan</strong>: Dispatch baru akan ditambahkan ke record pengiriman yang sudah ada untuk job ini.
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Job Produksi *</label>
                {/* Search */}
                <input
                  type="text"
                  placeholder="🔍 Cari nomor job atau PO..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-2"
                  value={searchJob}
                  onChange={e => setSearchJob(e.target.value)}
                />
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={form.job_id} onChange={e => { setSearchJob(''); loadJobItems(e.target.value); }}>
                  <option value="">— Pilih Job Produksi —</option>
                  {/* Jobs with available qty to ship — shown by default */}
                  {(() => {
                    const q = searchJob.toLowerCase();
                    // Fully shipped jobs = jobs with buyer_shipment ship_status = 'Fully Shipped'
                    const fullyShippedJobIds = new Set(shipments.filter(s => s.ship_status === 'Fully Shipped').map(s => s.job_id));
                    const available = jobs.filter(j => {
                      const hasAvail = !fullyShippedJobIds.has(j.id) && (j.total_produced || 0) > 0;
                      const matchSearch = !q || j.job_number?.toLowerCase().includes(q) || j.po_number?.toLowerCase().includes(q);
                      return hasAvail && matchSearch;
                    });
                    const notStarted = jobs.filter(j => {
                      const noProduced = (j.total_produced || 0) === 0;
                      const matchSearch = !q || j.job_number?.toLowerCase().includes(q) || j.po_number?.toLowerCase().includes(q);
                      return noProduced && matchSearch && (showAllJobs || q);
                    });
                    const completed = jobs.filter(j => {
                      const fullyShipped = fullyShippedJobIds.has(j.id);
                      const matchSearch = !q || j.job_number?.toLowerCase().includes(q) || j.po_number?.toLowerCase().includes(q);
                      return fullyShipped && matchSearch && (showAllJobs || q);
                    });
                    return (
                      <>
                        {available.length > 0 && (
                          <optgroup label={`✅ Ada Sisa Kirim (${available.length})`}>
                            {available.map(j => {
                              const existShipment = shipments.find(s => s.job_id === j.id);
                              const label = existShipment ? `${j.job_number} | PO: ${j.po_number || '-'} | ${j.progress_pct || 0}% prod. | Lanjut kirim` : `${j.job_number} | PO: ${j.po_number || '-'} | ${j.progress_pct || 0}% prod. | Belum dikirim`;
                              return <option key={j.id} value={j.id}>{label}</option>;
                            })}
                          </optgroup>
                        )}
                        {notStarted.length > 0 && (
                          <optgroup label={`⏳ Belum Ada Produksi (${notStarted.length})`}>
                            {notStarted.map(j => <option key={j.id} value={j.id}>{j.job_number} | PO: {j.po_number || '-'} | 0% prod.</option>)}
                          </optgroup>
                        )}
                        {completed.length > 0 && (
                          <optgroup label={`🏁 Sudah Fully Shipped (${completed.length})`}>
                            {completed.map(j => <option key={j.id} value={j.id}>{j.job_number} | PO: {j.po_number || '-'} | Selesai</option>)}
                          </optgroup>
                        )}
                        {available.length === 0 && notStarted.length === 0 && completed.length === 0 && q && (
                          <option disabled>Tidak ditemukan: "{searchJob}"</option>
                        )}
                      </>
                    );
                  })()}
                </select>
                {/* Toggle show all */}
                <button type="button" className="text-xs text-blue-600 hover:underline mt-1" onClick={() => setShowAllJobs(v => !v)}>
                  {showAllJobs ? '▲ Sembunyikan job selesai/belum mulai' : '▼ Tampilkan semua job'}
                </button>
                {jobs.length === 0 && <p className="text-xs text-amber-600 mt-1">Belum ada Production Job.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Dispatch</label>
                <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={form.shipment_date} onChange={e => setForm(f => ({ ...f, shipment_date: e.target.value }))} />
              </div>
            </div>

            {selectedJob && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm">
                <p className="font-semibold text-blue-700">{selectedJob.job_number} — {selectedJob.po_number}</p>
                <p className="text-xs text-blue-500 mt-0.5">Qty kirim tidak boleh melebihi sisa yang belum dikirim</p>
              </div>
            )}

            {form.items.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Item Pengiriman</label>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs text-amber-600">Serial</th>
                        <th className="text-left px-3 py-2 text-xs text-slate-500">Produk / SKU</th>
                        <th className="text-right px-3 py-2 text-xs text-slate-500">Dipesan</th>
                        <th className="text-right px-3 py-2 text-xs text-emerald-600">Diproduksi</th>
                        <th className="text-right px-3 py-2 text-xs text-slate-500 bg-amber-50">Sudah Dikirim</th>
                        <th className="text-right px-3 py-2 text-xs text-slate-500 bg-emerald-50">Sisa Kirim</th>
                        <th className="text-right px-3 py-2 text-xs text-slate-700 font-bold">Kirim Sekarang *</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((item, idx) => (
                        <tr key={idx} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-mono text-xs text-amber-700 font-semibold">{item.serial_number || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2">
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-xs font-mono text-blue-600">{item.sku || '-'} · {item.size}/{item.color}</p>
                          </td>
                          <td className="px-3 py-2 text-right text-slate-500">{(item.ordered_qty || 0).toLocaleString('id-ID')}</td>
                          <td className="px-3 py-2 text-right text-emerald-700 font-medium">
                            {(item.produced_qty || 0).toLocaleString('id-ID')}
                            {item.child_produced_qty > 0 && (
                              <span className="block text-xs text-purple-600">+{item.child_produced_qty} child</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-amber-700 bg-amber-50">{(item.shipped_to_buyer || 0).toLocaleString('id-ID')}</td>
                          <td className="px-3 py-2 text-right text-emerald-700 font-bold bg-emerald-50">{(item.remaining_to_ship || 0).toLocaleString('id-ID')}</td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" max={item.remaining_to_ship}
                              className={`w-24 border rounded px-2 py-1 text-sm text-right ml-auto block focus:outline-none focus:ring-1 ${Number(item.qty_shipped) > Number(item.remaining_to_ship) ? 'border-red-400 text-red-600' : 'border-slate-200 focus:ring-emerald-500'}`}
                              value={item.qty_shipped}
                              onChange={e => updateQty(idx, e.target.value)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                      <tr>
                        <td colSpan={2} className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-right">{form.items.reduce((s, i) => s + (Number(i.ordered_qty) || 0), 0).toLocaleString('id-ID')}</td>
                        <td className="px-3 py-2 text-right text-emerald-700">{form.items.reduce((s, i) => s + (Number(i.produced_qty) || 0), 0).toLocaleString('id-ID')}</td>
                        <td className="px-3 py-2 text-right text-amber-700 bg-amber-50">{form.items.reduce((s, i) => s + (Number(i.shipped_to_buyer) || 0), 0).toLocaleString('id-ID')}</td>
                        <td className="px-3 py-2 text-right text-emerald-700 bg-emerald-50">{form.items.reduce((s, i) => s + (Number(i.remaining_to_ship) || 0), 0).toLocaleString('id-ID')}</td>
                        <td className="px-3 py-2 text-right text-blue-700">{form.items.reduce((s, i) => s + (Number(i.qty_shipped) || 0), 0).toLocaleString('id-ID')} pcs</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
              <textarea rows="2" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={loading}
                className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                {loading ? 'Menyimpan...' : 'Kirim'}
              </button>
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-slate-200 py-2 rounded-lg text-sm hover:bg-slate-50">Batal</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}


// ─── VENDOR MATERIAL INSPECTION ───────────────────────────────────────────────
function VendorMaterialInspection({ token, user }) {
  const [shipments, setShipments] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ inspection_date: new Date().toISOString().split('T')[0], overall_notes: '', items: [] });

  useEffect(() => { fetchShipments(); fetchInspections(); }, []);

  const fetchShipments = async () => {
    const res = await fetch('/api/vendor-shipments', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    // Only received shipments that haven't been inspected
    const received = Array.isArray(data) ? data.filter(s => s.status === 'Received') : [];
    setShipments(received);
  };

  const fetchInspections = async () => {
    const res = await fetch('/api/vendor-material-inspections', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setInspections(Array.isArray(data) ? data : []);
  };

  const openInspect = async (shipment) => {
    setSelectedShipment(shipment);
    // Load shipment items
    const res = await fetch(`/api/vendor-shipments/${shipment.id}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const items = (data.items || []).map(si => ({
      shipment_item_id: si.id,
      sku: si.sku || '',
      product_name: si.product_name || '',
      size: si.size || '',
      color: si.color || '',
      ordered_qty: si.qty_sent || 0,
      received_qty: si.qty_sent || 0, // default to all received
      missing_qty: 0,
      condition_notes: ''
    }));
    setForm({ inspection_date: new Date().toISOString().split('T')[0], overall_notes: '', items });
    setShowModal(true);
  };

  const updateItem = (idx, field, value) => {
    const newItems = [...form.items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    // Auto-calc missing_qty = ordered_qty - received_qty
    if (field === 'received_qty') {
      newItems[idx].missing_qty = Math.max(0, (newItems[idx].ordered_qty || 0) - (Number(value) || 0));
    }
    setForm(f => ({ ...f, items: newItems }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/vendor-material-inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shipment_id: selectedShipment.id, ...form })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Gagal menyimpan inspeksi'); return; }
      setShowModal(false);
      fetchShipments();
      fetchInspections();

      // If there are missing items, auto-prompt to create Additional Request
      const totalMissing = form.items.reduce((s, i) => s + (i.missing_qty || 0), 0);
      if (totalMissing > 0) {
        const confirm = window.confirm(`Inspeksi berhasil disimpan!\n\nTerdeteksi ${totalMissing} pcs material MISSING.\nApakah Anda ingin langsung mengajukan Permintaan Material Tambahan kepada ERP?`);
        if (confirm) {
          const missingItems = form.items.filter(i => (i.missing_qty || 0) > 0).map(i => ({
            sku: i.sku, product_name: i.product_name, size: i.size, color: i.color,
            serial_number: i.serial_number || '',
            requested_qty: i.missing_qty, reason: `Missing dari inspeksi shipment ${selectedShipment.shipment_number}`
          }));
          const reqRes = await fetch('/api/material-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              request_type: 'ADDITIONAL',
              original_shipment_id: selectedShipment.id,
              inspection_id: data.id,
              po_id: missingItems[0]?.po_id || '',
              reason: `Material missing setelah inspeksi shipment ${selectedShipment.shipment_number}`,
              items: missingItems
            })
          });
          const reqData = await reqRes.json();
          if (reqRes.ok) {
            alert(`✅ Permintaan Tambahan ${reqData.request_number} berhasil diajukan ke ERP untuk review.`);
          }
        }
      } else {
        alert('✅ Inspeksi berhasil disimpan! Semua material lengkap, Anda dapat memulai produksi.');
      }
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (insp) => {
    setDetailData(insp);
    setShowDetail(true);
  };

  const fmtDate = d => d ? new Date(d).toLocaleDateString('id-ID') : '-';

  // Check if inspection is overdue (>3 days from shipment received)
  const isOverdue = (shipment) => {
    if (!shipment.updated_at) return false;
    const receivedDate = new Date(shipment.updated_at);
    const threeDaysLater = new Date(receivedDate.getTime() + 3 * 24 * 60 * 60 * 1000);
    return new Date() > threeDaysLater;
  };

  // Already inspected shipment IDs
  const inspectedShipmentIds = new Set(inspections.map(i => i.shipment_id));

  const pendingShipments = shipments.filter(s => !inspectedShipmentIds.has(s.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-emerald-600" />
          Inspeksi Material
        </h1>
        <p className="text-slate-500 text-sm mt-1">Laporkan hasil inspeksi material yang diterima (wajib dalam 3 hari)</p>
      </div>

      {pendingShipments.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
          <p className="text-amber-800 font-semibold text-sm mb-2">⏰ Shipment Menunggu Inspeksi ({pendingShipments.length})</p>
          <div className="space-y-2">
            {pendingShipments.map(s => {
              const overdue = isOverdue(s);
              return (
                <div key={s.id} className={`flex items-center justify-between p-3 rounded-lg border ${overdue ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                  <div>
                    <p className={`font-semibold text-sm ${overdue ? 'text-red-700' : 'text-slate-800'}`}>
                      {s.shipment_number} {overdue && '⚠️ TERLAMBAT'}
                    </p>
                    <p className="text-xs text-slate-500">Diterima: {fmtDate(s.updated_at)} • Tipe: {s.shipment_type || 'NORMAL'}</p>
                  </div>
                  <button onClick={() => openInspect(s)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700">
                    Inspeksi Sekarang
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Inspection History */}
      <div>
        <h3 className="font-semibold text-slate-700 mb-3">Riwayat Inspeksi ({inspections.length})</h3>
        {inspections.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">Belum ada inspeksi yang dilakukan</div>
        ) : (
          <div className="space-y-2">
            {inspections.map(insp => (
              <div key={insp.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-slate-800">{insp.shipment_number}</p>
                  <p className="text-xs text-slate-500">
                    Inspeksi: {fmtDate(insp.inspection_date)} •
                    Diterima: <span className="text-emerald-700 font-medium">{insp.total_received}</span> pcs •
                    Missing: <span className={`font-medium ${insp.total_missing > 0 ? 'text-red-600' : 'text-slate-500'}`}>{insp.total_missing}</span> pcs
                  </p>
                </div>
                <button onClick={() => openDetail(insp)} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200">
                  Lihat Detail
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inspection Form Modal */}
      {showModal && selectedShipment && (
        <Modal title={`Inspeksi: ${selectedShipment.shipment_number}`} onClose={() => setShowModal(false)} size="xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
              Periksa setiap item material yang diterima. Isi jumlah yang benar-benar diterima dan jumlah yang missing/kurang.
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Inspeksi</label>
              <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.inspection_date} onChange={e => setForm(f => ({ ...f, inspection_date: e.target.value }))} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left px-3 py-2 text-xs">Produk / SKU</th>
                    <th className="text-right px-3 py-2 text-xs">Dikirim</th>
                    <th className="text-right px-3 py-2 text-xs text-emerald-700">Diterima *</th>
                    <th className="text-right px-3 py-2 text-xs text-red-600">Missing</th>
                    <th className="text-left px-3 py-2 text-xs">Kondisi / Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, idx) => (
                    <tr key={idx} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <p className="font-medium text-xs">{item.product_name}</p>
                        <p className="text-xs text-slate-400 font-mono">{item.sku} {item.size}/{item.color}</p>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600 font-medium">{item.ordered_qty}</td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" min="0" max={item.ordered_qty}
                          className="w-20 border border-emerald-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          value={item.received_qty}
                          onChange={e => updateItem(idx, 'received_qty', e.target.value)} />
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${item.missing_qty > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {item.missing_qty}
                      </td>
                      <td className="px-3 py-2">
                        <input className="w-full border border-slate-200 rounded px-2 py-1 text-xs" value={item.condition_notes} onChange={e => updateItem(idx, 'condition_notes', e.target.value)} placeholder="Kondisi barang..." />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200">
                  <tr>
                    <td className="px-3 py-2 text-sm">Total</td>
                    <td className="px-3 py-2 text-right">{form.items.reduce((s, i) => s + (i.ordered_qty || 0), 0)}</td>
                    <td className="px-3 py-2 text-right text-emerald-700">{form.items.reduce((s, i) => s + (Number(i.received_qty) || 0), 0)}</td>
                    <td className="px-3 py-2 text-right text-red-600">{form.items.reduce((s, i) => s + (i.missing_qty || 0), 0)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Catatan Umum</label>
              <textarea rows="2" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.overall_notes} onChange={e => setForm(f => ({ ...f, overall_notes: e.target.value }))} placeholder="Catatan kondisi material secara umum..." />
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={loading} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                {loading ? 'Menyimpan...' : 'Kirim Laporan Inspeksi'}
              </button>
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-slate-200 py-2 rounded-lg text-sm hover:bg-slate-50">Batal</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Detail Modal */}
      {showDetail && detailData && (
        <Modal title={`Detail Inspeksi: ${detailData.shipment_number}`} onClose={() => setShowDetail(false)} size="xl">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <p className="text-xs text-emerald-600">Total Diterima</p>
                <p className="text-2xl font-bold text-emerald-700">{detailData.total_received}</p>
              </div>
              <div className={`rounded-lg p-3 text-center ${detailData.total_missing > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                <p className={`text-xs ${detailData.total_missing > 0 ? 'text-red-600' : 'text-slate-500'}`}>Total Missing</p>
                <p className={`text-2xl font-bold ${detailData.total_missing > 0 ? 'text-red-700' : 'text-slate-500'}`}>{detailData.total_missing}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500">Tanggal Inspeksi</p>
                <p className="text-sm font-bold text-slate-700">{fmtDate(detailData.inspection_date)}</p>
              </div>
            </div>
            {detailData.overall_notes && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <strong>Catatan:</strong> {detailData.overall_notes}
              </div>
            )}
            {detailData.items?.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="text-left px-3 py-2 text-xs">Produk / SKU</th>
                      <th className="text-right px-3 py-2 text-xs">Dikirim</th>
                      <th className="text-right px-3 py-2 text-xs text-emerald-700">Diterima</th>
                      <th className="text-right px-3 py-2 text-xs text-red-600">Missing</th>
                      <th className="text-left px-3 py-2 text-xs">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailData.items.map(item => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <p className="font-medium text-xs">{item.product_name}</p>
                          <p className="text-xs text-slate-400 font-mono">{item.sku} {item.size}/{item.color}</p>
                        </td>
                        <td className="px-3 py-2 text-right">{item.ordered_qty}</td>
                        <td className="px-3 py-2 text-right text-emerald-700 font-medium">{item.received_qty}</td>
                        <td className={`px-3 py-2 text-right font-medium ${item.missing_qty > 0 ? 'text-red-600' : 'text-slate-400'}`}>{item.missing_qty}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{item.condition_notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── VENDOR DEFECT REPORTS ─────────────────────────────────────────────────────
function VendorDefectReports({ token, user }) {
  const [reports, setReports] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [jobItems, setJobItems] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    job_id: '', job_item_id: '', sku: '', product_name: '', size: '', color: '',
    defect_qty: '', defect_type: 'Material Cacat',
    description: '', report_date: new Date().toISOString().split('T')[0],
    shipment_id: ''
  });

  const DEFECT_TYPES = ['Material Cacat', 'Jahitan Longgar', 'Warna Pudar', 'Ukuran Tidak Sesuai', 'Material Robek', 'Noda/Kotor', 'Lainnya'];

  useEffect(() => { fetchReports(); fetchJobs(); fetchShipments(); }, []);

  const fetchReports = async () => {
    const res = await fetch('/api/material-defect-reports', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setReports(Array.isArray(data) ? data : []);
  };

  const fetchJobs = async () => {
    const res = await fetch('/api/production-jobs', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setJobs(Array.isArray(data) ? data.filter(j => j.status === 'In Progress') : []);
  };

  const fetchShipments = async () => {
    const res = await fetch('/api/vendor-shipments', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setShipments(Array.isArray(data) ? data.filter(s => s.status === 'Received') : []);
  };

  const handleJobSelect = async (jobId) => {
    setForm(f => ({ ...f, job_id: jobId, job_item_id: '', sku: '', product_name: '', size: '', color: '' }));
    if (!jobId) { setJobItems([]); return; }
    const res = await fetch(`/api/production-job-items?job_id=${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setJobItems(Array.isArray(data) ? data : []);
  };

  const handleItemSelect = (itemId) => {
    const item = jobItems.find(i => i.id === itemId);
    setForm(f => ({
      ...f, job_item_id: itemId,
      sku: item?.sku || '', product_name: item?.product_name || '',
      size: item?.size || '', color: item?.color || ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/material-defect-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, defect_qty: Number(form.defect_qty) })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Gagal menyimpan laporan'); return; }
      setShowModal(false);
      fetchReports();

      // Auto-prompt to create Replacement Request
      const confirmReplace = window.confirm(
        `✅ Laporan cacat berhasil disimpan!\n\nDitemukan ${form.defect_qty} pcs material CACAT.\nApakah Anda ingin mengajukan Permintaan Material Pengganti kepada ERP?`
      );
      if (confirmReplace && form.shipment_id) {
        const reqRes = await fetch('/api/material-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            request_type: 'REPLACEMENT',
            original_shipment_id: form.shipment_id,
            defect_report_id: data.id,
            reason: `Material cacat: ${form.defect_type} — ${form.description}`,
            items: [{
              sku: form.sku, product_name: form.product_name, size: form.size, color: form.color,
              serial_number: '', requested_qty: Number(form.defect_qty),
              reason: `${form.defect_type}: ${form.description}`
            }]
          })
        });
        const reqData = await reqRes.json();
        if (reqRes.ok) {
          alert(`✅ Permintaan Pengganti ${reqData.request_number} berhasil diajukan ke ERP untuk review.`);
        }
      } else if (confirmReplace && !form.shipment_id) {
        alert('Pilih Shipment Asal terlebih dahulu untuk mengajukan permintaan pengganti.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fmtDate = d => d ? new Date(d).toLocaleDateString('id-ID') : '-';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <AlertOctagon className="w-6 h-6 text-red-600" />
            Laporan Cacat Material
          </h1>
          <p className="text-slate-500 text-sm mt-1">Laporkan material atau produk yang cacat/rusak selama produksi</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
          <Plus className="w-4 h-4" /> Buat Laporan Cacat
        </button>
      </div>

      {/* Reports List */}
      {reports.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">Belum ada laporan cacat</div>
      ) : (
        <div className="space-y-2">
          {reports.map(r => (
            <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-800">{r.product_name}</span>
                  {r.sku && <span className="text-xs font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{r.sku}</span>}
                  <span className="text-xs text-slate-400">{r.size}/{r.color}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cacat: <span className="text-red-600 font-medium">{r.defect_qty} pcs</span> •
                  Tipe: {r.defect_type} •
                  Tanggal: {fmtDate(r.report_date)} •
                  Oleh: {r.reported_by}
                </p>
                {r.description && <p className="text-xs text-slate-400 mt-0.5">{r.description}</p>}
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${r.status === 'Reported' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Create Defect Report Modal */}
      {showModal && (
        <Modal title="Buat Laporan Cacat Material" onClose={() => setShowModal(false)} size="xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              Laporan cacat akan diteruskan ke tim ERP. Jika material perlu diganti, sistem akan membantu Anda mengajukan permintaan pengganti.
            </div>

            {/* Shipment Asal - important for replacement request */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Shipment Asal <span className="text-xs text-slate-400">(diperlukan untuk permintaan pengganti)</span></label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                value={form.shipment_id} onChange={e => setForm(f => ({ ...f, shipment_id: e.target.value }))}>
                <option value="">— Pilih Shipment Asal (opsional) —</option>
                {shipments.map(s => <option key={s.id} value={s.id}>{s.shipment_number} — {fmtDate(s.shipment_date)}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pekerjaan Produksi</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                  value={form.job_id} onChange={e => handleJobSelect(e.target.value)}>
                  <option value="">— Pilih Job (opsional) —</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.job_number} — {j.po_number}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Item Spesifik</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                  value={form.job_item_id} onChange={e => handleItemSelect(e.target.value)} disabled={!form.job_id}>
                  <option value="">— Pilih Item (opsional) —</option>
                  {jobItems.map(i => <option key={i.id} value={i.id}>{i.sku || i.product_name} ({i.size}/{i.color})</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Produk *</label>
                <input required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} placeholder="Nama Produk" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SKU</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="PRD-BLK-M" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Size</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} placeholder="M" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Warna</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} placeholder="Hitam" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Qty Cacat *</label>
                <input required type="number" min="1" className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400" value={form.defect_qty} onChange={e => setForm(f => ({ ...f, defect_qty: e.target.value }))} placeholder="5" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Cacat *</label>
                <select required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white" value={form.defect_type} onChange={e => setForm(f => ({ ...f, defect_type: e.target.value }))}>
                  {DEFECT_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Laporan</label>
                <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.report_date} onChange={e => setForm(f => ({ ...f, report_date: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Deskripsi / Detail Cacat</label>
              <textarea rows="3" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Jelaskan detail kerusakan atau cacat yang ditemukan..." />
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={loading} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {loading ? 'Menyimpan...' : 'Kirim Laporan Cacat'}
              </button>
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-slate-200 py-2 rounded-lg text-sm hover:bg-slate-50">Batal</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
