'use client';
import { useState } from 'react';
import {
  LayoutDashboard, Package, Factory, ClipboardList, TrendingUp,
  FileText, CreditCard, BarChart3, Users, Activity, LogOut, Menu, X,
  Shirt, DollarSign, BookOpen, Truck, ChevronRight, Pencil, RotateCcw
} from 'lucide-react';

const menuItems = [
  {
    section: 'MAIN',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }]
  },
  {
    section: 'MASTER DATA',
    items: [
      { id: 'garments', label: 'Data Vendor/Garmen', icon: Shirt },
      { id: 'products', label: 'Data Produk', icon: Package },
    ]
  },
  {
    section: 'PRODUKSI',
    items: [
      { id: 'production-po', label: 'Production PO', icon: ClipboardList },
      { id: 'vendor-shipments', label: 'Vendor Shipment', icon: Truck },
      { id: 'buyer-shipments', label: 'Buyer Shipment', icon: Package },
      { id: 'production-returns', label: 'Retur Produksi', icon: RotateCcw },
      { id: 'work-orders', label: 'Distribusi Kerja', icon: Factory },
      { id: 'production-monitoring', label: 'Monitoring Produksi', icon: BarChart3 },
    ]
  },
  {
    section: 'KEUANGAN',
    items: [
      { id: 'accounts-payable', label: 'Hutang Vendor (AP)', icon: CreditCard },
      { id: 'accounts-receivable', label: 'Piutang Buyer (AR)', icon: TrendingUp },
      { id: 'manual-invoice', label: 'Invoice Manual', icon: Pencil },
      { id: 'invoices', label: 'Semua Invoice', icon: FileText },
      { id: 'payments', label: 'Manajemen Pembayaran', icon: DollarSign },
      { id: 'financial-recap', label: 'Rekap Keuangan', icon: BarChart3 },
    ]
  },
  {
    section: 'LAPORAN & BANTUAN',
    items: [
      { id: 'reports', label: 'Laporan', icon: BarChart3 },
      { id: 'help-guide', label: 'Panduan Penggunaan', icon: BookOpen },
    ]
  },
  {
    section: 'SISTEM',
    items: [
      { id: 'company-settings', label: 'Pengaturan Perusahaan', icon: Pencil, roles: ['superadmin', 'admin'] },
      { id: 'users', label: 'Manajemen User', icon: Users, roles: ['superadmin'] },
      { id: 'activity-logs', label: 'Log Aktivitas', icon: Activity, roles: ['superadmin', 'admin'] },
    ]
  }
];

export default function Sidebar({ currentModule, onModuleChange, user, onLogout, collapsed, onToggle }) {
  const canAccess = (item) => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role);
  };

  return (
    <div className={`fixed left-0 top-0 h-full bg-slate-900 text-white transition-all duration-300 z-40 flex flex-col ${
      collapsed ? 'w-16' : 'w-64'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center"><Shirt className="w-5 h-5" /></div>
            <div>
              <div className="font-bold text-sm leading-tight">GARMENT ERP</div>
              <div className="text-slate-400 text-xs">Production System</div>
            </div>
          </div>
        )}
        {collapsed && <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mx-auto"><Shirt className="w-5 h-5" /></div>}
        <button onClick={onToggle} className="text-slate-400 hover:text-white ml-auto">
          {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
        </button>
      </div>

      {/* User Info */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user?.name}</div>
              <div className="text-xs text-slate-400 capitalize">{user?.role}</div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {menuItems.map((section) => (
          <div key={section.section}>
            {!collapsed && (
              <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {section.section}
              </div>
            )}
            {section.items.filter(canAccess).map((item) => {
              const Icon = item.icon;
              const isActive = currentModule === item.id;
              return (
                <button key={item.id} onClick={() => onModuleChange(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  } ${collapsed ? 'justify-center' : ''}`}
                  title={collapsed ? item.label : ''}>
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t border-slate-700 p-2">
        <button onClick={onLogout}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
          title={collapsed ? 'Logout' : ''}>
          <LogOut className="w-5 h-5" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}
