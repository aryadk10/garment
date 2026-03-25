'use client';
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Package, Factory, FileText, DollarSign, AlertTriangle, TrendingUp, TrendingDown, Clock, Bell, ChevronDown, ChevronUp, X } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function StatCard({ title, value, subtitle, icon: Icon, color, trend }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-3 text-sm ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span>{Math.abs(trend)}% dari bulan lalu</span>
        </div>
      )}
    </div>
  );
}

function ClipboardList({ className }) {
  return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
}

function AlertPanel({ metrics, onDismissAll }) {
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const overduePos = metrics?.alerts?.overduePos || [];
  const nearDeadlinePos = metrics?.alerts?.nearDeadlinePos || [];
  const unpaidInvoices = metrics?.alerts?.unpaidInvoices || [];
  const totalAlerts = overduePos.length + nearDeadlinePos.length + unpaidInvoices.length;

  if (dismissed || totalAlerts === 0) return null;

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  const fmt = (v) => 'Rp ' + (v || 0).toLocaleString('id-ID');

  const getDaysDiff = (deadline) => {
    if (!deadline) return null;
    const diff = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="bg-white border border-red-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-red-50 border-b border-red-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
            <Bell className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-red-800 text-base">Notifikasi & Peringatan</h3>
            <p className="text-xs text-red-600">{totalAlerts} item membutuhkan perhatian</p>
          </div>
          <span className="ml-1 px-2.5 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full">{totalAlerts}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-600 transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button onClick={() => setDismissed(true)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-400 transition-colors" title="Tutup">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-5 space-y-4">
          {/* Overdue POs */}
          {overduePos.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <h4 className="text-sm font-semibold text-red-700">Production PO Melewati Deadline ({overduePos.length})</h4>
              </div>
              <div className="space-y-2">
                {overduePos.map(po => {
                  const days = getDaysDiff(po.deadline);
                  return (
                    <div key={po.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-red-800">{po.po_number}</p>
                          <p className="text-xs text-red-600">{po.product_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-red-500 font-medium">Deadline: {fmtDate(po.deadline)}</p>
                        <p className="text-xs font-bold text-red-700">{Math.abs(days)} hari terlambat</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Near Deadline POs */}
          {nearDeadlinePos.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <h4 className="text-sm font-semibold text-amber-700">PO Mendekati Deadline ({nearDeadlinePos.length})</h4>
              </div>
              <div className="space-y-2">
                {nearDeadlinePos.map(po => {
                  const days = getDaysDiff(po.deadline);
                  return (
                    <div key={po.id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                          <Clock className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-amber-800">{po.po_number}</p>
                          <p className="text-xs text-amber-600">{po.product_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-amber-500 font-medium">Deadline: {fmtDate(po.deadline)}</p>
                        <p className="text-xs font-bold text-amber-700">{days <= 0 ? 'Hari ini!' : `${days} hari lagi`}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unpaid Invoices */}
          {unpaidInvoices.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                <h4 className="text-sm font-semibold text-orange-700">Invoice Belum/Sebagian Dibayar ({unpaidInvoices.length})</h4>
              </div>
              <div className="space-y-2">
                {unpaidInvoices.map(inv => {
                  const outstanding = (inv.total_amount || 0) - (inv.total_paid || 0);
                  return (
                    <div key={inv.id} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-100 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                          <FileText className="w-4 h-4 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-orange-800">{inv.invoice_number}</p>
                          <p className="text-xs text-orange-600">{inv.garment_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium mb-1 ${
                          inv.status === 'Unpaid' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>{inv.status}</span>
                        <p className="text-xs font-bold text-orange-700">Sisa: {fmt(outstanding)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ token }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/dashboard', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => {
    if (!val) return 'Rp 0';
    return 'Rp ' + val.toLocaleString('id-ID');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const woStatusData = (metrics?.woStatus || []).map(s => ({ name: s._id || 'Unknown', value: s.count }));
  const totalAlerts = (metrics?.alerts?.overduePos?.length || 0) + (metrics?.alerts?.nearDeadlinePos?.length || 0) + (metrics?.alerts?.unpaidInvoices?.length || 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Ikhtisar operasional produksi garmen</p>
        </div>
        {totalAlerts > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-sm font-medium text-red-700">{totalAlerts} peringatan aktif</span>
          </div>
        )}
      </div>

      {/* Alert Panel */}
      <AlertPanel metrics={metrics} />

      {/* KPI Cards - Row 1: Production */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Production PO" value={metrics?.totalPOs || 0} subtitle={`${metrics?.activePOs || 0} aktif sedang produksi`} icon={ClipboardList} color="bg-blue-500" />
        <StatCard title="Active Jobs" value={metrics?.activeJobs || 0} subtitle="Production jobs berjalan" icon={Factory} color="bg-emerald-500" />
        <StatCard title="Progress Produksi" value={`${metrics?.globalProgressPct || 0}%`} subtitle={`${(metrics?.totalProducedGlobal || 0).toLocaleString('id-ID')} / ${(metrics?.totalAvailableGlobal || 0).toLocaleString('id-ID')} pcs`} icon={TrendingUp} color="bg-teal-500" />
        <StatCard title="PO Terlambat" value={metrics?.delayedPOs || 0} subtitle="Melewati deadline" icon={AlertTriangle} color="bg-red-500" />
      </div>

      {/* KPI Cards - Row 2: Shipment & Material */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Pending Shipment" value={metrics?.pendingShipments || 0} subtitle="Material belum diterima" icon={Package} color="bg-amber-500" />
        <StatCard title="Req. Material Tambahan" value={metrics?.pendingAdditionalRequests || 0} subtitle="Menunggu persetujuan" icon={AlertTriangle} color="bg-orange-500" />
        <StatCard title="Req. Pengganti Cacat" value={metrics?.pendingReplacementRequests || 0} subtitle="Menunggu persetujuan" icon={AlertTriangle} color="bg-red-400" />
        <StatCard title="Retur Produksi" value={metrics?.pendingReturns || 0} subtitle="Dalam proses perbaikan" icon={ClipboardList} color="bg-purple-500" />
      </div>

      {/* KPI Cards - Row 3: Financial */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Buyer Shipments" value={metrics?.totalBuyerShipments || 0} subtitle="Total pengiriman ke buyer" icon={TrendingUp} color="bg-cyan-500" />
        <StatCard title="Total Invoiced" value={formatCurrency(metrics?.totalInvoiced)} subtitle="nilai produksi" icon={FileText} color="bg-blue-400" />
        <StatCard title="Outstanding" value={formatCurrency(metrics?.outstanding)} subtitle={`Terbayar: ${formatCurrency(metrics?.totalPaid)}`} icon={DollarSign} color="bg-orange-500" />
        <StatCard title="Gross Margin" value={formatCurrency(metrics?.grossMargin)} subtitle={`Revenue: ${formatCurrency(metrics?.totalRevenue)}`} icon={TrendingUp} color="bg-emerald-600" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Production Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-4">Tren Produksi 6 Bulan</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={metrics?.monthlyData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="pos" name="PO" fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="production" name="Produksi (pcs)" fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Work Order Status Pie */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-4">Status Work Order</h3>
          {woStatusData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={woStatusData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value">
                    {woStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {woStatusData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span className="text-slate-600">{entry.name}</span>
                    </div>
                    <span className="font-semibold">{entry.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Belum ada data work order</div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Garments */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-4">Top Garmen by Produksi</h3>
          {(metrics?.topGarments || []).length > 0 ? (
            <div className="space-y-3">
              {metrics.topGarments.map((g, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">{i + 1}</div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700 font-medium">{g._id || 'Unknown'}</span>
                      <span className="text-slate-500">{g.total_qty?.toLocaleString('id-ID')} pcs</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (g.total_qty / (metrics.topGarments[0]?.total_qty || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">Belum ada data produksi</div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-4">Ringkasan Keuangan</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span className="text-sm text-blue-700 font-medium">Total Nilai Produksi</span>
              <span className="font-bold text-blue-800">{formatCurrency(metrics?.totalInvoiced)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
              <span className="text-sm text-emerald-700 font-medium">Total Terbayar</span>
              <span className="font-bold text-emerald-800">{formatCurrency(metrics?.totalPaid)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
              <span className="text-sm text-orange-700 font-medium">Outstanding</span>
              <span className="font-bold text-orange-800">{formatCurrency(metrics?.outstanding)}</span>
            </div>
            {metrics?.totalInvoiced > 0 && (
              <div>
                <div className="flex justify-between text-sm text-slate-500 mb-1">
                  <span>Persentase Pembayaran</span>
                  <span>{Math.round((metrics?.totalPaid / metrics?.totalInvoiced) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div
                    className="bg-emerald-500 h-3 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.round((metrics?.totalPaid / metrics?.totalInvoiced) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
